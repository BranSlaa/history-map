import React, { useState } from 'react';
import { Event } from '@/types/event';

const EventPanel: React.FC<{
	events: Event[];
	onSelectEvent: (event: Event) => void;
}> = ({ events, onSelectEvent }) => {
	const [visible, setVisible] = useState(false);
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const toggleVisible = () => {
		setVisible(!visible);
	};

	return (
		<>
			<button
				className="event-panel-toggle-button"
				onClick={toggleVisible}
			>
				{visible ? 'Hide' : 'Show'} Pin List
			</button>
			<div className={`event-panel ${visible ? 'visible' : ''}`}>
				<div className="title-bar">
					<h2>Map Pins</h2>
					<button className="toggle-button" onClick={toggleVisible}>
						{visible ? 'Hide' : 'Show'}
					</button>
				</div>
				<ul className="event-list">
					{events.map((event, index) => (
						<li
							key={`${event.title}-${event.year}-${index}-sidebar`}
							onClick={() => {
								setSelectedEvent(event);
								onSelectEvent(event);
							}}
							onBlur={() => {
								setSelectedEvent(events[index + 1]);
								onSelectEvent(events[index + 1]);
							}}
							onKeyDown={e => {
								if (e.shiftKey && e.keyCode === 9) {
									setSelectedEvent(events[index - 1]);
									onSelectEvent(events[index - 1]);
								}
							}}
							className={`event-list-item ${
								selectedEvent === event ? 'selected' : ''
							}`}
							role="button"
							tabIndex={0}
						>
							{event.title}
						</li>
					))}
				</ul>
			</div>
		</>
	);
};

export default EventPanel;
