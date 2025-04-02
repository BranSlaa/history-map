import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Event } from '@/types/event';
import { createEventMarkerIcon } from './EventMarker';

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
	initialCenter: [number, number];
	initialZoom: number;
	onSelectEvent: (event: Event) => void;
	selectedEvent: Event | null;
}

export const MapComponent: React.FC<MapComponentProps> = ({
	events,
	initialCenter,
	initialZoom,
	onSelectEvent,
	selectedEvent,
}) => {
	const mapRef = useRef<L.Map | null>(null);
	const markersRef = useRef<{ [key: string]: L.Marker }>({});

	useEffect(() => {
		if (!mapRef.current) {
			const map = L.map('map').setView(initialCenter, initialZoom);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			}).addTo(map);
			mapRef.current = map;
		}

		return () => {
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}
		};
	}, [initialCenter, initialZoom]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		Object.values(markersRef.current).forEach(marker => {
			marker.remove();
		});
		markersRef.current = {};

		events.forEach(event => {
			if (event.latitude && event.longitude) {
				const marker = L.marker([event.latitude, event.longitude], {
					icon: createEventMarkerIcon(
						event.year,
						selectedEvent?.id === event.id,
					),
				})
					.addTo(map)
					.on('click', () => onSelectEvent(event));

				markersRef.current[event.id] = marker;
			}
		});
	}, [events, onSelectEvent, selectedEvent]);

	return <div id="map" className="h-full w-full" />;
};
