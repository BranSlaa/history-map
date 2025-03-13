import React, { useState } from 'react';
import { Event } from '@/types/event';
import EventSearch from './EventSearch';
import EventList from './EventList';

interface EventPanelProps {
	onSelectEvent: (event: Event) => void;
}

const EventPanel: React.FC<EventPanelProps> = ({ onSelectEvent }) => {
	const [events, setEvents] = useState<{ data: Event[]; count: number }>({
		data: [],
		count: 0,
	});
	const [isSearching, setIsSearching] = useState<boolean>(false);

	const handleSearch = async (topic: string) => {
		setIsSearching(true);
		try {
			const response = await fetch(
				`/api/events/?topic=${encodeURIComponent(topic)}`,
			);
			if (!response.ok) throw new Error('Network response was not ok');
			const data = await response.json();
			setEvents(data);
		} catch (error) {
			console.error('Failed to fetch events:', error);
		} finally {
			setIsSearching(false);
		}
	};

	const handleEventClick = (event: Event) => {
		onSelectEvent(event);
	};

	return (
		<div className="bg-amber-50 border-2 border-amber-700 rounded-lg mb-4 h-auto overflow-hidden grid grid-rows-[auto,auto,1fr]">
			<div className="grid grid-cols-[1fr,auto] gap-4 items-center border-b border-amber-700 dark:border-amber-800 pb-2 px-4 pt-3">
				<h2 className="text-lg font-semibold text-stone-800 dark:text-amber-100">
					Your Path Through History
				</h2>
				{events?.data?.length > 0 && (
					<span className="text-xs text-stone-600 dark:text-amber-300">
						{events.count} events
					</span>
				)}
			</div>

			<EventSearch onSearch={handleSearch} isSearching={isSearching} />

			<EventList events={events} onEventClick={handleEventClick} />
		</div>
	);
};

export default EventPanel;
