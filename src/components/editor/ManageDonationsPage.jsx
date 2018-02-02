import React from 'react';
import ReactDOM from 'react-dom';

import SJTest, {assert, assMatch} from 'sjtest';
import Login from 'you-again';
import {encURI, XId} from 'wwutils';

import ActionMan from '../../plumbing/ActionMan';
import DataStore from '../../plumbing/DataStore';
import ServerIO from '../../plumbing/ServerIO';
import C from '../../C';
import Roles from '../../Roles';
import {getId} from '../../data/DataClass';
import Misc from '../Misc';
import SimpleTable from '../SimpleTable';

const onEditPaidOut = ({item, value, event, row, column}) => {
	item.paidOut = value;
	console.warn('onEditPaidOut', item, row, column, value, event);
	DataStore.setData(item);
};

const ManageDonationsPage = () => {

	if ( ! Login.isLoggedIn()) {
		return <div>Please login</div>;
	}
	if ( ! Roles.iCan(C.CAN.manageDonations).value) {
		return <div>You need the `manageDonations` capability.</div>;
	}

	const pvDonations = DataStore.fetch(['list', 'Donations', 'all'], () => {
		return ServerIO.load('/donation/list/all.json', {data: {status: 'ALL_BAR_TRASH'}} )
			.then(res => {
				let dons = res.cargo.hits;
				dons.forEach(don => {
					console.log("setData", don);
					DataStore.setValue(['data', C.TYPES.Donation, getId(don)], don, false);
					// DataStore.setData(don); // handle missing type
				});
				return res;
			});
	});
	if ( ! pvDonations.resolved) {
		return <Misc.Loading />;
	}
	let rdons = pvDonations.value;
	console.warn('rdons', rdons);
	let dons = rdons.hits;

	const columns = [
		{
			id: 'id',
			Header: 'Id',
			accessor: d => getId(d)
		}, 
		{
			Header: 'Date',
			accessor: 'date'
		},
		{
			Header: 'From',
			accessor: 'from',
			Cell: v => XId.dewart(v)
		}, {
			Header: 'To',
			accessor: 'to'
		}, 
		{
			Header: "Amount",
			accessor: 'amount',
			Cell: v => <Misc.Money amount={v} /> // Custom cell components!
		},
		'app',
		{
			Header: 'on-credit',
			accessor: d => d.stripe && d.stripe.type === 'credit'
		},
		{
			Header: "Paid Out",
			accessor: 'paidOut',
			editable: true,
			type: 'checkbox',
			saveFn: ({item,...huh}) => {
				console.warn('huh', huh, item);
				if (item.status === 'DRAFT') {
					ActionMan.saveEdits(C.TYPES.Donation, item.id, item);
				} else {
					ActionMan.publishEdits(C.TYPES.Donation, item.id, item);
				}
			}
		},
		{
			Header: "Gift Aid",
			accessor: 'giftAid'
		},
		{
			Header: "Donor details",
			accessor: d => (d.donorAddress||'') + " " + (d.donorPostcode||'')
		},
		'status'
	];


	return (
		<div className=''>
			<h2>Manage Donations</h2>

			<SimpleTable data={dons} columns={columns} />

		</div>
	);
};

export default ManageDonationsPage;
