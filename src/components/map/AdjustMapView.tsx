import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { Event } from '@/types/event';

export const AdjustMapView: React.FC<{ events: Event[] }> = ({ events }) => {
	const map = useMap();

	useEffect(() => {
		if (events.length === 0 || typeof window === 'undefined') return;

		try {
			// Import leaflet dynamically to avoid SSR issues
			const L = require('leaflet');

			if (events.length > 0 && map) {
				const bounds = L.latLngBounds(
					events.map(event => [event.lat, event.lon]),
				);
				map.fitBounds(bounds, { padding: [50, 50] });
			}
		} catch (error) {
			console.error('Error adjusting map view:', error);
		}
	}, [events, map]);

	return null;
};
