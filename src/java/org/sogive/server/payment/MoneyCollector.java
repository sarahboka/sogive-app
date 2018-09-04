package org.sogive.server.payment;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.sogive.data.DBSoGive;
import org.sogive.data.charity.Money;
import org.sogive.data.charity.NGO;
import org.sogive.data.commercial.Transfer;
import org.sogive.data.user.Donation;
import org.sogive.data.user.Person;

import com.goodloop.data.PaymentException;
import com.stripe.Stripe;
import com.stripe.exception.AuthenticationException;
import com.stripe.exception.CardException;
import com.stripe.exception.InvalidRequestException;
import com.stripe.model.Charge;
import com.stripe.model.Customer;
import com.stripe.model.Plan;
import com.stripe.model.Subscription;
import com.winterwell.ical.Repeat;
import com.winterwell.utils.Dep;
import com.winterwell.utils.Utils;
import com.winterwell.utils.containers.ArrayMap;
import com.winterwell.utils.log.Log;
import com.winterwell.web.app.WebRequest;
import com.winterwell.web.data.XId;

/**
 * TODO handle repeat donations
 * @author daniel
 *
 */
public class MoneyCollector {

	private String buyerEmail;

	public MoneyCollector(IForSale basket, XId buyer, String buyerEmail, XId seller, WebRequest state) {
		this.basket = basket;
		this.user = buyer;
		this.buyerEmail = buyerEmail;
		this.to = seller;
		this.state = state;
		Utils.check4null(basket, buyer);
	}


	private static final String LOGTAG = "money";
	final IForSale basket;
	final XId user;
	final XId to;
	/**
	 * Can be null. StripeAuth gets info from here.
	 */
	final WebRequest state;
	
	List<Transfer> transfers = new ArrayList();
	
	public List<Transfer> run() {
		Money total = basket.getAmount();
		
		// already paid?
		if (basket.getPaymentCollected()) {
			Log.d(LOGTAG, "no money collection - payment already collected for "+basket);
			return transfers;
		}

		// nothing to pay?
		if (total.getValue100p()==0) {
			Log.d(LOGTAG, "no money collection - £0 for "+basket);
			return transfers;
		}
		
		// paid on credit?		
		StripeAuth sa = basket.getStripe();
		boolean allOnCredit = false;
		if (sa != null && StripeAuth.credit_token.equals(sa.id)) {
			allOnCredit = true;
		}		
		Money credit = Transfer.getTotalCredit(user);
		if (credit!=null && credit.getValue100p() > 0) {
			// NB if your account is in debt i.e. < 0, then you cant pay on credit
			Money residual = doCollectMoney2(credit, allOnCredit);
			if (residual==null || residual.getValue100p()==0) {
				return transfers;
			}
			Log.d(LOGTAG, "part payment on credit "+basket+" residual: "+residual);
			total = residual;
		} else if (allOnCredit) {
			throw new PaymentException("Cannot pay with credit of "+credit+" (basket: "+basket+")");
		}
		
		// TODO Less half-assed handling of Stripe exceptions
		try {
			/** Donation has provision to store a StripeAuth now - may already be on the object */
			// take payment
			String ikey = basket.getId();
			Person userObj = DBSoGive.getCreateUser(user);
			if (sa == null) {
				sa = new StripeAuth(userObj, state);
			}
			
			if (StripeAuth.SKIP_TOKEN.equals(sa.id)) { 
				// TODO security check!
				Log.d(LOGTAG, "skip payment: "+basket);
				return transfers; 
			}						
						
			if (basket.getRepeat()!=null) {
				run2_repeat(sa, userObj);
				return transfers;
			}
			
			// simple one off payment
			String chargeDescription = basket.getClass().getSimpleName()+" "+basket.getId()+" "+basket.getDescription();
			Charge charge = StripePlugin.collect(total, chargeDescription, sa, userObj, ikey);
			Log.d("stripe.collect", charge);
			basket.setPaymentId(charge.getId());
			basket.setPaymentCollected(true);					
			transfers.add(new Transfer(user, to, total));
			// FIXME
//			pi.setRefresh("true");
//			pi.setOpTypeCreate(true);				
			// check we haven't done before: done by the op_type=create
			return transfers;
		} catch(Throwable e) {
			throw Utils.runtime(e);
		}
	}

