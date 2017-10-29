// @Flow
import React, { Component } from 'react';
import _ from 'lodash';
import { assert } from 'sjtest';
import Login from 'you-again';
import {XId } from 'wwutils';

import { Button, FormControl, InputGroup, Tabs, Tab } from 'react-bootstrap';

import { StripeProvider, Elements, injectStripe, CardElement, CardNumberElement, CardExpiryElement, CardCVCElement, PostalCodeElement, PaymentRequestButtonElement } from 'react-stripe-elements';

import C from '../C';
import printer from '../utils/printer';
import ActionMan from '../plumbing/ActionMan';
import DataStore from '../plumbing/DataStore';
import NGO from '../data/charity/NGO';
import MonetaryAmount from '../data/charity/MonetaryAmount';

import Misc from './Misc';
import { impactCalc } from './ImpactWidgetry.jsx';
import GiftAidForm from './GiftAidForm';
import SocialShare from './SocialShare.jsx';
import {nonce,getType} from '../data/DataClass';

/**
 * 
 * TODO Doc notes on the inputs to this. the charity profile sends in charity and project.
 */

const stripeKey = (window.location.host.startsWith('test') || window.location.host.startsWith('local')) ?
		'pk_test_RyG0ezFZmvNSP5CWjpl5JQnd' // test
		: 'pk_live_InKkluBNjhUO4XN1QAkCPEGY'; // live


const initialFormData = {
	id: nonce(),
	amount: MonetaryAmount.make({ value: 10, currency: 'gbp' }),
	coverCosts: true,
	giftAid: false,
	giftAidTaxpayer: false,
	giftAidOwnMoney: false,
	giftAidNoCompensation: false,
	donorName: '',
	donorAddress: '',
	donorPostcode: '',
	message: '',
	pending: false,
	complete: false,
};

const initialWidgetState = {
	open: false,
	stage: 1,
};

const amountOK = ({amount}) => amount && amount.value >= 1.0;

const giftAidOK = ({giftAid, giftAidTaxpayer, giftAidOwnMoney, giftAidNoCompensation}) => (
	!giftAid || (giftAidTaxpayer && giftAidOwnMoney && giftAidNoCompensation)
);

/** 
 * Minor todo: address & postcode can be optional, unless you have gift aid
*/
const detailsOK = ({name, address, postcode}) => (
	name.trim().length > 0 && address.trim().length > 0 && postcode.trim().length > 0
);

// Message can't be "bad", payment is final stage so can only be incomplete
const messageOK = (formData) => true;

const paymentOK = (formData) => true;

const stagesOK = (formData) => [
	amountOK(formData),
	giftAidOK(formData),
	detailsOK(formData),
	messageOK(formData),
	paymentOK(formData),
];

/**
 * item:
 */
const DonationForm = ({item}) => {
	assert(C.TYPES.isFundraiser(getType(item)) || C.TYPES.isNGO(getType(item)) || C.TYPES.isEvent(getType(item)), 
		"NewDonationForm - type "+getType(item));
	const widgetPath = ['widget', 'NewDonationForm', item.id];
	let widgetState = DataStore.getValue(widgetPath);
	if (!widgetState) {
		widgetState = initialWidgetState;
		DataStore.setValue(widgetPath, widgetState, false);
	}
	const donateButton = (
		<span className='btn btn-default' onClick={() => DataStore.setValue([...widgetPath, 'open'], true)}>
			Donate
		</span>
	);
	// not open? just show the button
	if (!widgetState.open) {
		return donateButton;
	}

	// get/make the draft donation
	let type = C.TYPES.Donation;
	let pDonation = ActionMan.getDonationDraft({to: item.id});
	let donationDraft = pDonation.value;
	if (!donationDraft) {
		// if the promise is running, wait for it before making a new draft
		if ( ! pDonation.resolved) {
			return donateButton;
			// TODO if they click whilst the promise is running (unlikely)
			// display a spinner
		}
		// make a new draft donation
		donationDraft = {
			...initialFormData,
			from: Login.getId(),
			to: item.id,
		};
	}

	const path = ['data', type, donationDraft.id];
	DataStore.setValue(path, donationDraft, false);
	// also store it where the fetch will find it
	DataStore.setValue(['data', type, 'draft-to:'+donationDraft.to], donationDraft, false);
	
	const stagePath = [...widgetPath, 'stage'];

	const closeLightbox = () => DataStore.setValue([...widgetPath, 'open'], false);
	
	const closeButton = (
		<span className='glyphicon glyphicon-remove pull-right' onClick={closeLightbox}/>
	);

	// TODO use bootstrap dialog classes for the lightbox?? c.f. LoginWidget.jsx ^Dan
	return (
		<div>
			{donateButton}
			<div className='lightbox' onClick={closeLightbox}>
				<Misc.Card title='GIMME YOUR MONEY' titleChildren={closeButton} onClick={e => e.stopPropagation()}>
					<Tabs activeKey={widgetState.stage} onSelect={(key) => DataStore.setValue(stagePath, key)} id='payment-stages'>
						<Tab eventKey={1} title='Amount'>
							<SectionWrapper stagePath={stagePath} sectionNumber={1} isFirst>
								<AmountSection path={path} />
							</SectionWrapper>
						</Tab>
						<Tab eventKey={2} title='Gift Aid'>
							<SectionWrapper stagePath={stagePath} sectionNumber={2}>
								<GiftAidSection path={path} />
							</SectionWrapper>
						</Tab>
						<Tab eventKey={3} title='Details'>
							<SectionWrapper stagePath={stagePath} sectionNumber={3}>
								<DetailsSection path={path} />
							</SectionWrapper>
						</Tab>
						<Tab eventKey={4} title='Message'>
							<SectionWrapper stagePath={stagePath} sectionNumber={4}>
								<MessageSection path={path} />
							</SectionWrapper>
						</Tab>
						<Tab eventKey={5} title='Payment'>
							<SectionWrapper stagePath={stagePath} sectionNumber={5} isLast>
								<PaymentSection path={path} />
							</SectionWrapper>
						</Tab>
					</Tabs>
				</Misc.Card>
				<Misc.SavePublishDiscard type={type} id={donationDraft.id} hidden />
			</div>
		</div>
	);
}; // ./DonationForm

