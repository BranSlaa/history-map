import React, { useState, useEffect } from 'react';
import { Event } from '@/types/event';
import EventSearch from './EventSearch';
import EventList from './EventList';
import { setHeaderHeight } from '../utils/headerHeight';

interface EventPanelProps {
	events: Event[];
	onSelectEvent: (event: Event) => void;
	onSearch?: (query: string) => Promise<Event[]>;
}

const EventPanel: React.FC<EventPanelProps> = ({ events, onSelectEvent }) => {
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
		<div className="bg-amber-50 border-b border-amber-700">
			<EventSearch onSearch={handleSearch} isSearching={isSearching} />
		</div>
	);
};

export default EventPanel;