	static String STRIPE_REPEAT_DONATION_PRODUCT = "prod_DXNVdXseaxwEo6";
	static String STRIPE_REPEAT_DONATION_TESTPRODUCT = "prod_DXNgWKoFs8bs6a";

	private void run2_repeat(StripeAuth sa, Person userObj) throws Exception {
		Repeat repeat = basket.getRepeat();
		Money amount = basket.getAmount();
		String chargeDescription = basket.getClass().getSimpleName()+" "+basket.getId()+" "+basket.getDescription();
		Log.d("stripe.plan", chargeDescription);
//		String plan = StripePlugin.makePlan(chargeDescription);
		
		String secretKey = StripePlugin.secretKey();
		Utils.check4null(secretKey, "Stripe secretKey");
		Stripe.apiKey = secretKey;
		
		// the product/service
		String product = Dep.get(StripeConfig.class).testStripe? STRIPE_REPEAT_DONATION_TESTPRODUCT : STRIPE_REPEAT_DONATION_PRODUCT; 
		
		// pence, rounding up
		int pence = (int) Math.ceil(amount.getValue100p() / 100);
		String interval = repeat.getFreq().toString().toLowerCase(); // day / week / month / year
		Map<String, Object> params = new ArrayMap(
			"interval", interval,
			"product", product,
//			"nickname", "Repeat Donation"
			"amount", pence,
	        "currency", Utils.or(amount.getCurrency(), "GBP")
		);
		Plan plan = Plan.create(params);
		Log.d(LOGTAG, "Made a plan "+plan.getId()+" for repeating "+basket);
		
		// token -> Customer
//		getCreateCustomerId
		if (sa.getCustomerId()==null) {
			Map<String, Object> customerParams = new ArrayMap<>(
				"email", getBuyerEmail(),
				"source", sa.id
			);
			Customer customer = Customer.create(customerParams);
			sa.customerId = customer.getId();
		}
		
		// subscribe		
		String customerId = sa.customerId;
		Map stripeInfo = null; 
		if (userObj!=null) {
			stripeInfo = (Map) userObj.get("stripe");
		}
		if (stripeInfo==null) stripeInfo = new ArrayMap();
		if (userObj!=null) {
	        userObj.put("stripe", stripeInfo);
        }
		stripeInfo.put("customerId", customerId);
		stripeInfo.put("email", getBuyerEmail());
		
		Map<String, Object> subparams = new ArrayMap(
			"customer", customerId,
			"items", new ArrayMap(
				"0", new ArrayMap(
					"plan", plan.getId()
					))
			);
		Subscription sub = Subscription.create(subparams);
		
		List subs = Utils.or((List)stripeInfo.get("subscriptions"), new ArrayList());
		subs.add(sub.toJson());
		stripeInfo.put("subscriptions", subs);
		
		Log.d("stripe.subscribe", basket+" -> "+sub.toJson());
	}


	private String getBuyerEmail() {
		if (buyerEmail!=null) return buyerEmail;		
		assert user.isService("email") : user;
		return user.dewart();
	}


	private Money doCollectMoney2(Money credit, boolean allOnCredit) 
	{		
		// TODO check credit more robustly		
		Money amount = basket.getAmount();
		Money paidOnCredit = amount;
		Money residual = Money.pound(0);
		if (amount.getValue100p() > credit.getValue100p()) {
			residual = amount.minus(credit);
			paidOnCredit = credit;
			if (allOnCredit) {
				throw new PaymentException("Cannot pay "+amount+" with credit of "+credit+" (basket: "+basket+")");
			}
		}
		// reduce credit
		Transfer t = new Transfer(user, to, paidOnCredit);
		t.publish();
		transfers.add(t);
		basket.setPaymentId(t.getId());
		// OK
		return residual;
	}

}
