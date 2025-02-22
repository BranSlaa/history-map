import { useCallback, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Event } from '@/types/event';

export const fetchEvents = (
	setLoading: React.Dispatch<React.SetStateAction<boolean>>,
	setEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	events: Event[],
	selectedSubjects?: string[]
) =>
	useCallback(
		async (
			topic: string,
			title: string,
			yearMinOrNear: number,
			yearMax?: number,
			selectedSubjects?: string[]
		) => {
			setLoading(true);
			try {
				let url = `http://127.0.0.1:8000/get_events?`;

				if (topic) {
					url += `topic=${encodeURIComponent(topic)}`;
				}
				if (title) {
					url += `title=${encodeURIComponent(title)}&`;
				}
				if (yearMinOrNear && !yearMax) {
					url += `yearNear=${yearMinOrNear}&`;
				}
				if (yearMinOrNear && yearMax) {
					url += `yearMin=${yearMinOrNear}&yearMax=${yearMax}&`;
				}
				if (selectedSubjects) {
					url += `subjects=${selectedSubjects.join(',')}&`;
				}

				const response = await fetch(url);
				if (!response.ok) {
					console.error('API request failed', response.statusText);
					return;
				}
				const data = await response.json();

				setEvents(prevEvents => [...prevEvents, ...data]);
			} catch (error) {
				console.error('Failed to fetch events:', error);
			} finally {
				setLoading(false);
			}
		},
		[events]
	);

export const AdjustMapView: React.FC<{ events: Event[] }> = ({ events }) => {
	const map = useMap();

	useEffect(() => {
		if (events.length === 0) return;

		const bounds = L.latLngBounds(
			events.map(event => [event.lat, event.lon])
		);
		map.fitBounds(bounds, { padding: [50, 50] });
	}, [events, map]);

	return null;
};
