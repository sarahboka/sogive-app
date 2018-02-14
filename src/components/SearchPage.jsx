/* eslint-disable react/no-multi-comp */ // Don't complain about more than one React class in the file
import React from 'react';
import _ from 'lodash';
import { assert, assMatch } from 'sjtest';
import {Button, Form, FormGroup, FormControl, Glyphicon, InputGroup} from 'react-bootstrap';
import {uid, encURI, modifyHash, stopEvent} from 'wwutils';
import Login from 'you-again';

import ServerIO from '../plumbing/ServerIO';
import DataStore from '../plumbing/DataStore';
import NGO from '../data/charity/NGO';
import Project from '../data/charity/Project';
import Output from '../data/charity/Output';
import Money from '../data/charity/Money';
import Misc from './Misc';
import {impactCalc} from './ImpactWidgetry';
import C from '../C';
import {getId} from '../data/DataClass';

// #Minor TODO refactor to use DataStore more. Replace the FormControl with a Misc.PropControl

const MAX_RESULTS = 10000;
const RESULTS_PER_PAGE = 20;
const MAX_PAGES = 10;

export default class SearchPage extends React.Component {

	constructor(...params) {
		super(...params);
		this.state = {
			results: []
		};
	}

	setResults(results, total, from, all, recommended) {
		assert(_.isArray(results));
		this.setState({
			results: results,
			total: total,
			from: from,
			all: all,
			recommended: recommended,
		});
	}

	render() {
		// query comes from the url
		let q = DataStore.getUrlValue('q');
		let from = DataStore.getUrlValue('from') || 0;
		let status = DataStore.getUrlValue('status') || '';
		if (q==='ERROR') { // HACK
			throw new Error("Argh!");
		}

		let searchResults = null;
		let searchPager = null;
		// Show results box if a query was entered (so we get "No Results")
		if (q || this.state.recommended) {
			searchResults = (
				<div className='col-md-12'>
					<SearchResults results={this.state.results} total={this.state.total} from={from} query={q} all={this.state.all} recommended={this.state.recommended} />
				</div>
			);
		}

		return (
			<div className='SearchPage row'>
				<div className='col-md-12'>
					<SearchForm query={q} from={from} status={status} setResults={this.setResults.bind(this)}/>
				</div>
				{searchResults}
				{searchPager}
				<div className='col-md-10'>
					<FeaturedCharities />
				</div>
			</div>
		);
	}
}

const FeaturedCharities = () => null; 
/*
<div> class='featured-charities''
	<p className='featured-charities-header'>
		Featured Charities
	<FeaturedCharities results={ { TODO a render-er for top-charities or a featured charity. When a search returns results, this should convert into a sidebar, or at least become hidden, and a sidebar should be generated. } }/>
	</p>
*/


class SearchForm extends React.Component {
	constructor(...params) {
		super(...params);
		this.state = {
			q: this.props.query,
			recommended: !this.props.query, // No query on creation = grab the recommended charities
		};
	}

	componentDidMount() {
		if (this.state.q) {
			this.search(this.state.q);
		} else if (this.state.recommended) {
			this.search('', null, null, true); // Give us all recommended charities
		}
	}

	// Allow hash change to provoke a new search
	componentWillReceiveProps(nextProps) {
		if (nextProps.query && (nextProps.query !== this.state.q || nextProps.from !== this.props.from || nextProps.status !== this.props.status)) {
			this.search(nextProps.query, nextProps.status, nextProps.from);
		}
	}

	onChange(name, e) {
		e.preventDefault();
		let newValue = e.target.value;
		let newState = {};
		newState[name] = newValue;
		this.setState(newState);
	}

	onSubmit(e) {
		e.preventDefault();
		console.warn("submit",this.state);
		this.search(this.state.q || '', this.props.status, 0);
	}

	search(query, status, from, recommended) {
		// Put search query in URL so it's bookmarkable / shareable
		DataStore.setUrlValue("q", query);
		DataStore.setUrlValue("from", from);
		
		DataStore.setValue(['widget', 'Search', 'loading'], true);
		const all = !recommended && !query;

		// hack to allow status=DRAFT
		ServerIO.search({q: query, from, size: RESULTS_PER_PAGE, status, recommended})
			.then(function(res) {
				console.warn(res);
				let charities = res.cargo.hits;
				let total = res.cargo.total;
				DataStore.setValue(['widget', 'Search', 'loading'], false);
				this.props.setResults(charities, total, from || 0, all, recommended);
				this.setState({recommended: false});
			}.bind(this));

	}

