import React, { useState } from 'react';
import { Event } from '@/types/event';

interface EventListProps {
	events: {
		data: Event[];
		count: number;
	};
	onEventClick: (event: Event) => void;
}

const EventList: React.FC<EventListProps> = ({ events, onEventClick }) => {
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const renderEventItem = (event: Event) => (
		<li
			key={`${event.id}`}
			className={`cursor-pointer p-2 mb-2 border-2 border-transparent hover:bg-amber-100 transition-colors
				${event.id === selectedEvent?.id ? 'border-dashed border-green-800 bg-green-100' : 'border-b-amber-700'}
				`}
			role="button"
			tabIndex={0}
			onClick={() => {
				setSelectedEvent(event);
				onEventClick(event);
			}}
		>
			<div className="grid grid-cols-[1fr,auto] gap-2 items-center">
				<span className="text-stone-800 dark:text-amber-100">
					{event.title}
				</span>
				<span className="text-xs text-stone-600 dark:text-amber-300">
					{event.year}
				</span>
			</div>
			<div className="text-xs mt-1 text-stone-600 dark:text-amber-300 opacity-70">
				{event.subject
					.split('-')
					.map(word => word.charAt(0).toUpperCase() + word.slice(1))
					.join(' ')}
			</div>
		</li>
	);

	return (
		<div className="flex-grow overflow-y-auto max-h-[calc(60vh-10rem)]">
			<ul className="list-none p-3">
				{events.data &&
					events.data.length > 0 &&
					events.data.map(event => renderEventItem(event))}
			</ul>
		</div>
	);
};

export default EventList;
