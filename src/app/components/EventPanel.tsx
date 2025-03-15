import React, { useState, useEffect } from 'react';
import { Event } from '@/types/event';
import EventSearch from './EventSearch';
import EventList from './EventList';
import { setHeaderHeight } from '../utils/headerHeight';

interface EventPanelProps {
	onSelectEvent: (event: Event) => void;
	onSearch?: (query: string) => Promise<Event[]>;
}

const EventPanel: React.FC<EventPanelProps> = ({ onSelectEvent, onSearch }) => {
	const [events, setEvents] = useState<{ data: Event[]; count: number }>({
		data: [],
		count: 0,
	});
	const [isSearching, setIsSearching] = useState<boolean>(false);

	useEffect(() => {
		setHeaderHeight();
	}, []);

	const handleSearch = async (topic: string) => {
		setIsSearching(true);
		try {
			if (onSearch) {
				const searchResults = await onSearch(topic);
				setEvents({
					data: searchResults,
					count: searchResults.length,
				});
				return;
			}

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
		<div className="bg-amber-50 border-b border-amber-700 h-full grid grid-rows-[auto,auto,1fr] overflow-hidden">
			<div className="grid grid-cols-[1fr,auto] gap-4 items-center border-b border-amber-700 p-4">
				<h2 className="text-lg font-semibold text-stone-800">
					Your Path Through History
				</h2>
				{events?.data?.length > 0 && (
					<span className="text-xs text-stone-600">
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