	showAll(e) {
		e.preventDefault();
		this.setState({q: ''});
		this.search('');
	}

	clear(e) {
		e.preventDefault();
		this.setState({q: ''});
	}

	/*
	const showAllButton = (
		<div className='pull-right'>
			<Button onClick={this.showAll.bind(this)} className="btn-showall" bsSize='sm'>
				Show All
			</Button>
		</div>
	);
	*/

	render() {
		return (
			<div className='SearchForm'><Form onSubmit={(event) => { this.onSubmit(event); }} >
				<FormGroup className='' bsSize='lg' controlId="formq">
					<InputGroup bsSize='lg'>
						<FormControl
							className='sogive-search-box'
							type="search"
							value={this.state.q || ''}
							placeholder="Keyword search"
							onChange={(e) => this.onChange('q', e)}
						/>
						<FieldClearButton onClick={(e) => this.clear(e)}>
							<Glyphicon glyph='remove-circle' />
						</FieldClearButton>
						<InputGroup.Addon className='sogive-search-box' onClick={(e) => this.onSubmit(e)}>
							<Glyphicon glyph="search" />
						</InputGroup.Addon>
					</InputGroup>
				</FormGroup>
				{/*showAllButton*/}
			</Form></div>
		);
	} // ./render
} //./SearchForm


const FieldClearButton = ({onClick, children}) => (
	<span className='field-clear-button visible-xs-block' onClick={onClick}>
		{children}
	</span>
);


/**
 * 
 * @param {
* 		results: {!NGO[]} the charities
 * 	CTA: {?ReactComponent} allows the Read More button to be replaced
 * 	onPick: {?Function} charity => 
 * 	tabs {Boolean|String[]}
 * 	loading {?Boolean}
 * }
 */
const SearchResults = ({ results, total, query, from, all, recommended, CTA, onPick, tabs, download, loading}) => {
	if ( ! results) results = [];
	// NB: looking for a ready project is deprecated, but left for backwards data compatibility
	// TODO adjust the DB to have ready always on the charity
	const ready = _.filter(results, NGO.isReady);
	const unready = _.filter(results, r => ! NGO.isReady(r) );

	let resultsForText = '';
	if (all) {
		resultsForText = 'Showing all charities';
	} else if (recommended) {
		resultsForText = 'Showing recommended charities';
	} else {
		resultsForText = `Results for “${query}”`;
	}

	const recommendedNote = recommended ? (
		<div className='recommended-note'>These recommendations are based on analysis of impact data</div>
	) : null;

	return (
		<div className='SearchResults'>
			{tabs !== false? <div className='top-tab'>{resultsForText}</div> : null}
			{recommendedNote}
			<SearchResultsNum results={results} total={total} query={query} />
			<div className='results-list'>
				{ _.map(ready, item => <SearchResult key={getId(item)} item={item} onPick={onPick} CTA={CTA} />) }
				{ unready.length ? (
					<div className='unready-results row'>
						<h3>Analysis in progress</h3>
						SoGive is working to collect data and model the impact of every UK charity -- all 200,000.
					</div>
				) : null}
				{ _.map(unready, item => <SearchResult key={getId(item)} item={item} onPick={onPick} CTA={CTA} />) }
				<SearchPager total={total} from={from} />
			</div>
			{results.length===0 && query && ! loading? <SuggestCharityForm /> : null}
			{download !== false? <div className='col-md-12'><DownloadLink total={total} /></div> : null}
		</div>
	);
}; //./SearchResults

/**
 * TODO allow users to suggest extra charities
 */
const SuggestCharityForm = () => {
	let fpath = ['widget','SuggestCharityForm'];
	let formData = DataStore.getValue(fpath);

	// extra MyLoop vars
	DataStore.setValue(fpath.concat('notify'), 'daniel@sodash.com');

	return (<div className='SuggestCharityForm'>
		<p>Can't find the charity you want? If you fill in the details below, we'll try to add it to the database.
			Meanwhile, you can still register -- pick 'Kiltwalk' as the charity, and you can change it later).
		</p>
		<Misc.PropControl path={fpath} prop='charityName' label='Name of charity' />		
		<Misc.PropControl path={fpath} prop='website' label='Charity website' />
		<Misc.PropControl path={fpath} prop='facebook' label='Charity Facebook page (if applicable)' />
		<Misc.PropControl path={fpath} prop='contactEmail' label='Contact email for charity' />
		<Misc.PropControl path={fpath} prop='contactPhone' label='Contact phone number for charity' />
		<Misc.PropControl path={fpath} prop='email' label='Your email' />
		<Misc.SubmitButton url='https://profiler.winterwell.com/form/sogive' path={fpath} 
			onSuccess={<p>Thank you for suggesting this charity.</p>} 
		>
			Submit
		</Misc.SubmitButton>
	</div>);
};

