import React, { useEffect, useState } from 'react';
import { Event } from '@/types/event';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

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
	// Include other props here
	// ...
	handleIsMounted = false,
	// ...
}) => {
	// Fix Leaflet icon paths
	useEffect(() => {
		// Fix Leaflet default icon issue
		if (L.Icon.Default.prototype._getIconUrl) {
			delete (L.Icon.Default.prototype as any)._getIconUrl;
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

	return (
		<MapContainer
			center={[20, 0]}
			zoom={2}
			scrollWheelZoom={true}
			style={{ height: '100%', width: '100%' }}
			attributionControl={false}
		>
			<TileLayer
				url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
			/>
			{events.map(event => (
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
	);
};
