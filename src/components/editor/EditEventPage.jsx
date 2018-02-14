import React from 'react';
import ReactDOM from 'react-dom';

import SJTest, {assert} from 'sjtest';
import Login from 'you-again';
import printer from '../../utils/printer.js';
import {modifyHash} from 'wwutils';
import C from '../../C';
import Roles from '../../Roles';
import Misc from '../Misc';
import DataStore from '../../plumbing/DataStore';
import ServerIO from '../../plumbing/ServerIO';
import ActionMan from '../../plumbing/ActionMan';
import {getType, getId, nonce} from '../../data/DataClass';
import Ticket from '../../data/charity/Ticket';
import Event from '../../data/charity/Event';
import ListLoad, {CreateButton} from '../ListLoad';

const EditEventPage = () => {
	if ( ! Login.isLoggedIn()) {
		return <div className='alert alert-warning'><h3>Please login</h3></div>;
	}
	// which event?	
	let path = DataStore.getValue(['location','path']);
	let eventId = path[1];
	if (eventId) return <EventEditor id={eventId} />;
	let type = C.TYPES.Event;
	let servlet = path[0];
	return (<div>
		<CreateButton type={type} />
		<h2>Edit an Event</h2>
		<ListLoad type={type} servlet='event' navpage='editEvent' />
	</div>);
};

const EventEditor = ({id}) => {
	let type = C.TYPES.Event;
	let pEvent = ActionMan.getDataItem({type:type, id:id, status:C.KStatus.DRAFT});
	if ( ! pEvent.value) {
		return <Misc.Loading />;
	}
	let item = pEvent.value;

	const addTicketType = () => {
		const tt = Ticket.make({}, item.id);
		item.ticketTypes = (item.ticketTypes || []).concat(tt);
		DataStore.update();
	};
	const addExtra = () => {
		const tt = Ticket.make({}, item.id);
		item.extras = (item.extras || []).concat(tt);
		DataStore.update();
	};

	/**
	 * alter the ticket order 
	 */
	const move = (i, di) => {
		// swap
		let ta = item.ticketTypes[i];
		let tb = item.ticketTypes[i+di];
		assert(ta && tb, "EditEventPage.js - move");
		item.ticketTypes[i] = tb;
		item.ticketTypes[i+di] = ta;
		DataStore.update();
	};

	const path = ['data', type, id];
	return (<div>
		<h2>Event {item.name || id} </h2>		
		<small>ID: {id}</small>

		<Misc.Card title='Event Details'>
			<Misc.PropControl path={path} prop='name' item={item} label='Event Name' />

			<Misc.PropControl path={path} prop='date' item={item} label='Event Date' type='date' />
			
			<Misc.PropControl path={path} prop='description' item={item} label='Description' type='textarea' />

			<Misc.PropControl path={path} prop='matchedFunding' item={item} label='Matched funding? e.g. 40% for The Kiltwalk' 
				type='number' />

			<Misc.PropControl path={path} prop='pickCharity' item={item} 
				label='Allow users to pick their charity?' type='checkbox' 
				dflt 
			/>

			<Misc.PropControl path={path} prop='teams' item={item} 
				label='User teams?' type='checkbox' />
		</Misc.Card>

		<Misc.Card icon='camera' title='Images & Branding'>
			<Misc.PropControl path={path} prop='backgroundImage' item={item} label='Event Page Backdrop' type='imgUpload' />
			
			<Misc.PropControl path={path} prop='logoImage' item={item} label='Square Logo Image' type='imgUpload' />

			<Misc.PropControl path={path} prop='bannerImage' item={item} label='Banner Image' type='imgUpload' />
		</Misc.Card>

		<Misc.Card title='Ticket Types' icon='ticket'>
			{item.ticketTypes? item.ticketTypes.map( (tt, i) => 
				<TicketTypeEditor key={'tt'+i} i={i} path={path.concat(['ticketTypes', i])} ticketType={tt} event={item} move={move} last={i + 1 === item.ticketTypes.length} />) 
				: <p>No tickets yet!</p>
			}
			<button className='btn btn-default' onClick={addTicketType}><Misc.Icon glyph='plus' /> Create</button>
		</Misc.Card>

		<Misc.Card title='Merchandise & Extras' icon='gift'>
			{item.extras? item.extras.map( (tt, i) => 
				<ExtraEditor key={'tt'+i} i={i} path={path.concat(['extra', i])} extra={tt} event={item} move={move} last={i + 1 === item.extras.length} />) 
				: <p>No extras yet!</p>
			}
			<button className='btn btn-default' onClick={addExtra}><Misc.Icon glyph='plus' /> Create</button>
		</Misc.Card>


		<Misc.SavePublishDiscard type={type} id={id} />
	</div>);
};

