'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { Event } from '@/types/event';
import EventPanel from './components/EventPanel';
import InformationPanel from './components/InformationPanel';
import SubjectFilterBar from './components/SubjectFilterBar';
import {
	fetchEvents,
	AdjustMapView,
	markInteractedEvents,
} from '@/utils/mapUtils';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import supabase from '@/lib/supabaseClient';
import WelcomeBack from './components/WelcomeBack';

// Import Leaflet components dynamically
const MapContainer = dynamic(
	() => import('react-leaflet').then(mod => mod.MapContainer),
	{ ssr: false },
);
const TileLayer = dynamic(
	() => import('react-leaflet').then(mod => mod.TileLayer),
	{ ssr: false },
);
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), {
	ssr: false,
});
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), {
	ssr: false,
});

const App: React.FC = () => {
	const router = useRouter();
	const searchParams = useSearchParams();

	// Near the top of the component, add both refs we need
	const mountId = React.useRef(Math.random().toString(36).substring(2, 8));
	const isFirstMount = React.useRef(true);
	const renderCountRef = React.useRef(0);

	// Component lifecycle logger
	useEffect(() => {
		console.log(
			`[${mountId.current}] App component mounted at ${new Date().toLocaleTimeString()}`,
		);

		return () => {
			console.log(
				`[${mountId.current}] App component unmounted at ${new Date().toLocaleTimeString()}`,
			);
		};
	}, []);

	// Add a new useEffect to run once on component mount to log initial state
	useEffect(() => {
		console.log(
			`[${mountId.current}] Initial state - showWelcomeBack: ${showWelcomeBack}, hasLastEvent: ${!!lastEvent}`,
		);
	}, []); // Empty dependency array ensures it runs only once on mount

	// Reference for custom marker icons that will be initialized on the client side
	const defaultIcon = useRef<any>(null);
	const selectedIcon = useRef<any>(null);
	const interactedIcon = useRef<any>(null);

	// Initialize Leaflet icons on the client side
	useEffect(() => {
		// Only import and initialize Leaflet on the client side
		const L = require('leaflet');

		defaultIcon.current = new L.Icon({
			iconUrl:
				'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
			shadowUrl:
				'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
			shadowSize: [41, 41],
		});

		selectedIcon.current = new L.Icon({
			iconUrl:
				'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
			iconSize: [35, 57],
			iconAnchor: [17, 57],
			popupAnchor: [1, -34],
			shadowUrl:
				'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
			shadowSize: [41, 41],
			className: 'selected-marker',
		});

		// Create a custom icon for interacted events
		interactedIcon.current = new L.Icon({
			iconUrl:
				'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
			shadowUrl:
				'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
			shadowSize: [41, 41],
			className: 'interacted-marker',
		});

		// Add custom CSS for the markers
		const style = document.createElement('style');
		style.innerHTML = `
			.interacted-marker {
				filter: hue-rotate(100deg) brightness(1.1);
			}
			.selected-marker {
				filter: brightness(1.3);
				z-index: 1000 !important;
			}
		`;
		document.head.appendChild(style);
	}, []);

	const { user, authUser, loading: authLoading } = useAuth();
	const [searchVisible, setSearchVisible] = useState<boolean>(true);
	const [topic, setTopic] = useState<string>('');
	const [currentEvents, setCurrentEvents] = useState<Event[]>([]);
	const [chosenEvents, setChosenEvents] = useState<Event[]>([]);
	const [unchosenEvents, setUnchosenEvents] = useState<Event[]>([]);
	const [events, setEvents] = useState<Event[]>([]);
	const [interactedEventIds, setInteractedEventIds] = useState<Set<string>>(
		new Set(),
	);
	const [highlightedLocations, setHighlightedLocations] = useState<
		Set<string>
	>(new Set());
	const [yearRange, setYearRange] = useState<[number, number]>([
		-10000, 2025,
	]);
	const [loading, setLoading] = useState<boolean>(false);
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);
	const [filterSubject, setFilterSubject] = useState<string | null>(null);
	const [searchInputRef, setSearchInputRef] =
		useState<HTMLInputElement | null>(null);
	const searchInputRefCallback = useCallback(
		(el: HTMLInputElement | null) => {
			setSearchInputRef(el);
		},
		[],
	);
	const [pathOptions, setPathOptions] = useState<Event[]>([]);
	const [showWelcomeBack, setShowWelcomeBack] = useState<boolean>(true);
	const [lastEvent, setLastEvent] = useState<Event | null>(null);
	const fetchEventsCallback = useCallback(
		async (
			topic: string,
			title: string,
			year?: number,
			onEventsFetched?: (newEvents: Event[]) => void,
			isAdditionalEvent: boolean = false,
		) => {
			setLoading(true);

			try {
				console.log('Search Parameters:', {
					topic,
					title,
					year,
					isAdditionalEvent,
				});

				// Get current user
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (!user?.id) {
					console.error('No user ID found');
					return;
				}

				// Step 1: Build exclusion list from all three sources
				const excludedIds = [
					...Array.from(interactedEventIds),
					...chosenEvents.map(event => event.id),
					...unchosenEvents.map(event => event.id),
				];

				// Always exclude the selected event to prevent self-fetching
				if (selectedEvent) {
					if (!excludedIds.includes(selectedEvent.id)) {
						excludedIds.push(selectedEvent.id);
					}
					console.log(
						'Excluding selected event ID:',
						selectedEvent.id,
					);
				}

				// For additional event, we need to limit to just 1
				const limitCount = isAdditionalEvent ? 1 : 2;
				console.log(`Setting limit to ${limitCount} events`);
				console.log('Total excluded IDs:', excludedIds.length);

				// Handle the case where no IDs are found
				if (excludedIds.length === 0) {
					console.log('No events to exclude');
				} else {
					console.log(
						'Sample of excluded IDs:',
						excludedIds.slice(0, 3),
					);
				}

				// Step 2: Build database query with all filters
				let query = supabase
					.from('events')
					.select('*')
					.order('year', { ascending: true });

				// Add year filter if provided
				if (year !== undefined) {
					query = query.gte('year', year);
				}

				// Add title filter if provided
				if (title) {
					// Use fuzzy search instead of exact match
					query = query.textSearch('title', title, {
						type: 'plain',
						config: 'english',
					});
				}

				// CRITICAL: Exclude already seen events with proper SQL syntax
				if (excludedIds.length > 0) {
					// Use a more explicit NOT IN syntax
					const notInClause = `(${excludedIds.map(id => `'${id}'`).join(',')})`;
					console.log('NOT IN clause:', notInClause);

					// Apply the NOT IN filter
					query = query.not('id', 'in', notInClause);
				}

				// Limit results
				query = query.limit(limitCount);

				// Log query information - since we can't access the internal query parameters
				console.log('Query constructed with:', {
					excludedIds: excludedIds.length,
					yearFilter: year,
					title,
					limitCount,
				});

				// Step 3: Execute query
				const { data, error } = await query;

				if (error) {
					throw new Error(`Database query failed: ${error.message}`);
				}

				console.log(
					'Query results:',
					data?.length || 0,
					'events found',
				);
				if (data?.length) {
					console.log(
						'Result IDs:',
						data.map(e => e.id),
					);
				}

				// Step 4: Handle results or fallback to OpenAI
				let newEvents: Event[] = [];

				if (data && data.length > 0) {
					// We got events from the database
					newEvents = data;

					// Double-check that we're not fetching the selected event
					if (selectedEvent) {
						newEvents = newEvents.filter(
							event => event.id !== selectedEvent.id,
						);
					}

					if (newEvents.length === 0) {
						console.warn(
							'All fetched events were filtered out by client-side checks',
						);
					}
				} else {
					// No results from database, try OpenAI
					const response = await fetch('/api/generate-events', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							topic,
							title,
							year: year || null,
							count: limitCount,
						}),
					});

					if (!response.ok) {
						throw new Error(
							`API request failed: ${response.status}`,
						);
					}

					newEvents = await response.json();

					// Also filter these results to ensure no duplicates
					if (selectedEvent) {
						newEvents = newEvents.filter(
							event => event.id !== selectedEvent.id,
						);
					}
				}

				// Step 5: Update state based on context
				if (newEvents.length > 0) {
					// Filter out any events that already exist in our lists
					const uniqueEvents = newEvents.filter(
						event => !isEventAlreadyInLists(event.id),
					);

					if (uniqueEvents.length < newEvents.length) {
						console.log(
							`Filtered out ${newEvents.length - uniqueEvents.length} duplicate events`,
						);
					}

					if (uniqueEvents.length > 0) {
						if (isAdditionalEvent) {
							// Adding additional event - add new events to current events
							console.log(
								'Adding additional event to current events',
							);
							setCurrentEvents(current => [
								...current,
								...uniqueEvents,
							]);
						} else if (title && selectedEvent) {
							// Exploring from a selected event - add new events to current events
							console.log(
								'Adding related events to current events',
							);
							setCurrentEvents(current => [
								...current,
								...uniqueEvents,
							]);
						} else {
							// Initial search - set new events as current events
							console.log('Setting new events as current events');
							setCurrentEvents(uniqueEvents);
						}

						// Call the callback if provided
						if (onEventsFetched) {
							onEventsFetched(uniqueEvents);
						}
					} else {
						console.log('All events were filtered as duplicates');
						if (onEventsFetched) {
							onEventsFetched([]);
						}
					}
				} else {
					console.log('No events found');
					if (onEventsFetched) {
						onEventsFetched([]);
					}
				}
			} catch (error) {
				console.error('Error fetching events:', error);
			} finally {
				setLoading(false);
			}
		},
		[chosenEvents, interactedEventIds, selectedEvent, unchosenEvents],
	);

	// Add a ref to track which event IDs have been marked as interacted
	const markedInteractionsRef = useRef<Set<string>>(new Set());

	// Reference to the event panel component for scrolling
	const eventPanelRef = useRef<HTMLDivElement>(null);

	// Function to scroll to the selected event in the event panel
	const scrollToSelectedEvent = useCallback((eventId: string) => {
		if (!eventPanelRef.current) return;

		// Use setTimeout to ensure the DOM has updated
		setTimeout(() => {
			const eventElement = document.getElementById(`event-${eventId}`);
			if (eventElement) {
				eventElement.scrollIntoView({
					behavior: 'smooth',
					block: 'center',
				});
			}
		}, 100);
	}, []);

	// Function to update path data in database
	const updatePathData = useCallback(async () => {
		if (!user?.id) return;

		try {
			// Convert events to IDs for storage if they're not already
			const chosenEventIds = chosenEvents.map(event => event.id);
			const unchosenEventIds = unchosenEvents.map(event => event.id);
			const currentEventId = selectedEvent?.id;

			console.log(`[${mountId.current}] Updating path data with:`, {
				chosenEventIds,
				unchosenEventIds,
				currentEventId,
			});

			// Create path data object with both camelCase (client) and snake_case (database) properties
			// to ensure compatibility
			const pathData = {
				chosenEvents: chosenEventIds,
				chosen_events: chosenEventIds, // Store IDs for chosen events
				unchosenEvents: unchosenEventIds,
				unchosen_events: unchosenEventIds, // Store IDs for unchosen events
				currentEventId,
				current_event_id: currentEventId,
			};

			// Log the path data to be sent
			console.log(
				`[${mountId.current}] Path data to be sent:`,
				JSON.stringify(pathData),
			);

			// Send directly to Supabase for more control and to see the result
			const { data, error } = await supabase
				.from('user_paths')
				.upsert(
					{
						user_id: user.id,
						path_data: pathData,
						current_event_id: currentEventId,
						updated_at: new Date().toISOString(),
					},
					{ onConflict: 'user_id' },
				)
				.select();

			if (error) {
				throw error;
			}

			console.log(
				`[${mountId.current}] Updated path data in database:`,
				data,
			);
		} catch (error) {
			console.error(
				`[${mountId.current}] Error updating path data:`,
				error,
			);
		}
	}, [user?.id, chosenEvents, unchosenEvents, selectedEvent, mountId]);

	// Modify fetchUserPathData to take a parameter to control whether to set events
	const fetchUserPathData = useCallback(
		async (setCurrentPathEvents = true) => {
			if (!user?.id) return;

			try {
				const { data, error } = await supabase
					.from('user_paths')
					.select('*')
					.eq('user_id', user.id)
					.order('updated_at', { ascending: false })
					.limit(1);

				if (error) {
					throw error;
				}

				if (data && data.length > 0 && data[0].path_data) {
					const pathData = data[0].path_data;
					console.log(
						`[${mountId.current}] Retrieved path data:`,
						pathData,
					);

					// Only set events if requested (not on initial load)
					if (setCurrentPathEvents) {
						// Handle both camelCase and snake_case property naming
						const chosenEvents =
							pathData.chosen_events || pathData.chosenEvents;
						const unchosenEvents =
							pathData.unchosen_events || pathData.unchosenEvents;
						const currentEventId =
							pathData.current_event_id ||
							pathData.currentEventId;

						console.log(
							`[${mountId.current}] Setting path data - chosen events:`,
							chosenEvents ? chosenEvents.length : 0,
							'unchosen events:',
							unchosenEvents ? unchosenEvents.length : 0,
						);

						// Set chosen and unchosen events
						if (chosenEvents) {
							// If it's an array of IDs, fetch the full events
							if (
								chosenEvents.length > 0 &&
								typeof chosenEvents[0] === 'string'
							) {
								const { data: chosenEventsData } =
									await supabase
										.from('events')
										.select('*')
										.in('id', chosenEvents);

								if (chosenEventsData) {
									setChosenEvents(chosenEventsData);
								}
							} else {
								// It's already an array of event objects
								setChosenEvents(chosenEvents);
							}
						}

						if (unchosenEvents) {
							// If it's an array of IDs, fetch the full events
							if (
								unchosenEvents.length > 0 &&
								typeof unchosenEvents[0] === 'string'
							) {
								const { data: unchosenEventsData } =
									await supabase
										.from('events')
										.select('*')
										.in('id', unchosenEvents);

								if (unchosenEventsData) {
									setUnchosenEvents(unchosenEventsData);
								}
							} else {
								// It's already an array of event objects
								setUnchosenEvents(unchosenEvents);
							}
						}

						// Set current events if there's a current event ID
						if (currentEventId) {
							let currentEvent;

							// Try to find the event in chosen events first
							if (chosenEvents) {
								if (typeof chosenEvents[0] === 'string') {
									// If chosen events is just an array of IDs, fetch the current event
									const { data: eventData } = await supabase
										.from('events')
										.select('*')
										.eq('id', currentEventId)
										.single();

									currentEvent = eventData;
								} else {
									// Find the event object in the array of objects
									currentEvent = chosenEvents.find(
										(e: any) => e.id === currentEventId,
									);
								}
							}

							if (currentEvent) {
								// Set as selected event
								setSelectedEvent(currentEvent);
								// Add to current events
								setCurrentEvents([currentEvent]);
							}
						}
					}
				} else {
					console.log('No path data found for user');
				}
			} catch (error) {
				console.error('Error fetching path data:', error);
			}
		},
		[user?.id],
	);

	// Make fetchLastEvent a useCallback function
	const fetchLastEvent = useCallback(
		async (userId: string) => {
			try {
				// Only log once per function call
				console.log(`[${mountId.current}] Fetching last event...`);

				// Get path data from the database
				const { data: pathData, error: pathError } = await supabase
					.from('user_paths')
					.select('*')
					.eq('user_id', userId)
					.order('updated_at', { ascending: false })
					.limit(1);

				if (pathError) {
					console.error(
						`[${mountId.current}] Error fetching path data:`,
						pathError,
					);
					return null;
				}

				if (!pathData || pathData.length === 0) {
					console.log(`[${mountId.current}] No path data found`);
					return null;
				}

				// Check for current_event_id in different levels of the data structure
				let currentEventId =
					// First check root level
					pathData[0].current_event_id ||
					// Then check path_data object
					(pathData[0].path_data &&
						pathData[0].path_data.current_event_id);

				console.log(
					`[${mountId.current}] Current event ID:`,
					currentEventId,
				);

				// Check if we have chosen events
				const chosenEvents =
					pathData[0].path_data && pathData[0].path_data.chosen_events
						? pathData[0].path_data.chosen_events
						: [];

				console.log(
					`[${mountId.current}] Chosen events:`,
					chosenEvents,
				);

				// Fallback: If no current event ID but we have chosen events, use the last chosen event
				if (
					!currentEventId &&
					chosenEvents &&
					chosenEvents.length > 0
				) {
					currentEventId = chosenEvents[chosenEvents.length - 1];
					console.log(
						`[${mountId.current}] Using last chosen event as fallback:`,
						currentEventId,
					);
				}

				if (!currentEventId) {
					console.log(
						`[${mountId.current}] No current event ID found in path data`,
					);
					return null;
				}

				// Fetch the event from the database
				const { data: events, error } = await supabase
					.from('events')
					.select('*')
					.eq('id', currentEventId)
					.single();

				if (error) {
					console.error(
						`[${mountId.current}] Error fetching last event:`,
						error,
					);
					return null;
				}

				if (!events) {
					console.log(
						`[${mountId.current}] No event found with ID:`,
						currentEventId,
					);
					return null;
				}

				console.log(
					`[${mountId.current}] Last event found:`,
					events.title,
				);
				// Don't set state inside this function, return the event instead
				return events;
			} catch (error) {
				console.error(
					`[${mountId.current}] Error in fetchLastEvent:`,
					error,
				);
				return null;
			}
		},
		[supabase, mountId],
	);

	// Fix the useEffect for initialization to avoid double calls
	useEffect(() => {
		if (user && isFirstMount.current) {
			console.log(
				`[${mountId.current}] Initializing with user:`,
				user.id,
			);
			isFirstMount.current = false;

			// Fetch last event for welcome back
			fetchLastEvent(user.id)
				.then(event => {
					if (event) {
						setLastEvent(event);
						setShowWelcomeBack(true);
						console.log(
							`[${mountId.current}] Last event initialization complete: Found:`,
							event.title,
						);
					} else {
						console.log(
							`[${mountId.current}] Last event initialization complete: No event found`,
						);
					}
				})
				.catch(err => {
					console.error(
						`[${mountId.current}] Error initializing last event:`,
						err,
					);
				});

			// Still fetch path data, but don't automatically set events
			fetchUserPathData(false);
		}
	}, [user, fetchUserPathData, fetchLastEvent, mountId]);

	// Record event interaction in database
	const recordEventInteraction = async (
		eventId: string,
		previousEventId?: string,
	) => {
		try {
			if (!user?.id) {
				console.log(
					'User not logged in, skipping interaction recording',
				);
				return;
			}

			// If we've already recorded this event, don't record it again
			if (interactedEventIds.has(eventId)) {
				return;
			}

			const response = await fetch('/api/event-interactions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userId: user.id,
					eventId,
					previousEventId,
					interactionType: 'fetch_more',
				}),
			});

			if (!response.ok) {
				throw new Error('Failed to record event interaction');
			}

			// Add to interacted event IDs set
			setInteractedEventIds(prev => new Set([...prev, eventId]));
			console.log(`Recorded interaction with event ${eventId}`);
		} catch (error) {
			console.error('Error recording event interaction:', error);
		}
	};

	// Update event connection in database
	const updateNextEvent = async (
		sourceEventId: string,
		targetEventId: string,
	) => {
		try {
			// Don't update if source and target are the same
			if (sourceEventId === targetEventId) {
				return;
			}

			// Get the current user's ID
			const userId = user?.id;
			if (!userId) {
				console.log('User not logged in, skipping next event update');
				return;
			}

			// Send the update to the API
			const response = await fetch('/api/event-connections', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userId,
					sourceEventId,
					targetEventId,
				}),
			});

			if (!response.ok) {
				throw new Error('Failed to update next event');
			}

			console.log(
				`Updated connection: ${sourceEventId} -> ${targetEventId}`,
			);
		} catch (error) {
			console.error('Error updating next event:', error);
		}
	};

	// Utility function to check if an event already exists in any of our lists
	const isEventAlreadyInLists = useCallback(
		(eventId: string) => {
			return (
				currentEvents.some(e => e.id === eventId) ||
				chosenEvents.some(e => e.id === eventId) ||
				unchosenEvents.some(e => e.id === eventId) ||
				selectedEvent?.id === eventId
			);
		},
		[currentEvents, chosenEvents, unchosenEvents, selectedEvent],
	);

	// Utility to safely add an event to a list without duplicating
	const addEventToList = useCallback((event: Event, list: Event[]) => {
		if (!list.some(e => e.id === event.id)) {
			return [...list, event];
		}
		return list;
	}, []);

	// Update handleSelectEvent to use these utilities
	const handleSelectEvent = useCallback(
		(event: Event) => {
			// Get the ID of the previously selected event (if any)
			const previousEventId = selectedEvent?.id;

			// Set the selected event to update the UI
			setSelectedEvent(event);

			// Scroll to the event in the sidebar
			scrollToSelectedEvent(event.id);

			// Record the interaction
			recordEventInteraction(event.id, previousEventId);

			// If coming from another event, update the navigation path
			if (previousEventId && event.id !== previousEventId) {
				updateNextEvent(previousEventId, event.id);
			}

			// Add the selected event to chosenEvents if not already there
			setChosenEvents(prev => addEventToList(event, prev));

			// Note: We no longer remove other events here
			// They will stay visible until "Explore Related Events" is clicked
		},
		[
			selectedEvent,
			scrollToSelectedEvent,
			recordEventInteraction,
			updateNextEvent,
			addEventToList,
		],
	);

	// If user is not authenticated, redirect to login
	useEffect(() => {
		if (!authUser && !authLoading) {
			router.push('/login');
		}
	}, [authUser, authLoading, router]);

	// Effect to blur input when loading
	useEffect(() => {
		if (loading && searchInputRef) {
			searchInputRef.blur();
		}
	}, [loading, searchInputRef]);

	// Effect to mark interacted events after events are loaded
	useEffect(() => {
		if (events.length > 0 && interactedEventIds.size > 0) {
			// Find IDs that haven't been marked yet
			const unmarkedIds = new Set(
				[...interactedEventIds].filter(
					id => !markedInteractionsRef.current.has(id),
				),
			);

			// If there are new IDs to mark
			if (unmarkedIds.size > 0) {
				const updatedEvents = markInteractedEvents(
					events,
					interactedEventIds,
				);

				// Update ref with all current interacted IDs
				markedInteractionsRef.current = new Set(interactedEventIds);

				// Update events
				setEvents(updatedEvents);
			}
		}
	}, [interactedEventIds, events.length]);

	// Effect to sync events and currentEvents
	useEffect(() => {
		setEvents(currentEvents);
	}, [currentEvents]);

	const fetchUserInteractions = async (userId: string) => {
		try {
			const response = await fetch(
				`/api/event-interactions?userId=${userId}`,
			);
			if (response.ok) {
				const data = await response.json();
				setInteractedEventIds(new Set(data.interactedEventIds));
			}
		} catch (error) {
			console.error('Error fetching user interactions:', error);
		}
	};

	const handleFilterChange = useCallback((subject: string | null) => {
		setFilterSubject(subject);
	}, []);

	const fetchMoreEvents = () => {
		console.log('fetchMoreEvents called');
		console.log('Current events:', currentEvents.length);
		console.log('Selected event:', selectedEvent?.title);
		console.log('Selected event ID:', selectedEvent?.id);

		// Only proceed if explicitly requested through a UI action
		if (selectedEvent) {
			console.log(
				`Fetching more events related to ${selectedEvent.title}`,
			);

			// Now move unselected events to unchosenEvents
			const otherEvents = currentEvents.filter(
				e => e.id !== selectedEvent.id,
			);
			if (otherEvents.length > 0) {
				setUnchosenEvents(prev => [...prev, ...otherEvents]);
				// Should always be 1
				console.log(
					`Moving ${otherEvents.length} unselected events to unchosenEvents`,
				);

				// Keep only the selected event in the current list when exploring more
				setCurrentEvents([selectedEvent]);
				console.log(
					'Current events now contains only the selected event',
				);

				// Update the path data in the database
				updatePathData();
			}

			// Record this interaction
			recordEventInteraction(selectedEvent.id, selectedEvent.id);

			fetchEventsCallback(
				`related to ${selectedEvent.title}`,
				selectedEvent.title,
				selectedEvent.year,
				newEvents => {
					console.log(
						`Received ${newEvents.length} new events related to ${selectedEvent.title}`,
					);
					console.log(
						'New event IDs:',
						newEvents.map(e => e.id),
					);
				},
			);
		} else {
			console.log('No selected event, fetching with topic:', topic);
			// No year filter in the fetch - we'll filter on the client side
			fetchEventsCallback(topic, '', undefined, newEvents => {
				console.log(
					`Received ${newEvents.length} new events for topic: ${topic}`,
				);
			});
		}
	};

	const togglePanel = () => {
		setIsPanelCollapsed(!isPanelCollapsed);
	};

	// Filter events for display based on subject
	const filteredEvents = filterSubject
		? currentEvents.filter(event => event.subject === filterSubject)
		: currentEvents;

	// Update year filtering to also filter the already-filtered events by subject
	const displayedEvents = filteredEvents.filter(
		event => event.year >= yearRange[0] && event.year <= yearRange[1],
	);

	const shouldShowWelcomeBack = (
		lastEvent: Event | null,
		currentEvents: Event[],
	) => {
		// Show welcome back if:
		// 1. We have a last event
		// 2. AND either we have no current events OR we haven't explicitly hidden it
		return !!lastEvent && (currentEvents.length === 0 || showWelcomeBack);
	};

	const handleContinueExploration = useCallback(() => {
		if (lastEvent) {
			console.log('Continuing exploration with event:', lastEvent.title);

			// If we don't have any current events, set the last event as the current event
			if (currentEvents.length === 0) {
				console.log('Setting last event as current event');
				setCurrentEvents([lastEvent]);
			}

			// Set the selected event
			setSelectedEvent(lastEvent);

			// Add to chosen events using our utility
			setChosenEvents(prev => addEventToList(lastEvent, prev));

			// Fetch one additional new event related to the last event
			// Important: Set isAdditionalEvent to true
			fetchEventsCallback(
				`related to ${lastEvent.title}`,
				lastEvent.title,
				lastEvent.year,
				newEvents => {
					console.log(
						`Found ${newEvents.length} additional events to display with ${lastEvent.title}`,
					);
					if (newEvents.length === 0) {
						// If no related events found, try a more general search
						console.log(
							'No related events found, trying a more general search',
						);
						fetchEventsCallback(
							lastEvent.subject,
							'',
							undefined,
							generalEvents => {
								console.log(
									`Found ${generalEvents.length} general events for subject ${lastEvent.subject}`,
								);
							},
							true,
						);
					}
				},
				true, // This is an additional event fetch
			);
		} else {
			console.warn('Cannot continue: No last event available');
		}

		// Hide the welcome back dialog
		setShowWelcomeBack(false);
	}, [
		currentEvents,
		lastEvent,
		fetchEventsCallback,
		setChosenEvents,
		setCurrentEvents,
		setSelectedEvent,
		setShowWelcomeBack,
	]);

	const handleNewSearch = () => {
		// Reset everything
		setCurrentEvents([]);
		setChosenEvents([]);
		setUnchosenEvents([]);
		setSelectedEvent(null);

		// Hide the welcome back dialog
		setShowWelcomeBack(false);
	};

	// Add a useEffect to log when the component renders
	useEffect(() => {
		console.log('App component mounted - initial state:');
		console.log('showWelcomeBack:', showWelcomeBack);
		console.log('lastEvent:', lastEvent?.title);
	}, []);

	// Add a dedicated useEffect for lastEvent changes
	useEffect(() => {
		// Debounce log output to reduce noise
		const logTimeout = setTimeout(() => {
			console.log(
				`[${mountId.current}] lastEvent changed:`,
				lastEvent?.title,
			);

			if (lastEvent) {
				console.log(
					`[${mountId.current}] Setting showWelcomeBack to true because we have a lastEvent`,
				);
				// Only set showWelcomeBack if we're not already showing events
				if (currentEvents.length === 0) {
					setShowWelcomeBack(true);
				}
			}
		}, 50);

		return () => clearTimeout(logTimeout);
	}, [lastEvent, currentEvents.length]);

	// Fix the debounced render log effect
	useEffect(() => {
		renderCountRef.current += 1;

		const logTimeout = setTimeout(() => {
			console.log(
				`[${mountId.current}] Render #${renderCountRef.current}:`,
				{
					showWelcomeBack,
					hasLastEvent: !!lastEvent,
					lastEventTitle: lastEvent?.title,
					isLoading: loading,
					eventsCount: currentEvents.length,
				},
			);
		}, 100);

		return () => clearTimeout(logTimeout);
	}, [showWelcomeBack, lastEvent, loading, currentEvents.length, mountId]);

	if (authLoading) {
		return (
			<div className="container mx-auto p-6">
				<div className="bg-amber-50 dark:bg-stone-900 border-2 border-amber-700 dark:border-amber-800 rounded-lg shadow-md fixed bottom-4 left-2 text-stone-800 dark:text-amber-100 py-3 px-4 z-10 pointer-events-none">
					Loading user data. Please wait.
				</div>
			</div>
		);
	}

	if (!authUser) {
		return (
			<div className="container mx-auto p-6 flex flex-col items-center justify-center min-h-screen">
				<div className="bg-amber-50 dark:bg-stone-900 border-2 border-amber-700 dark:border-amber-800 rounded-lg shadow-md p-8 max-w-lg">
					<h1 className="text-3xl font-bold mb-6 text-center text-stone-800 dark:text-amber-100">
						History Map
					</h1>
					<p className="mb-4 text-center text-stone-700 dark:text-amber-200">
						Please sign in to explore the ancient world.
					</p>
					<div className="flex justify-center">
						<Link
							href="/login"
							className="px-6 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition-colors"
						>
							Sign In
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="container-fluid">
			{/* Render welcome back when appropriate */}
			{shouldShowWelcomeBack(lastEvent, currentEvents) && (
				<WelcomeBack
					lastEvent={lastEvent!}
					onContinue={handleContinueExploration}
					onNewSearch={handleNewSearch}
				/>
			)}

			{loading && (
				<div className="bg-amber-50 dark:bg-stone-900 border-2 border-amber-700 dark:border-amber-800 rounded-lg shadow-md fixed bottom-4 left-2 text-stone-800 dark:text-amber-100 py-3 px-4 z-30 pointer-events-none flex items-center gap-2">
					<div className="animate-spin h-4 w-4 border-2 border-amber-700 dark:border-amber-800 rounded-full border-t-transparent"></div>
					<span>Loading. Please wait.</span>
				</div>
			)}

			<div className="relative w-full h-[calc(100vh-4rem)]">
				{/* Side panel */}
				<div
					className={`bg-amber-50/95 dark:bg-stone-900/95 backdrop-blur-md fixed top-16 h-[calc(100vh-4rem)] z-40 transition-all duration-300 border-r-2 border-amber-700 dark:border-amber-800 ${
						isPanelCollapsed ? 'w-12 -left-2' : 'w-64 left-0'
					}`}
				>
					<button
						onClick={togglePanel}
						className="h-10 w-10 rounded-full bg-amber-700 dark:bg-amber-800 text-white flex items-center justify-center absolute -right-5 top-4 z-10 hover:bg-amber-800 dark:hover:bg-amber-700 transition-colors"
					>
						{isPanelCollapsed ? '→' : '←'}
					</button>

					<div
						className={`p-4 ${
							isPanelCollapsed ? 'opacity-0' : 'opacity-100'
						} transition-opacity duration-300 h-full flex flex-col overflow-y-auto`}
						ref={eventPanelRef}
					>
						<EventPanel
							events={displayedEvents}
							onSelectEvent={handleSelectEvent}
							pathOptions={pathOptions}
							selectedEvent={selectedEvent}
						/>
						<InformationPanel
							event={selectedEvent}
							onFetchMore={
								selectedEvent ? fetchMoreEvents : undefined
							}
						/>
					</div>
				</div>

				{/* Map container */}
				<div className="w-full h-full relative">
					<div className="bg-amber-50 dark:bg-stone-900 border-2 border-amber-700 dark:border-amber-800 rounded-lg shadow-md absolute top-4 left-[calc(16rem+1rem)] right-4 z-30 flex flex-col justify-center items-center gap-2 py-2 px-4">
						<label className="text-stone-800 dark:text-amber-100">
							Year Range: {yearRange[0]} - {yearRange[1]}
						</label>
						<Slider
							range
							min={-10000}
							max={new Date().getFullYear()}
							step={5}
							value={yearRange}
							onChange={value => {
								if (
									Array.isArray(value) &&
									value.length === 2
								) {
									setYearRange([value[0], value[1]]);
								}
							}}
						/>
					</div>

					{/* Search Toolbar - Collapsible */}
					<div
						className={`bg-amber-50 dark:bg-stone-900 border-2 border-amber-700 dark:border-amber-800 rounded-lg shadow-md absolute top-20 left-[calc(16rem+1rem)] right-4 z-30 transition-all duration-300 overflow-hidden ${
							searchVisible
								? 'py-3 px-4 max-h-32'
								: 'max-h-8 py-1 px-4'
						}`}
					>
						<div
							className="w-full flex justify-between items-center cursor-pointer mb-2"
							onClick={() => setSearchVisible(!searchVisible)}
						>
							<span className="text-stone-800 dark:text-amber-100 font-semibold flex-grow text-center">
								Search Historical Topics
							</span>
							<span className="text-amber-700 dark:text-amber-500">
								{searchVisible ? '▲' : '▼'}
							</span>
						</div>

						<form
							className={`flex flex-col gap-2 transition-opacity duration-300 ${
								searchVisible
									? 'opacity-100'
									: 'opacity-0 pointer-events-none'
							}`}
							onSubmit={e => {
								e.preventDefault();
								fetchMoreEvents();
							}}
						>
							<div className="flex gap-2">
								<input
									type="text"
									id="topic"
									name="topic"
									value={topic}
									placeholder="Search a Topic"
									onChange={e => setTopic(e.target.value)}
									className={`border border-amber-700 dark:border-amber-600 bg-amber-50 dark:bg-stone-800 p-2 rounded flex-grow text-stone-800 dark:text-amber-100 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
									disabled={loading}
									ref={searchInputRefCallback}
								/>
								<button
									type="submit"
									className={`bg-amber-700 hover:bg-amber-800 text-white transition-colors p-2 rounded whitespace-nowrap ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
									disabled={loading}
								>
									{loading ? (
										<div className="flex items-center gap-1">
											<div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
											<span>Searching...</span>
										</div>
									) : (
										'Search'
									)}
								</button>
							</div>
						</form>
					</div>

					<MapContainer
						center={[51.5074, -0.1276]}
						zoom={3}
						scrollWheelZoom={true}
						className="leaflet-container"
						attributionControl={true}
						zoomControl={true}
					>
						{/* Using a working vintage-style map */}
						<TileLayer
							url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
							attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
						/>
						<AdjustMapView events={displayedEvents} />
						{displayedEvents.map((event, index) => (
							<Marker
								key={index}
								position={[event.lat, event.lon]}
								icon={
									selectedEvent?.id === event.id
										? selectedIcon.current
										: event.interacted
											? interactedIcon.current
											: defaultIcon.current
								}
								eventHandlers={{
									click: () => {
										handleSelectEvent(event);
										setIsPanelCollapsed(false);
									},
								}}
							>
								<Popup>
									<div>
										<h3 className="font-semibold">
											{event.title}
										</h3>
										<p className="text-sm">{event.year}</p>
										<p className="text-xs mt-1">
											{event.subject}
										</p>
									</div>
								</Popup>
							</Marker>
						))}
					</MapContainer>

					<div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30">
						<SubjectFilterBar
							events={events}
							onFilterChange={handleFilterChange}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

export default App;
