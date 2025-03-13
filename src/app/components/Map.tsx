import React, { useState, useEffect, useRef } from 'react';
import { Event } from '@/types/event';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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
		<div className="h-full w-full relative">
			{uniqueSubjects.length > 0 && (
				<div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
					<SubjectFilterBar
						subjects={uniqueSubjects}
						onFilterChange={handleFilterChange}
					/>
				</div>
			)}

			<MapContainer
				center={initialCenter}
				zoom={initialZoom}
				scrollWheelZoom={true}
				style={{ height: '100%', width: '100%' }}
				attributionControl={false}
				ref={mapRef}
			>
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
		</div>
	);
};