const TicketTypeEditor = ({ticketType, path, event, i, move, last}) => {
	const removeTicketType = () => {
		event.ticketTypes = event.ticketTypes.filter(tt => tt !== ticketType);
		DataStore.update();
	};
	return (<div className='well'>
		<small>{ticketType.id}</small>
		<Misc.PropControl item={ticketType} path={path} prop='name' label='Name' placeholder='e.g. The Wee Wander' />
		<Misc.PropControl item={ticketType} path={path} prop='subtitle' label='SubTitle' placeholder='e.g. a 10 mile gentle walk' />
		<Misc.PropControl item={ticketType} path={path} prop='kind' label='Kind' placeholder='e.g. Adult / Child' />
		<Misc.PropControl type='Money' item={ticketType} path={path} prop='price' label='Price' />
		<Misc.Col2>
			<div>
				<Misc.PropControl type='number' item={ticketType} path={path} prop='stock' label='Stock' 
					help='The maximum number that can be sold - normally left blank for unlimited' />
				<Misc.PropControl type='checkbox' item={ticketType} path={path} prop='inviteOnly' label='Invite only' 
					help='TODO only those invited by the organiser can attend' />
			</div>
			<div><label>Sold so far: {ticketType.sold || 0}</label></div>
		</Misc.Col2>
		<Misc.PropControl type='text' item={ticketType} path={path} prop='description' label='Description' />
		<Misc.PropControl type='text' item={ticketType} path={path} prop='attendeeNoun' label='Attendee Noun' placeholder='e.g. Walker' />
		<Misc.PropControl type='imgUpload' item={ticketType} path={path} prop='attendeeIcon' label='Attendee Icon' />
		<button disabled={i===0} className='btn btn-default' onClick={() => move(i, -1)}><Misc.Icon glyph='arrow-up' /> up</button>
		<button disabled={last} className='btn btn-default' onClick={() => move(i, 1)}><Misc.Icon glyph='arrow-down' /> down</button>
		<button className='btn btn-danger' onClick={removeTicketType}><Misc.Icon glyph='trash' /></button>
	</div>);
};

// copy pasta of TicketTypeEditor. We could refactor. We could use ListLoad. But prob copy-paste is optimal for time.
const ExtraEditor = ({extra, path, event, i, move, last}) => {
	const removeThing = () => {
		event.extras = event.extras.filter(tt => tt !== extra);
		DataStore.update();
	};
	return (<div className='well'>
		<small>{getId(extra)}</small>
		<Misc.PropControl item={extra} path={path} prop='name' label='Name' placeholder='e.g. Event T-Shirt' />
		<Misc.PropControl item={extra} path={path} prop='subtitle' label='SubTitle' placeholder='' />		
		<Misc.PropControl type='Money' item={extra} path={path} prop='price' label='Price' />
		<Misc.PropControl type='text' item={extra} path={path} prop='description' label='Description' />
		<Misc.Col2>
			<Misc.PropControl type='text' item={extra} path={path} prop='stock' label='Stock' help='The maximum number that can be sold' />
			<div><label>Sold so far: {extra.sold || 0}</label></div>
		</Misc.Col2>
		<button disabled={i===0} className='btn btn-default' onClick={() => move(i, -1)}><Misc.Icon glyph='arrow-up' /> up</button>
		<button disabled={last} className='btn btn-default' onClick={() => move(i, 1)}><Misc.Icon glyph='arrow-down' /> down</button>
		<button className='btn btn-danger' onClick={removeThing}><Misc.Icon glyph='trash' /></button>
	</div>);
};

export default EditEventPage;
