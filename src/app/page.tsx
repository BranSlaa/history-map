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
import { fetchMoreEvents, fetchEvents } from '@/utils/eventFetchUtils';
import {
	recordEventInteraction,
	updateNextEvent,
	fetchUserInteractions,
} from '@/utils/interactionUtils';
import {
	handleContinueExploration,
	handleNewSearch,
} from '@/utils/navigationUtils';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import WelcomeBack from './components/WelcomeBack';
import { Header } from './components/Header';
import { AdjustMapView } from '@/components/map/AdjustMapView';
import FeaturedQuizzes from './components/FeaturedQuizzes';
import {
	createMapIcons,
	addMapMarkerStyles,
	getEventMarkerIcon,
} from '@/utils/mapUtils';
import ClientOnly from '@/components/ClientOnly';
import { useLogger } from '@/hooks/useLogger';
import { useEvents } from '@/hooks/useEvents';
import { scrollToSelectedEvent, centerMapOnEvent } from '@/utils/uiUtils';

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

	// Add initialization loading state
	const [isInitializing, setIsInitializing] = useState(true);

	// Reference for map
	const mapRef = useRef<any>(null);

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
	const [loading, setLoading] = useState<boolean>(false);
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
	const [showWelcomeBack, setShowWelcomeBack] = useState<boolean>(true);
	const [lastEvent, setLastEvent] = useState<Event | null>(null);
	const [yearRange, setYearRange] = useState<[number, number]>([
		-10000, 2025,
	]);
	const [highlightedLocations, setHighlightedLocations] = useState<
		Set<string>
	>(new Set());

	// Use our custom hooks
	const {
		selectedEvent,
		setSelectedEvent,
		currentEvents,
		setCurrentEvents,
		chosenEvents,
		setChosenEvents,
		unchosenEvents,
		setUnchosenEvents,
		interactedEventIds,
		setInteractedEventIds,
		events,
		setEvents,
		isEventAlreadyInLists,
		handleSelectEvent,
		syncEvents,
	} = useEvents(user?.id, {
		onEventSelected: event => {
			if (mapRef.current) {
				centerMapOnEvent(mapRef.current, event);
			}
		},
	});

	// Extract unique subjects from events using useMemo for performance
	const uniqueSubjects = useMemo(() => {
		return Array.from(
			new Set(
				(events || [])
					.filter(event => event && event.subject)
					.map(event => event.subject),
			),
		)
			.filter(Boolean)
			.sort();
	}, [events]);

	const { isFirstMount } = useLogger(
		mountId,
		showWelcomeBack,
		lastEvent,
		loading,
		currentEvents,
		events,
	);

	// Near the component state initialization, create the utility functions with supabase
	const fetchLastEventFn = useMemo(() => createFetchLastEvent(supabase), []);
	const updatePathDataFn = useMemo(() => createUpdatePathData(supabase), []);
	const fetchUserPathDataFn = useMemo(
		() => createFetchUserPathData(supabase),
		[],
	);

	// Add a ref to track which event IDs have been marked as interacted
	const markedInteractionsRef = useRef<Set<string>>(new Set());

	// Reference to the event panel component for scrolling
	const eventPanelRef = useRef<HTMLDivElement>(null);

	// Replace the updatePathData function with a wrapper around the utility
	const updatePathData = useCallback(async () => {
		if (!user?.id) return;
		try {
			await updatePathDataFn(
				user.id,
				chosenEvents,
				unchosenEvents,
				selectedEvent,
				mountId,
			);
		} catch (error) {
			console.error('Error updating path data:', error);
		}
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

			try {
				await fetchUserPathDataFn(
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
			} catch (error) {
				console.error('Error fetching user path data:', error);
			}
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

	// Wrapper for recordEventInteraction
	const recordEventInteractionWrapper = useCallback(
		(eventId: string, previousEventId?: string) => {
			recordEventInteraction(
				eventId,
				user?.id,
				interactedEventIds,
				setInteractedEventIds,
				previousEventId,
			);
		},
		[user?.id, interactedEventIds, setInteractedEventIds],
	);

	// Wrapper for fetchEventsCallback
	const fetchEventsCallbackWrapper = useCallback(
		(
			topic: string,
			title: string,
			year?: number,
			onEventsFetched?: (newEvents: Event[]) => void,
			isAdditionalEvent: boolean = false,
		) => {
			// Create a fetchEvents instance with the correct parameters
			const fetchEventsInstance = fetchEvents(
				setLoading,
				setCurrentEvents,
				currentEvents,
			);

			// Call the fetchEvents function with all parameters
			return fetchEventsInstance(
				topic,
				title,
				year,
				onEventsFetched,
				chosenEvents,
				unchosenEvents,
				selectedEvent,
			);
		},
		[
			setLoading,
			setCurrentEvents,
			currentEvents,
			chosenEvents,
			unchosenEvents,
			selectedEvent,
		],
	);

	// Wrapper for fetchMoreEvents
	const fetchMoreEventsWrapper = useCallback(() => {
		fetchMoreEvents(
			currentEvents,
			selectedEvent,
			setUnchosenEvents,
			setChosenEvents,
			setCurrentEvents,
			updatePathData,
			recordEventInteractionWrapper,
			fetchEventsCallbackWrapper,
			topic,
			chosenEvents,
			unchosenEvents,
		);
	}, [
		currentEvents,
		selectedEvent,
		setUnchosenEvents,
		setCurrentEvents,
		updatePathData,
		recordEventInteractionWrapper,
		fetchEventsCallbackWrapper,
		topic,
		chosenEvents,
		unchosenEvents,
	]);

	// Wrapper for handleContinueExploration
	const handleContinueExplorationWrapper = useCallback(() => {
		handleContinueExploration(
			lastEvent,
			currentEvents,
			setCurrentEvents,
			setSelectedEvent,
			setChosenEvents,
			setShowWelcomeBack,
			fetchEventsCallbackWrapper,
			addEventToList,
		);
	}, [
		lastEvent,
		currentEvents,
		setCurrentEvents,
		setSelectedEvent,
		setChosenEvents,
		setShowWelcomeBack,
		fetchEventsCallbackWrapper,
	]);

	// Wrapper for handleNewSearch
	const handleNewSearchWrapper = useCallback(() => {
		handleNewSearch(
			setCurrentEvents,
			setChosenEvents,
			setUnchosenEvents,
			setSelectedEvent,
			setShowWelcomeBack,
		);
	}, [
		setCurrentEvents,
		setChosenEvents,
		setUnchosenEvents,
		setSelectedEvent,
		setShowWelcomeBack,
	]);

	// Handle event selection with both panel scrolling and map centering
	const handleEventSelection = useCallback(
		(event: Event) => {
			// Use the hook's handleSelectEvent function first
			handleSelectEvent(event);

			// Manually ensure the event is scrolled into view
			scrollToSelectedEvent(event.id);

			// Center the map on the event location
			if (mapRef.current && event.lat && event.lon) {
				centerMapOnEvent(mapRef.current, event);
			}
		},
		[handleSelectEvent, mapRef],
	);

	const handleFilterChange = useCallback((subject: string | null) => {
		setFilterSubject(subject);
	}, []);

	const togglePanel = () => {
		setIsPanelCollapsed(!isPanelCollapsed);
	};

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

	// Fix the useEffect for initialization to avoid double calls
	useEffect(() => {
		if (user && isFirstMount.current) {
			console.log(
				`[${mountId.current}] Initializing with user:`,
				user.id,
			);
			isFirstMount.current = false;

			// Fetch user data in one batch operation
			Promise.all([
				// Fetch last event
				fetchLastEvent(user.id),
				// Fetch path data
				// fetchUserPathData(true),
			])
				.then(([event]) => {
					if (event) {
						console.log(
							`[${mountId.current}] Initialization complete: Found last event: ${event.title}`,
						);
					} else {
						console.log(
							`[${mountId.current}] Initialization complete: No last event found`,
						);
					}
					// Mark initialization as complete
					setIsInitializing(false);
				})
				.catch(err => {
					console.error(
						`[${mountId.current}] Error during initialization:`,
						err,
					);
					// Even on error, we should mark initialization as complete
					setIsInitializing(false);
				});
		} else if (!user && !isInitializing) {
			// If no user and not initializing, we're ready
			setIsInitializing(false);
		}
	}, [
		user,
		fetchLastEvent,
		fetchUserPathData,
		mountId,
		isFirstMount,
		isInitializing,
	]);

	// Replace this effect with a more efficient version that only runs when dependencies actually change
	useEffect(() => {
		// Only run if we have events and there are interacted events
		if (events.length === 0 || interactedEventIds.size === 0) return;

		// Find IDs that haven't been marked yet
		const unmarkedIds = new Set(
			[...interactedEventIds].filter(
				id => !markedInteractionsRef.current.has(id),
			),
		);

		// Only update if there are actually new IDs to mark
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
	}, [interactedEventIds, events, setEvents]);

	// Effect to sync events and currentEvents - only run when currentEvents actually changes
	useEffect(() => {
		// Skip if no current events or if the arrays are the same length (likely no change)
		if (
			currentEvents.length === 0 ||
			(events.length === currentEvents.length && events.length > 0)
		) {
			return;
		}

		syncEvents();
	}, [currentEvents, syncEvents, events.length]);

	// Filter events for display based on subject
	const filteredEvents = filterSubject
		? currentEvents.filter(event => event.subject === filterSubject)
		: currentEvents;

	// Update year filtering to also filter the already-filtered events by subject
	const displayedEvents = filteredEvents.filter(
		event => event.year >= yearRange[0] && event.year <= yearRange[1],
	);

	// Don't render the main content until initialization is complete
	if (isInitializing) {
		return (
			<div className="grid grid-cols-12 grid-rows-[auto_1fr_1fr] h-screen bg-amber-50 dark:bg-gray-900">
				<div className="col-span-12">
					<Header />
				</div>
				<div className="col-span-12 row-span-2 flex items-center justify-center">
					<div className="text-center p-8">
						<div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-amber-600 border-r-transparent dark:border-amber-400"></div>
						<p className="mt-4 text-lg text-amber-800 dark:text-amber-200">
							Loading your history journey...
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-12 grid-rows-[auto_1fr_1fr] h-screen">
			{/* Header row - spans all columns */}
			<div className="col-span-12">
				<Header />
			</div>

			{/* Sidebar - Event Panel */}
			<div
				className={`col-span-12  md:row-span-2 ${isPanelCollapsed ? 'md:col-span-1' : 'md:col-span-3'}  bg-white dark:bg-gray-800 shadow-lg relative z-10`}
			>
				<div className="h-full flex">
					<div className="p-2 flex-grow overflow-y-auto">
						<div ref={eventPanelRef}>
							<EventPanel
								events={currentEvents}
								selectedEvent={selectedEvent}
								onSelectEvent={handleEventSelection}
								chosenEvents={chosenEvents}
							/>
							<InformationPanel
								event={selectedEvent}
								onFetchMore={fetchMoreEventsWrapper}
							/>
						</div>
					</div>
					<button
						onClick={togglePanel}
						className="bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 p-2"
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
							onContinue={handleContinueExplorationWrapper}
							onNewSearch={handleNewSearchWrapper}
							fetchEventsCallback={fetchEventsCallbackWrapper}
							topic={topic}
							setTopic={setTopic}
						/>
					</div>
				)}

				<button
					className="absolute top-4 right-4 z-20 w-fit max-w-2xl bg-amber-600 text-white font-bold text-lg px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
					onClick={() => {
						setShowWelcomeBack(true);
					}}
				>
					Show Welcome Back
				</button>

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
						subjects={uniqueSubjects}
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
							ref={mapRef}
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
													handleEventSelection(event);
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

			{/* Add Featured Quizzes Section */}
			<FeaturedQuizzes />
		</div>
	);
};

export default App;
