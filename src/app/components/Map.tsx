import React, { useState, useEffect, useRef } from 'react';
import { Event } from '@/types/event';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
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
	events?: Event[];
	initialCenter?: [number, number];
	initialZoom?: number;
	onSelectEvent?: (event: Event) => void;
	selectedEvent?: Event | null;
}

// Type for Leaflet icon default
interface LeafletIconDefault extends L.Icon.Default {
	_getIconUrl?: () => string;
}

// Helper component to initialize map view
const InitializeMapView: React.FC<{
	center: [number, number];
	zoom: number;
	events: Event[];
}> = ({ center, zoom, events }) => {
	const map = useMap();

	useEffect(() => {
		map.setView(center, zoom);
	}, [center, zoom, map]);

	useEffect(() => {
		if (events.length > 0) {
			try {
				const validPoints = events
					.map(event => {
						const lat = event.latitude || event.lat;
						const lng = event.longitude || event.lon;
						return lat && lng
							? ([lat, lng] as L.LatLngTuple)
							: null;
					})
					.filter((point): point is L.LatLngTuple => point !== null);

				if (validPoints.length > 0) {
					const bounds = L.latLngBounds(validPoints);
					if (bounds.isValid()) {
						map.fitBounds(bounds, { padding: [50, 50] });
					}
				}
			} catch (error) {
				console.error('Error adjusting map view:', error);
			}
		}
	}, [events, map]);

	return null;
};

export const MapComponent: React.FC<MapComponentProps> = ({
	events = [],
	initialCenter = [20, 0],
	initialZoom = 2,
	onSelectEvent,
	selectedEvent,
}) => {
	const [filterSubject, setFilterSubject] = useState<string | null>(null);
	const mapRef = useRef<L.Map>(null);

	// Get unique subjects from events
	const uniqueSubjects = [
		...new Set(events.map(event => event.subject)),
	].filter(Boolean);

	// Filter events based on selected subject
	const filteredEvents = filterSubject
		? events.filter(event => event.subject === filterSubject)
		: events;

	// Handle filter change
	const handleFilterChange = (subject: string | null) => {
		setFilterSubject(subject);
	};

	// Center map on selected event if it changes
	useEffect(() => {
		if (
			selectedEvent &&
			mapRef.current &&
			selectedEvent.latitude &&
			selectedEvent.longitude
		) {
			mapRef.current.setView(
				[selectedEvent.latitude, selectedEvent.longitude],
				5,
			);
		}
	}, [selectedEvent]);

	useEffect(() => {
		// Fix Leaflet default icon issue
		const iconDefault = L.Icon.Default.prototype as LeafletIconDefault;
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

	return (
		<MapContainer
			center={initialCenter}
			zoom={initialZoom}
			scrollWheelZoom={true}
			style={{ height: '100%', width: '100%' }}
			attributionControl={false}
			ref={mapRef}
		>
			<InitializeMapView
				center={initialCenter}
				zoom={initialZoom}
				events={events}
			/>
			<TileLayer
				url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
			/>
			{filteredEvents.map(event => (
				<Marker
					key={event.id}
					position={[
						event.latitude || event.lat,
						event.longitude || event.lon,
					]}
					eventHandlers={{
						click: () => onSelectEvent?.(event),
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
