'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

import 'rc-slider/assets/index.css';
import { Event } from '@/types/event';
import { setHeaderHeight } from './utils/headerHeight';
import { HistoryPath } from './components/HistoryPath';
import EventList from './components/EventList';

const MapComponent = dynamic(
	() => import('./components/Map').then(mod => mod.MapComponent),
	{
		ssr: false,
		loading: () => (
			<div className="flex h-full items-center justify-center bg-amber-50">
				<div className="text-lg text-amber-800">Loading Map...</div>
			</div>
		),
	},
);

const App = () => {
	const [events, setEvents] = useState<Event[]>([]);
	const [loading, setLoading] = useState<boolean>(false);
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [userPath, setUserPath] = useState<Event[]>([]);
	const [skippedEvents, setSkippedEvents] = useState<Set<string>>(new Set());

	useEffect(() => {
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

		const savedUserPath = localStorage.getItem('userPath');
		if (savedUserPath) {
			try {
				const parsedUserPath = JSON.parse(savedUserPath);
				if (Array.isArray(parsedUserPath)) {
					setUserPath(parsedUserPath);
				}
			} catch (error) {
				console.error('Failed to parse saved user path:', error);
			}
		}

		const savedSkippedEvents = localStorage.getItem('skippedEvents');
		if (savedSkippedEvents) {
			try {
				const parsedSkippedEvents = JSON.parse(savedSkippedEvents);
				if (Array.isArray(parsedSkippedEvents)) {
					setSkippedEvents(new Set(parsedSkippedEvents));
				}
			} catch (error) {
				console.error('Failed to parse saved skipped events:', error);
			}
		}
	}, []);

	const handleEventSelection = (event: Event) => {
		setSelectedEvent(event);
	};

	const handleSearchResults = useCallback(
		(searchResults: Event[]) => {
			const filteredResults = searchResults.filter(
				event =>
					!userPath.some(pathEvent => pathEvent.id === event.id) &&
					!Array.from(skippedEvents).includes(event.id),
			);
			setEvents(filteredResults);
			localStorage.setItem(
				'savedEvents',
				JSON.stringify(filteredResults),
			);
		},
		[userPath, skippedEvents],
	);

	const addToUserPath = useCallback((event: Event) => {
		setUserPath(prev => {
			if (prev.some(e => e.id === event.id)) return prev;
			const newPath = [...prev, event];
			localStorage.setItem('userPath', JSON.stringify(newPath));
			return newPath;
		});
	}, []);

	const searchEvents = useCallback(
		async (query: Event): Promise<Event[]> => {
			setLoading(true);
			const searchTopic = query.title || '';
			const searchYear = query.year || '';
			const searchSubject = query.subject || '';

			const searchParams = new URLSearchParams();
			if (searchTopic) searchParams.set('topic', searchTopic);
			if (searchYear) searchParams.set('year', searchYear.toString());
			if (searchSubject) searchParams.set('subject', searchSubject);

			try {
				const response = await fetch(
					`/api/v1/events?${searchParams.toString()}`,
				);
				if (response.status === 404) return [];
				if (!response.ok) throw new Error('Failed to search events');
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

	const chooseEvent = () => {
		if (!selectedEvent) return;

		const unchosenEvents = events.filter(
			event => event.id !== selectedEvent.id,
		);
		const unchosenIds = unchosenEvents.map(event => event.id);

		addToUserPath(selectedEvent);

		setSkippedEvents(prev => {
			const newSkipped = new Set([...prev, ...unchosenIds]);
			localStorage.setItem(
				'skippedEvents',
				JSON.stringify(Array.from(newSkipped)),
			);
			return newSkipped;
		});

		searchEvents(selectedEvent).then(() => {
			setSelectedEvent(null);
		});
	};

	return (
		<div className="relative h-full grid grid-cols-[1fr] grid-rows-[1fr_auto] overflow-hidden">
			<section className="h-full relative col-span-1 col-start-1">
				<MapComponent
					events={events}
					initialCenter={[55, 0]}
					initialZoom={4}
					onSelectEvent={handleEventSelection}
					selectedEvent={selectedEvent}
				/>
				{selectedEvent && (
					<button
						className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-700 text-white px-4 py-2 font-bold rounded-md"
						onClick={() => {
							chooseEvent();
						}}
					>
						Choose Event
					</button>
				)}
			</section>
			<HistoryPath />
			<section className="absolute left-1/2 top-[16px] -translate-x-1/2 overflow-y-auto w-full max-w-[768px] px-4">
				<EventList
					events={{ data: events, count: events.length }}
					onEventClick={handleEventSelection}
				/>
			</section>
		</div>
	);
};

export default App;
