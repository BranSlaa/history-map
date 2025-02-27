import { useCallback, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Event } from '@/types/event';
import { getToken, removeToken } from './authUtils';

// Define API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export const fetchEvents = (
	setLoading: React.Dispatch<React.SetStateAction<boolean>>,
	setEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	events: Event[]
) =>
	useCallback(
		async (
			topic: string,
			title: string,
			yearMin: number,
			yearMax: number,
			selectedSubjects: string[]
		) => {
			setLoading(true);
			const token = getToken();

			if (!token) {
				console.error('No JWT token available. Please sign in again.');
				setLoading(false);
				return;
			}

			console.log('Parameters:');
			console.log('- topic:', topic);
			console.log('- title:', title);
			console.log('- yearMin:', yearMin);
			console.log('- yearMax:', yearMax);
			console.log('- subjects:', selectedSubjects);
			console.log('- Token:', token.substring(0, 10) + '...');

			try {
				// Build URL exactly matching the FastAPI parameters
				let url = `${API_URL}/get_events?`;

				// Add topic if provided
				if (topic) {
					url += `topic=${encodeURIComponent(topic)}&`;
				}

				// Add title if provided
				if (title) {
					url += `title=${encodeURIComponent(title)}&`;
				}

				// Add yearMin if provided
				if (yearMin !== undefined) {
					url += `yearMin=${yearMin}&`;
				}

				// Add yearMax if provided
				if (yearMax !== undefined) {
					url += `yearMax=${yearMax}&`;
				}

				// Add subjects if provided
				if (selectedSubjects && selectedSubjects.length > 0) {
					url += `subjects=${selectedSubjects.join(',')}&`;
				}

				// Remove trailing '&' if present
				url = url.endsWith('&') ? url.slice(0, -1) : url;

				console.log('Fetching events from:', url);

				const response = await fetch(url, {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				if (!response.ok) {
					console.error(
						'API request failed:',
						response.status,
						response.statusText
					);

					// If unauthorized, the token is likely invalid
					if (response.status === 401) {
						console.error(
							'Authentication error: Invalid or expired token'
						);
						// Clear the invalid token
						removeToken();
						// You may want to redirect to login or trigger a re-auth here
					}

					return;
				}

				const data = await response.json();
				console.log(`Retrieved ${data.length} events from API`);
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
