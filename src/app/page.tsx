'use client';

import React, { useState, useEffect, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import 'rc-slider/assets/index.css';
import { createMapIcons, addMapMarkerStyles } from '@/utils/mapUtils';
import { Event } from '@/types/event';
import { MapComponent } from './components/Map';
import Sidebar from './components/Sidebar';
import { setHeaderHeight } from './utils/headerHeight';
import { HistoryPath } from './components/HistoryPath';
import EventList from './components/EventList';

const App = () => {
	const [events, setEvents] = useState<Event[]>([]);
	const [loading, setLoading] = useState<boolean>(false);
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
	const [userPath, setUserPath] = useState<Event[]>([]);

	useEffect(() => {
		createMapIcons?.();
		addMapMarkerStyles?.();
		setHeaderHeight();

		const savedEvents = localStorage.getItem('savedEvents');
		if (savedEvents) {
			try {
				const parsedEvents = JSON.parse(savedEvents);
				if (Array.isArray(parsedEvents)) {
					setEvents(parsedEvents);
				}
			} catch (error) {
				console.error('Failed to parse saved events:', error);
			}
		}
	}, []);

	const handleEventSelection = (event: Event) => {
		setSelectedEvent(event);
	};

	const toggleSidebar = () => {
		setSidebarOpen(!sidebarOpen);
	};

	const handleSearchResults = useCallback((searchResults: Event[]) => {
		setEvents(searchResults);
		localStorage.setItem('savedEvents', JSON.stringify(searchResults));
	}, []);

	const addToUserPath = useCallback((event: Event) => {
		setUserPath(prev => {
			if (prev.some(e => e.id === event.id)) {
				return prev;
			}

			const newPath = [...prev, event];
			localStorage.setItem('userPath', JSON.stringify(newPath));
			return newPath;
		});
	}, []);

	const searchEvents = useCallback(
		async (query: string): Promise<Event[]> => {
			setLoading(true);
			try {
				const response = await fetch(
					`/api/v1/events?topic=${encodeURIComponent(query)}`,
				);

				if (response.status === 404) {
					return [];
				}

				if (!response.ok) {
					throw new Error('Failed to search events');
				}

				const data = await response.json();

				if (data.data && Array.isArray(data.data)) {
					handleSearchResults(data.data);
					return data.data;
				}
				return [];
			} catch (error) {
				console.error('Error searching events:', error);
				return [];
			} finally {
				setLoading(false);
			}
		},
		[handleSearchResults],
	);

	return (
		<div className="h-full grid grid-cols-1 grid-rows-1 ">
			<div className="relative max-h-[600px] w-full h-full">
				{!loading ? (
					<MapComponent
						events={events}
						initialCenter={[55, 0]}
						initialZoom={4}
						onSelectEvent={handleEventSelection}
						selectedEvent={selectedEvent}
					/>
				) : (
					<div className="flex h-full items-center justify-center bg-amber-50">
						<div className="text-lg text-amber-800">
							Loading map data...
						</div>
					</div>
				)}
			</div>
			<EventList
				events={{ data: events, count: events.length }}
				onEventClick={handleEventSelection}
			/>
			<HistoryPath />
		</div>
	);
};

export default App;