const SectionWrapper = ({stagePath, sectionNumber, children, isFirst, isLast}) => {
	const prevLink = isFirst ? '' : (
		<Misc.SetButton path={stagePath} value={sectionNumber - 1} className='btn btn-default pull-left'>
			Previous
		</Misc.SetButton>
	);
	const nextLink = isLast ? '' : (
		<Misc.SetButton path={stagePath} value={sectionNumber + 1} className='btn btn-default pull-right'>
			Next
		</Misc.SetButton>
	);
	return (
		<div className='section'>
			{ children }
			{ prevLink } { nextLink }
		</div>
	);
};


const AmountSection = ({path}) => (
	<div className='section donation-amount'>
		<Misc.PropControl prop='amount' path={path} type='MonetaryAmount' label='Donation' />
		<Misc.PropControl prop='coverCosts' path={path} type='checkbox' label='Cover processing costs' />
	</div>
);

const GiftAidSection = ({path}) => (
	<div className='section donation-amount'>
		<Misc.PropControl prop='giftAid' path={path} type='checkbox' label='Add Gift Aid' />
		<Misc.PropControl prop='giftAidTaxpayer' label={`I'm a taxpayer`} path={path} type='checkbox' />
		<Misc.PropControl prop='giftAidOwnMoney' label={`This is my money`} path={path} type='checkbox' />
		<Misc.PropControl prop='giftAidNoCompensation' label={`Nobody's paying me to do this`} path={path} type='checkbox' />
	</div>
);

const DetailsSection = ({path}) => (
	<div className='section donation-amount'>
		<Misc.PropControl prop='donorName' label='Name' placeholder='Enter your name' path={path} type='text' />
		<Misc.PropControl prop='donorAddress' label='Address' placeholder='Enter your address' path={path} type='address' />
		<Misc.PropControl prop='donorPostcode' label='Postcode' placeholder='Enter your postcode' path={path} type='postcode' />
	</div>
);

const MessageSection = ({path}) => (
	<div className='section donation-amount'>
		<Misc.PropControl prop='message' label='Message' placeholder='Do you have a message for $FUNDRAISER?' path={path} type='text' />
	</div>
);

const PaymentSection = ({path}) => {
	return (
		<div className='section donation-amount'>
			<StripeProvider apiKey={stripeKey}>
				<Elements>
					<StripeThings />
				</Elements>
			</StripeProvider>
		</div>
	);
};

/**
 * Stripe widgets manage their own state
 */	
class StripeThingsClass extends Component {
	constructor(props) {
		super(props);

		const paymentRequest = props.stripe.paymentRequest({
			country: 'GB',
			currency: 'gbp',
			total: {
				label: 'Demo total',
				amount: 100,
			},
		});

		paymentRequest.on('token', ({complete, token, ...data}) => {
			console.log('Received Stripe token: ', token);
			console.log('Received customer information: ', data);
			complete('success');
		});

		paymentRequest.canMakePayment().then(result => {
			this.setState({canMakePayment: !!result});
		});
 
		this.state = {
			// @Roscoe what does this test for?? is this testing for the built-in payment API?
			canMakePayment: false,
			paymentRequest,
		};
	}

	handleSubmit(event) {

	}

	render() {
		if (this.state.canMakePayment) {
			return (<PaymentRequestButtonElement paymentRequest={this.state.paymentRequest} />);
		} 

		return (
			<div>
				<h3>Card number</h3>
				<div className='form-control'>
					<CardNumberElement placeholder='0000 0000 0000 0000' />
				</div>
				<h3>Expiry date</h3>
				<div className='form-control'>
					<CardExpiryElement />
				</div>
				<h3>CVC</h3>
				<div className='form-control'>
					<CardCVCElement />
				</div>
				<h3>Postcode</h3>
				<div className='form-control'>
					<PostalCodeElement placeholder='AB1 2CD' />
				</div>
			</div>
		);
	} // ./render()
} // ./StripeThingsClass

const StripeThings = injectStripe(StripeThingsClass);

export default DonationForm;
