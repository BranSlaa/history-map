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
import { fetchEventsCallback, fetchMoreEvents } from '@/utils/eventFetchUtils';
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
	const [pathOptions, setPathOptions] = useState<Event[]>([]);
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
			return fetchEventsCallback(
				topic,
				title,
				year,
				onEventsFetched,
				isAdditionalEvent,
				supabase,
				isEventAlreadyInLists,
				setLoading,
				setCurrentEvents,
				interactedEventIds,
				chosenEvents,
				unchosenEvents,
				selectedEvent,
			);
		},
		[
			supabase,
			isEventAlreadyInLists,
			setLoading,
			setCurrentEvents,
			interactedEventIds,
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
			setCurrentEvents,
			updatePathData,
			recordEventInteractionWrapper,
			fetchEventsCallbackWrapper,
			topic,
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
	}, [interactedEventIds, events.length, events, setEvents]);

	// Effect to sync events and currentEvents
	useEffect(() => {
		syncEvents();
	}, [currentEvents, syncEvents]);

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
	}, [user, fetchLastEvent, fetchUserPathData, mountId, isFirstMount]);

	// Filter events for display based on subject
	const filteredEvents = filterSubject
		? currentEvents.filter(event => event.subject === filterSubject)
		: currentEvents;

	// Update year filtering to also filter the already-filtered events by subject
	const displayedEvents = filteredEvents.filter(
		event => event.year >= yearRange[0] && event.year <= yearRange[1],
	);

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
								onSelectEvent={handleEventSelection}
								pathOptions={pathOptions}
							/>
							<InformationPanel
								event={selectedEvent}
								onFetchMore={fetchMoreEventsWrapper}
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
							onContinue={handleContinueExplorationWrapper}
							onNewSearch={handleNewSearchWrapper}
							fetchEventsCallback={fetchEventsCallbackWrapper}
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
		</div>
	);
};

export default App;