const SearchResultsNum = ({results, total, query}) => {
	if (total===undefined) total = results.length; // fallback
	let loading = DataStore.getValue('widget', 'Search', 'loading');
	if (loading) return <div className='num-results'><Misc.Loading /></div>;
	if (results.length || query) {
		const plural = total !== 1 ? 'charities found' : 'charity found';
		return <div className='num-results'>{total} {plural}</div>;
	}
	return <div className='num-results' />; // ?!
};

const ellipsize = (string, length) => {
	if (string && string.length) {
		if (string.length < length) {
			return string;
		}
		return string.slice(0, length) + '…';
	}
	return '';
};


const DefaultCTA = ({itemUrl, onClick, item}) => {
	return (<a href={itemUrl} onClick={onClick} className='read-more btn btn-default'>
				Read more
		<img className='read-more-caret' src='/img/read-more-caret.svg' />
	</a>);
};

/**
 * {
 * 	item: {!NGO} the charity
 * 	CTA: {?ReactComponent: {itemUrl, onClick, item} => jsx} allows the Read More button to be replaced
 * }
 */
const SearchResult = ({ item, CTA, onPick }) => {
	if ( ! CTA) CTA = DefaultCTA;
	let project = NGO.getProject(item);
	let status = item.status;
	let page = C.KStatus.isDRAFT(status)? 'edit' : 'charity';
	const cid = NGO.id(item);
	const charityUrl = '#'+page+'?charityId='+encURI(cid);

	// We need to make impact calculations so we can say e.g. "£1 will find X units of impact"
	// We also need to store the suggested donation amount so the user can tweak it on the fly with buttons
	let targetCount = DataStore.getValue(['widget','SearchResults', cid, 'targetCount']);
	// The donation picker needs to store its value
	// DataStore.setValue(['widget','DonationForm', NGO.id(item), 'amount'], newAmount);
	const impact = project ? impactCalc({
		charity: item, 
		project, 
		output: project && Project.outputs(project)[0], 
		targetCount: targetCount || 1
	}) : null;

	// Does the desc begin with the charity name (or a substring)? Strip it and make a sentence!
	const charityName = NGO.displayName(item);
	let charityDesc = item.summaryDescription || item.description || '';
	let commonPrefixLength = 0;
	for (let i = 0; i < charityName.length && i < charityDesc.length; i++) {
		if (charityName[i] === charityDesc[i]) {
			commonPrefixLength = i + 1;
		} else {
			break;
		}
	}
	
	if (commonPrefixLength >= 3) {
		charityDesc = charityDesc.slice(commonPrefixLength).trim();
	}
	// Some elements need to be shrunk down if they're too long
	const longName = charityName.length > 25;

	const recommendedTab = item.recommended ? (
		<span className='recommended-tab'><img className='recommended-icon' src='/img/recommended.svg' />Recommended Charity</span>
	) : null;
	
	/** if onPick is defined, then stop the click and call onPick */
	let onClick = null;
	if (onPick) {
		assMatch(onPick, Function);
		onClick = e => {
			stopEvent(e);
			onPick(item);
		};
	}
	
	const impactExplanation = impact ? (
		<div className='impact col-md-6 hidden-xs'>
			<div className='impact-summary'>
				<h3>Impact Summary</h3>
				<Misc.Money amount={Output.cost(impact)} maximumFractionDigits={0} maximumSignificantDigits={2} /> may 
				fund <span className='impact-count'>{Output.number(impact)}</span> {Output.name(impact)}
			</div>
			<div className='impact-detail'>
				{ellipsize(impact.description, 140)}
			</div>
			<CTA itemUrl={charityUrl} onClick={onClick} item={item} />
		</div>
	) : null;
	
	const noImpact = !impact ? (
		<div className='noImpact col-md-6 hidden-xs'>
			Impact information is not available for this charity.
			<CTA itemUrl={charityUrl} onClick={onClick} item={item} />
		</div>
	) : null;

	return (
		<div className={`SearchResult row ${item.recommended ? 'recommended' : ''}`} data-id={cid} >
			{recommendedTab}
			<a href={charityUrl} onClick={onClick} className='logo col-md-2 col-xs-4'>
				{item.logo? (
					<img className='charity-logo' src={NGO.logo(item)} alt={`Logo for ${charityName}`} />
				) : (
					<div className={`charity-logo-placeholder ${longName? 'long-name' : ''}`}>{charityName}</div>
				)}
			</a>
			<a href={charityUrl} onClick={onClick} className='text-summary col-md-4 col-xs-8'>
				<span className='name'>{charityName}</span>
				<span className='description'>{ellipsize(charityDesc, 140)}</span>
			</a>
			{impactExplanation}
			{noImpact}
		</div>
	);
}; //./SearchResult


