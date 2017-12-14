import React, { Component } from 'react';
import Login from 'you-again';
import { assert } from 'sjtest';
import { getUrlVars, toTitleCase, modifyHash } from 'wwutils';
import _ from 'lodash';

// Plumbing
import DataStore from '../../plumbing/DataStore';
import Roles from '../../Roles';
import CRUD from '../../plumbing/Crud';
import C from '../../C';
// Templates
import MessageBar from '../MessageBar';
import NavBar from '../NavBar';
import LoginWidget from '../LoginWidget/LoginWidget';
// Pages
import DashboardPage from '../DashboardPage';
import SearchPage from '../SearchPage';
import AccountPage from '../AccountPage';
import AboutPage from '../AboutPage';
import CharityPage from '../CharityPage';
import EditCharityPage from '../editor/EditCharityPage';
import EditorDashboardPage from '../editor/EditorDashboardPage';
import ExchangeRatesPage from '../editor/ExchangeRatesPage';
import FundRaiserPage from '../FundRaiserPage';
import EditFundRaiserPage from '../editor/EditFundRaiserPage';
import ManageDonationsPage from '../editor/ManageDonationsPage';
import EditEventPage from '../editor/EditEventPage';
import EventPage from '../EventPage';
import RegisterPage from '../RegisterPage';

// Actions

const PAGES = {
	event: EventPage,
	editEvent: EditEventPage,
	register: RegisterPage,
	fundraiser: FundRaiserPage,
	editFundraiser: EditFundRaiserPage,
	search: SearchPage,
	dashboard: DashboardPage,
	editordashboard: EditorDashboardPage,
	manageDonations: ManageDonationsPage,
	account: AccountPage,
	charity: CharityPage,
	edit: EditCharityPage,
	exchangeRates: ExchangeRatesPage,
	about: AboutPage
};

const DEFAULT_PAGE = 'search';

/**
		Top-level: tabs
*/
class MainDiv extends Component {

	componentWillMount() {
		// redraw on change
		const updateReact = (mystate) => this.setState({});
		DataStore.addListener(updateReact);

		Login.app = C.app.service;
		// Set up login watcher here, at the highest level		
		Login.change(() => {
			// ?? should we store and check for "Login was attempted" to guard this??
			if (Login.isLoggedIn()) {
				// close the login dialog on success
				DataStore.setShow(C.show.LoginWidget, false);
			} else {
				// poke React via DataStore (e.g. for Login.error)
				DataStore.update({});
			}
			this.setState({});
		});

		// enforce a page
		let path = DataStore.getValue('location', 'path');
		let page = (path && path[0]);
		if ( ! page) {
			modifyHash([DEFAULT_PAGE]);
		}
	}

	render() {
		let path = DataStore.getValue('location', 'path');		
		let page = (path && path[0]);
		if ( ! page) {
			page = DEFAULT_PAGE;
			console.warn("MainDiv.jsx - No page?! in render() - using default "+DEFAULT_PAGE);
		}
		assert(page);
		let Page = PAGES[page];		
		assert(Page, page);

		let msgs = Object.values(DataStore.getValue('misc', 'messages-for-user') || {});
		return (
			<div>
				<NavBar page={page} />
				<div className="container avoid-navbar">
					<MessageBar messages={msgs} />
					<div className='page' id={page}>
						<Page />
					</div>
				</div>
				<LoginWidget logo={C.app.service} title={'Welcome to '+C.app.name} />
			</div>
		);
	}
}

export default MainDiv;
