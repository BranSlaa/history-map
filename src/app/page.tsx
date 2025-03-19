'use client';

import React, { useState, useEffect, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import 'rc-slider/assets/index.css';
import { createMapIcons, addMapMarkerStyles } from '@/utils/mapUtils';
import { Event } from '@/types/event';
import { MapComponent } from './components/Map';
import Sidebar from './components/Sidebar';
import { setHeaderHeight } from './utils/headerHeight';

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
		<div className="grid grid-cols-1 md:grid-cols-[300px,1fr] grid-rows-[calc(50vh-var(--header-height)),50vh] md:grid-rows-1 h-full max-h-[calc(100vh-var(--header-height))]">
			<Sidebar
				className=""
				selectedEvent={selectedEvent}
				onEventSelect={handleEventSelection}
				onSearch={searchEvents}
			/>
			<div className="col-span-1 md:col-span-1 row-span-1 h-full">
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
		</div>
	);
};

export default App;
