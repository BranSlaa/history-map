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
		<button
			key={`${event.id}`}
			className={`text-left cursor-pointer p-2 border-dashed border-2 hover:bg-green-100 transition-colors transition-border
				${event.id === selectedEvent?.id ? 'bg-green-100 border-green-800' : 'bg-amber-50 border-transparent'}
				`}
			tabIndex={0}
			onClick={() => {
				setSelectedEvent(event);
				onEventClick(event);
			}}
		>
			<div className="grid grid-cols-[1fr,auto] gap-2 items-center">
				<span className="text-stone-800 text-lg">{event.title}</span>
			</div>
			<div className="flex flex-col gap-1">
				{event.year && (
					<div className="text-sm text-black font-bold">
						Year:{' '}
						<span className="text-sm text-amber-600 font-bold">
							{event.year}
						</span>
					</div>
				)}
				{event.subject && (
					<div className="text-sm text-black font-bold">
						Subject:{' '}
						<span className="text-sm text-amber-600 font-bold">
							{event.subject
								.split('-')
								.map(
									word =>
										word.charAt(0).toUpperCase() +
										word.slice(1),
								)
								.join(' ')}
						</span>
					</div>
				)}
			</div>
			{event.id === selectedEvent?.id && (
				<div className="text-sm mt-1 text-black opacity-70">
					{event.description}
				</div>
			)}
		</button>
	);

	return (
		<div className="flex-grow overflow-y-auto h-full">
			<div className="gap-2 flex flex-col">
				{events.data &&
					events.data.length > 0 &&
					events.data.map(event => renderEventItem(event))}
			</div>
		</div>
	);
};

export default EventList;
