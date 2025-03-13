'use client';

import React, { useState, useEffect, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import 'rc-slider/assets/index.css';
import { createMapIcons, addMapMarkerStyles } from '@/utils/mapUtils';
import { Event } from '@/types/event';
import { MapComponent } from './components/Map';
import Sidebar from './components/Sidebar';

const App = () => {
	const [events, setEvents] = useState<Event[]>([]);
	const [loading, setLoading] = useState<boolean>(false);
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
	const [userPath, setUserPath] = useState<Event[]>([]);
	const [headerHeight, setHeaderHeight] = useState<number>(0);
	const [mapHeight, setMapHeight] = useState<number>(0);
	// Initialize map icons and load saved events if any
	useEffect(() => {
		// Initialize map icons
		createMapIcons?.();
		addMapMarkerStyles?.();
		setHeaderHeight(document.querySelector('header')?.clientHeight || 0);
		setMapHeight(window.innerHeight - headerHeight);

		// Load saved events from localStorage if any
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

	// Handle event selection
	const handleEventSelection = (event: Event) => {
		setSelectedEvent(event);
	};

	// Toggle sidebar visibility
	const toggleSidebar = () => {
		setSidebarOpen(!sidebarOpen);
	};

	// Handle search results - called when user searches in EventPanel
	const handleSearchResults = useCallback((searchResults: Event[]) => {
		setEvents(searchResults);
		// Save to localStorage for persistence
		localStorage.setItem('savedEvents', JSON.stringify(searchResults));
	}, []);

	// Add event to user path (for logged-in experience)
	const addToUserPath = useCallback((event: Event) => {
		setUserPath(prev => {
			// Don't add duplicates
			if (prev.some(e => e.id === event.id)) {
				return prev;
			}

			const newPath = [...prev, event];
			// Save to localStorage for persistence
			localStorage.setItem('userPath', JSON.stringify(newPath));
			return newPath;
		});
	}, []);

	// Perform API search - called from EventPanel
	const searchEvents = useCallback(
		async (query: string): Promise<Event[]> => {
			setLoading(true);
			try {
				const response = await fetch(
					`/api/events/search?query=${encodeURIComponent(query)}`,
				);

				if (!response.ok) {
					throw new Error('Failed to search events');
				}

				const data = await response.json();

				if (data.events && Array.isArray(data.events)) {
					// Update events state
					const newEvents = data.events.slice(0, 2); // Limit to 2 events as requested
					handleSearchResults(newEvents);
					return newEvents;
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
		<div
			className={`grid grid-cols-1 md:grid-cols-[1fr,3fr] grid-rows-[calc(50vh-${headerHeight}px)_50vh] md:grid-rows-1 h-full`}
		>
			<Sidebar className="row-span-1" />
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
					<div className="flex h-full items-center justify-center bg-amber-50 dark:bg-stone-900">
						<div className="text-lg text-amber-800 dark:text-amber-200">
							Loading map data...
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default App;
