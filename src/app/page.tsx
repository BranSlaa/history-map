'use client';

import React, {
	useState,
	useEffect,
	useRef,
	useCallback,
	useMemo,
} from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { Event } from '@/types/event';
import EventPanel from './components/EventPanel';
import InformationPanel from './components/InformationPanel';
import SubjectFilterBar from './components/SubjectFilterBar';
import {
	markInteractedEvents,
	createFetchLastEvent,
	createUpdatePathData,
	createFetchUserPathData,
	addEventToList,
	shouldShowWelcomeBack as shouldShowWelcomeBackUtil,
} from '@/utils/eventUtils';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import WelcomeBack from './components/WelcomeBack';
import { Header } from './components/Header';
import { AdjustMapView } from '@/components/map/AdjustMapView';
import {
	createMapIcons,
	addMapMarkerStyles,
	getEventMarkerIcon,
} from '@/utils/mapUtils';

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

const App = () => {
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
		const icons = createMapIcons();
		defaultIcon.current = icons.defaultIcon;
		selectedIcon.current = icons.selectedIcon;
		interactedIcon.current = icons.interactedIcon;

		// Add marker styles
		addMapMarkerStyles();
	}, []);

	const { user, authUser, loading: authLoading } = useAuth();
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

	// Near the component state initialization, create the utility functions with supabase
	const fetchLastEventFn = useMemo(
		() => createFetchLastEvent(supabase),
		[supabase],
	);
	const updatePathDataFn = useMemo(
		() => createUpdatePathData(supabase),
		[supabase],
	);
	const fetchUserPathDataFn = useMemo(
		() => createFetchUserPathData(supabase),
		[supabase],
	);

	// Utility function to check if an event already exists in any of our lists
	const isEventAlreadyInLists = useCallback(
		(eventId: string) => {
			return (
				currentEvents.some(e => e.id === eventId) ||
				chosenEvents.some(e => e.id === eventId) ||
				unchosenEvents.some(e => e.id === eventId)
			);
		},
		[currentEvents, chosenEvents, unchosenEvents],
	);

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

	// Replace the updatePathData function with a wrapper around the utility
	const updatePathData = useCallback(async () => {
		if (!user?.id) return;
		return updatePathDataFn(
			user.id,
			chosenEvents,
			unchosenEvents,
			selectedEvent,
			mountId,
		);
	}, [
		user?.id,
		chosenEvents,
		unchosenEvents,
		selectedEvent,
		mountId,
		updatePathDataFn,
	]);

	// Replace fetchUserPathData with a wrapper around the utility
	const fetchUserPathData = useCallback(
		async (setCurrentPathEvents = true) => {
			if (!user?.id) return;

			return fetchUserPathDataFn(
				user.id,
				mountId,
				setCurrentPathEvents
					? {
							onChosenEvents: setChosenEvents,
							onUnchosenEvents: setUnchosenEvents,
							onCurrentEvents: setCurrentEvents,
						}
					: undefined,
			);
		},
		[
			user?.id,
			mountId,
			fetchUserPathDataFn,
			setChosenEvents,
			setUnchosenEvents,
			setCurrentEvents,
		],
	);

	// Replace the shouldShowWelcomeBack function with the utility
	const shouldShowWelcomeBack = (
		lastEvent: Event | null,
		currentEvents: Event[],
	) => {
		return shouldShowWelcomeBackUtil(
			lastEvent,
			currentEvents,
			showWelcomeBack,
		);
	};

	// Replace fetchLastEvent with a wrapper around the utility
	const fetchLastEvent = useCallback(
		async (userId: string) => {
			const event = await fetchLastEventFn(userId, mountId);
			if (event) {
				setLastEvent(event);
				setShowWelcomeBack(true);
			}
			return event;
		},
		[fetchLastEventFn, mountId, setLastEvent, setShowWelcomeBack],
	);

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
	}, [user, fetchLastEvent, fetchUserPathData, mountId]);

	// Add this useEffect to debug the events
	useEffect(() => {
		console.log('Main events array updated, length:', events.length);
		if (events.length > 0) {
			console.log('Sample event:', events[0]);
			console.log(
				'Events with subjects:',
				events.filter(e => e.subject).length,
			);
			console.log(
				'Unique subjects:',
				Array.from(
					new Set(events.filter(e => e.subject).map(e => e.subject)),
				),
			);
		}
	}, [events]);

	return (
		<div className="grid grid-cols-12 grid-rows-[auto_1fr_1fr] h-screen">
			{/* Header row - spans all columns */}
			<div className="col-span-12">
				<Header />
			</div>

			{/* Sidebar - Event Panel */}
			<div
				className={`col-span-12  md:row-span-2 ${isPanelCollapsed ? 'md:col-span-1' : 'md:col-span-3'}  bg-white dark:bg-gray-800 shadow-lg relative`}
			>
				<div className="h-full flex">
					<div className="p-2 flex-grow overflow-y-auto">
						<div ref={eventPanelRef}>
							<EventPanel
								events={currentEvents}
								selectedEvent={selectedEvent}
								onSelectEvent={handleSelectEvent}
								pathOptions={pathOptions}
							/>
							<InformationPanel
								event={selectedEvent}
								onFetchMore={fetchMoreEvents}
							/>
						</div>
					</div>
					<button
						onClick={togglePanel}
						className="bg-blue-600 hover:bg-blue-700 text-white w-12 flex items-center justify-center absolute right-0 top-1/2 transform -translate-y-1/2"
					>
						{isPanelCollapsed ? '→' : '←'}
					</button>
				</div>
			</div>

			{/* Main map area */}
			<div className="col-span-12 md:col-span-9 relative md:row-span-2">
				{/* Welcome Back component - overlay on map */}
				{shouldShowWelcomeBack(lastEvent, currentEvents) && (
					<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl flex justify-center items-center">
						<WelcomeBack
							lastEvent={lastEvent}
							onContinue={handleContinueExploration}
							onNewSearch={handleNewSearch}
							fetchEventsCallback={fetchEventsCallback}
							topic={topic}
							setTopic={setTopic}
						/>
					</div>
				)}

				{/* Year filter slider - overlay on bottom of map */}
				<div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-2xl">
					<div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg px-4 py-8 mx-2">
						<Slider
							range
							min={-10000}
							max={2025}
							defaultValue={[-10000, 2025]}
							value={yearRange}
							onChange={value =>
								setYearRange(value as [number, number])
							}
							marks={{
								'-10000': '10000 BCE',
								'-5000': '5000 BCE',
								'-2000': '2000 BCE',
								'0': '0',
								'1000': '1000 CE',
								'2000': '2000 CE',
							}}
						/>
					</div>
				</div>

				{/* Subject filter bar - overlay on left side of map */}
				<div className="absolute bottom-4 left-4 z-20 w-fit">
					<SubjectFilterBar
						events={events}
						onFilterChange={handleFilterChange}
					/>
				</div>

				{/* Map container */}
				<div className="h-full w-full">
					<ClientOnly>
						<MapContainer
							center={[20, 0]}
							zoom={2}
							style={{ height: '100%', width: '100%' }}
							className="z-0"
						>
							<TileLayer
								url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
								attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
							/>
							<AdjustMapView events={displayedEvents} />
							{/* Use a Set to track rendered event IDs and prevent duplicates */}
							{(() => {
								// Create a Set to track which event IDs we've already rendered
								const renderedEventIds = new Set();

								// Filter out duplicate events
								return events
									.filter(event => {
										if (renderedEventIds.has(event.id)) {
											return false; // Skip this event, it's a duplicate
										}
										renderedEventIds.add(event.id);
										return true;
									})
									.map(event => (
										<Marker
											key={event.id}
											position={[
												event.lat || 0,
												event.lon || 0,
											]}
											icon={getEventMarkerIcon(
												event,
												selectedEvent?.id || null,
												interactedEventIds,
												{
													defaultIcon:
														defaultIcon.current,
													selectedIcon:
														selectedIcon.current,
													interactedIcon:
														interactedIcon.current,
												},
											)}
											eventHandlers={{
												click: () => {
													handleSelectEvent(event);
												},
											}}
										>
											<Popup>
												<div>
													<h3 className="font-bold">
														{event.title}
													</h3>
													<p>{event.year}</p>
												</div>
											</Popup>
										</Marker>
									));
							})()}
						</MapContainer>
					</ClientOnly>
				</div>
			</div>
		</div>
	);
};

// Add ClientOnly component at the top level of your file
const ClientOnly = ({ children }: { children: React.ReactNode }) => {
	const [hasMounted, setHasMounted] = useState(false);

	useEffect(() => {
		setHasMounted(true);
	}, []);

	if (!hasMounted) {
		return null;
	}

	return <>{children}</>;
};

export default App;