const SearchPager = ({total, from = 0}) => {
	const pageCount = Math.min(Math.ceil(total / RESULTS_PER_PAGE), MAX_RESULTS / RESULTS_PER_PAGE);
	const thisPage = Math.ceil((from / RESULTS_PER_PAGE) + 1);
	const pageNumbers = [];
	if (pageCount > MAX_PAGES) {
		// Present a "nice" abbreviated list of page numbers
		// Always first and last, always 2 (if they exist) either side of current page
		if (thisPage <= 4) {
			for (let i = 1; i <= thisPage + 2; i++) {
				pageNumbers.push(i);
			}
			pageNumbers.push('…');
			pageNumbers.push(pageCount);
		} else if (thisPage >= pageCount - 3) {
			pageNumbers.push(1);
			pageNumbers.push('…');
			for (let i = thisPage - 2; i <= pageCount; i++) {
				pageNumbers.push(i);
			}
		} else {
			pageNumbers.push('1');
			pageNumbers.push('…');
			for (let i = thisPage - 2; i <= thisPage + 2; i++) {
				pageNumbers.push(i);
			}
			pageNumbers.push('…');
			pageNumbers.push(pageCount);
		}
	} else {
		for (let i = 1; i <= pageCount; i++) {
			pageNumbers.push(i);
		}
	}

	const pageLinks = pageNumbers.map((pageNum, index) => {
		if (Number.isInteger(pageNum)) {
			if (pageNum === thisPage) {
				return <span key={`search-page-${pageNum}`} className='pager-button current-page' title={`Viewing page ${pageNum}`}>{pageNum}</span>;
			}
			return <PageLink key={`search-page-${pageNum}`} pageNum={pageNum} />;
		}
		return <span key={`search-page-gap-${index}`} className='pager-button no-page'>{pageNum}</span>;
	});

	if (thisPage > 1) {
		pageLinks.unshift(
			<PageLink key={`search-page-prev`} pageNum={thisPage - 1} title='Previous page'>
				&lt;
			</PageLink>
		);
	}
	if (thisPage > 2) {
		pageLinks.unshift(
			<PageLink key={`search-page-first`} pageNum={1} title='First page'>
				&lt;&lt;
			</PageLink>
		);
	}
	if (pageCount - thisPage > 0) {
		pageLinks.push(
			<PageLink key={`search-page-next`} pageNum={thisPage + 1} title='Next page'>
				&gt;
			</PageLink>
		);
	}
	if (pageCount - thisPage > 1) {
		pageLinks.push(
			<PageLink key={`search-page-last`} pageNum={pageCount} title='Last page'>
				&gt;&gt;
			</PageLink>
		);
	}


	return (
		<div className='search-pager'>
			{pageLinks}
		</div>
	);
};

const PageLink = ({pageNum, title, children}) => {
	const newFrom = (pageNum - 1) * RESULTS_PER_PAGE;
	const newHash = modifyHash(null, {from: newFrom}, true);
	const goToPage = (event) => {
		DataStore.setUrlValue('from', newFrom);
		event.stopPropagation();
		event.preventDefault();
	};
	
	return (
		<a 
			href={window.location.pathname + newHash}
			className='pager-button'
			onClick={goToPage}
			title={title || `Go to page ${pageNum}`}
		>
			{children || pageNum}
		</a>
	);
};

const DownloadLink = ({total}) => {
	let noCos = false;
	if ( ! Login.isLoggedIn()) noCos = "not logged in";
	if ( ! total) noCos = "no results";
	const locn = ""+window.location;
	const qi = locn.indexOf('?');
	const qry = qi === -1? '' : locn.substr(qi+1);
	if (noCos) {
		return (
			<span className='pull-right text-secondary' 
				title={'('+noCos+') Download these reults in .csv (spreadsheet) format'}>
				<Glyphicon glyph='download-alt' /> csv
			</span>);	
	}
	return (
		<a className='pull-right' 
			title='Download these reults in .csv (spreadsheet) format'
			href={'/search.csv?'+qry} 
			target='_new'>
			<Glyphicon glyph='download-alt' /> csv
		</a>
	);
};

export {SearchResults};
