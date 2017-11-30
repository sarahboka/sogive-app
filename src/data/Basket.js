
import _ from 'lodash';
import {assert, assMatch} from 'sjtest';
import {isa, nonce, defineType} from './DataClass';
import {uid, blockProp} from 'wwutils';
import MonetaryAmount from './charity/MonetaryAmount';
import C from '../C';

const Basket = defineType(C.TYPES.Basket);
const This = Basket;
export default Basket;

// To get a Basket, use ActionMan.getBasketPV

// Basket is normally DRAFT (PUBLISHED = paid for)

Basket.isa = (obj) => isa(obj, Basket.type)
		// sneaky place to add safety checks
		&& blockProp(obj, 'charity', 'Basket.js - use Basket.charityId()')
		&& true;

This.eventId = obj => obj.eventId;
This.charityId = obj => obj.charityId;

Basket.idForUxid = (uxid) => "for_"+uxid;


/**
 * @returns {!Object[]}
 */
Basket.getItems = (basket) => {
	if ( ! basket.items) basket.items = [];
	return basket.items;
};

/** Add up the prices of all the items in the basket 
 * @returns {MonetaryAmount} never null
*/
Basket.getTotal = (basket) => {
	// Using this clumsy forEach instead of a reduce because this makes it clearer
	// that the total's MonetaryAmount object (thus currency) is based on the first item
	let total = null;
	Basket.getItems(basket).forEach((item) => {
		MonetaryAmount.assIsa(item.price);
		if (total === null) {
			total = item.price;
		} else {
			total = MonetaryAmount.add(total, item.price);
		}
	});
	if (total && basket.hasTip && MonetaryAmount.isa(basket.tip)) {
		total = MonetaryAmount.add(total, basket.tip);
	}
	return total || MonetaryAmount.make();
};

Basket.make = (base = {}) => {
	let ma = {
		items: [],
		hasTip: true,
		tip: MonetaryAmount.make({value: 1}), // TODO tip/fee shouldn't really be hard-coded here
		...base,
		'@type': Basket.type,
	};
	Basket.assIsa(ma);
	return ma;
};
