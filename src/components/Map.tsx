import React, { useEffect } from 'react';
import { Event } from '@/types/event';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import WelcomeBack from '@/app/components/WelcomeBack';
import EventPanel from '@/app/components/EventPanel';
import SubjectFilterBar from '@/app/components/SubjectFilterBar';

// Extend Event interface if needed to include latitude and longitude
declare module '@/types/event' {
	interface Event {
		latitude: number;
		longitude: number;
	}
}

// Define props interface for MapComponent
interface MapComponentProps {
	events: Event[];
	handleEventSelection: (event: Event) => void;
	handleFilterChange: (subject: string | null) => void;
	handleContinueExploration: () => void;
	handleNewSearch: () => void;
	handleFetchMore: () => void;
	handleFetchEvents: () => void;
	handleShowWelcomeBack: (
		lastEvent: Event | null,
		currentEvents: Event[],
	) => boolean;
	handleFetchLastEvent: () => void;
	handleFetchUserPathData: () => void;
	handleRecordEventInteraction: (event: Event) => void;
	handleSyncEvents: () => void;
	handleMarkInteractedEvents: (events: Event[]) => void;
	handleHighlightLocations: (locations: string[]) => void;
	handleScrollToSelectedEvent: (eventId: string) => void;
	handleCenterMapOnEvent: (event: Event) => void;
	handleMapRef: React.RefObject<L.Map>;
	handleEvents: Event[];
	handleCurrentEvents: Event[];
	handleChosenEvents: Event[];
	handleUnchosenEvents: Event[];
	handleSelectedEvent: Event | null;
	handleSetSelectedEvent: React.Dispatch<React.SetStateAction<Event | null>>;
	handleSetCurrentEvents: React.Dispatch<React.SetStateAction<Event[]>>;
	handleSetChosenEvents: React.Dispatch<React.SetStateAction<Event[]>>;
	handleSetUnchosenEvents: React.Dispatch<React.SetStateAction<Event[]>>;
	handleSetInteractedEventIds: React.Dispatch<
		React.SetStateAction<Set<string>>
	>;
	handleSetEvents: React.Dispatch<React.SetStateAction<Event[]>>;
	handleIsEventAlreadyInLists: (event: Event) => boolean;
	handleTopic: string;
	handleSetTopic: React.Dispatch<React.SetStateAction<string>>;
	handleLoading: boolean;
	handleSetLoading: React.Dispatch<React.SetStateAction<boolean>>;
	handleIsPanelCollapsed: boolean;
	handleSetIsPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
	handleFilterSubject: string | null;
	handleSetFilterSubject: React.Dispatch<React.SetStateAction<string | null>>;
	handleIsShowingWelcomeBack: boolean;
	handleSetShowWelcomeBack: React.Dispatch<React.SetStateAction<boolean>>;
	handleLastEvent: Event | null;
	handleSetLastEvent: React.Dispatch<React.SetStateAction<Event | null>>;
	handleYearRange: [number, number];
	handleSetYearRange: React.Dispatch<React.SetStateAction<[number, number]>>;
	handleHighlightedLocations: Set<string>;
	handleSetHighlightedLocations: React.Dispatch<
		React.SetStateAction<Set<string>>
	>;
	handleIsFirstMount: boolean;
	handleIsMounted?: boolean;
	handleMountId: string;
	handleIsInitializing: boolean;
	handleSetIsInitializing: React.Dispatch<React.SetStateAction<boolean>>;
	handleMarkedInteractionsRef: React.RefObject<Set<string>>;
	handleEventPanelRef: React.RefObject<HTMLDivElement>;
	handleUpdatePathData: () => void;
}

export const MapComponent: React.FC<MapComponentProps> = ({
	events,
	handleEventSelection,
	handleFilterChange,
	handleContinueExploration,
	handleNewSearch,
	handleFetchEvents,
	handleShowWelcomeBack,
	handleFetchLastEvent,
	handleMapRef,
	handleEvents,
	handleCurrentEvents,
	handleChosenEvents,
	handleSelectedEvent,
	handleTopic,
	handleSetTopic,
	handleIsPanelCollapsed,
	handleSetIsPanelCollapsed,
	handleIsShowingWelcomeBack,
	handleLastEvent,
	handleSetShowWelcomeBack,
	handleIsMounted = false,
}) => {
	useEffect(() => {
		// Fix Leaflet default icon issue with type assertion
		const iconDefault = L.Icon.Default.prototype as any;
		if (iconDefault._getIconUrl) {
			delete iconDefault._getIconUrl;
		}

		L.Icon.Default.mergeOptions({
			iconRetinaUrl:
				'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
			iconUrl:
				'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
			shadowUrl:
				'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
		});
	}, []);

	// Add safety check for current events
	const safeCurrentEvents =
		handleCurrentEvents?.filter(
			event => event && typeof event.id === 'string',
		) || [];

	// Add safety check for chosen events
	const safeChosenEvents =
		handleChosenEvents?.filter(
			event => event && typeof event.id === 'string',
		) || [];

	// Extract unique subjects from events
	const uniqueSubjects = Array.from(
		new Set(
			(handleEvents || [])
				.filter(event => event && event.subject)
				.map(event => event.subject)
				.filter(Boolean),
		),
	);

	// Add safety check for events
	const safeEvents =
		events?.filter(
			event =>
				event &&
				typeof event.id === 'string' &&
				typeof event.latitude === 'number' &&
				typeof event.longitude === 'number',
		) || [];

	return (
		<div className="flex h-full">
			{/* Sidebar Panel */}
			<div
				className={`transition-all duration-300 ${handleIsPanelCollapsed ? 'w-0 overflow-hidden' : 'w-96'} bg-white dark:bg-stone-800 h-full flex flex-col shadow-lg relative`}
			>
				{/* Toggle Panel Button - attached to the sidebar */}
				<button
					className="absolute z-10 -right-10 top-20 bg-amber-600 hover:bg-amber-700 text-white p-2 rounded-r-lg shadow-md"
					onClick={() =>
						handleSetIsPanelCollapsed(!handleIsPanelCollapsed)
					}
				>
					{handleIsPanelCollapsed ? '\u203A' : '\u2039'}
				</button>

				{/* Filter Bar */}
				<SubjectFilterBar
					subjects={uniqueSubjects}
					onFilterChange={handleFilterChange}
				/>

				{/* Event Panel */}
				<div className="flex-1 overflow-auto">
					<EventPanel
						events={safeCurrentEvents}
						onSelectEvent={handleEventSelection}
						selectedEvent={handleSelectedEvent}
						chosenEvents={safeChosenEvents}
					/>
				</div>
			</div>

			{/* Map Container */}
			<div className="flex-1 relative">
				<MapContainer
					center={[20, 0]}
					zoom={2}
					scrollWheelZoom={true}
					style={{ height: '100%', width: '100%' }}
					attributionControl={false}
					ref={handleMapRef}
				>
					<TileLayer
						url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
						attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					/>
					{safeEvents.map(event => (
						<Marker
							key={event.id}
							position={[event.latitude, event.longitude]}
							eventHandlers={{
								click: () => handleEventSelection(event),
							}}
						>
							<Popup>
								<div>
									<h3 className="font-semibold text-lg">
										{event.title}
									</h3>
									<p>{event.year}</p>
								</div>
							</Popup>
						</Marker>
					))}
				</MapContainer>
			</div>
		</div>
	);
};
