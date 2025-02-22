'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { useMap } from 'react-leaflet';

const MapContainer = dynamic(
	() => import('react-leaflet').then(mod => mod.MapContainer),
	{ ssr: false }
);
const TileLayer = dynamic(
	() => import('react-leaflet').then(mod => mod.TileLayer),
	{ ssr: false }
);
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), {
	ssr: false,
});
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), {
	ssr: false,
});

interface Event {
	title: string;
	year: number;
	lat: number;
	lon: number;
	info: string;
}

const defaultIcon = new L.Icon({
	iconUrl: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
	iconSize: [32, 32],
	iconAnchor: [16, 32],
});

const selectedIcon = new L.Icon({
	iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
	iconSize: [32, 32],
	iconAnchor: [16, 32],
});

const App: React.FC = () => {
	const [topic, setTopic] = useState<string>('');
	const [events, setEvents] = useState<Event[]>([]);
	const [highlightedLocations, setHighlightedLocations] = useState<
		Set<string>
	>(new Set());
	const [yearRange, setYearRange] = useState<[number, number]>([
		-7000,
		new Date().getFullYear(),
	]);
	const [loading, setLoading] = useState<boolean>(false);

	const fetchEvents = useCallback(
		async (title: string, year: number, topic: string) => {
			setLoading(true);
			try {
				let url = `http://127.0.0.1:8000/get_events?`;

				if (title) {
					url += `title=${encodeURIComponent(title)}&`;
				}
				if (year) {
					url += `year=${year}&`;
				}
				if (topic) {
					url += `topic=${encodeURIComponent(topic)}`;
				}

				const response = await fetch(url);
				if (!response.ok) {
					console.error('API request failed', response.statusText);
					return;
				}
				const data = await response.json();
				console.log('Fetched Events:', data);

				setEvents([...data, ...events]);
			} catch (error) {
				console.error('Failed to fetch events:', error);
			} finally {
				setLoading(false);
			}
		},
		[]
	);

	const AdjustMapView: React.FC<{ events: Event[] }> = ({ events }) => {
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

	return (
		<div className="container">
			{loading && <div className="loading-indicator">Loading...</div>}
			<form
				className="search-container"
				onSubmit={e => {
					e.preventDefault();
					fetchEvents('', 0, topic);
				}}
			>
				<input
					type="text"
					value={topic}
					onChange={e => setTopic(e.target.value)}
				/>
				<button type="submit">Search</button>
				<div className="range-container">
					<label>
						Year Range: {yearRange[0]} - {yearRange[1]}
					</label>
					<Slider
						range
						min={-7000}
						max={new Date().getFullYear()}
						step={5}
						value={yearRange}
						onChange={value => {
							if (Array.isArray(value) && value.length === 2) {
								setYearRange([value[0], value[1]]);
							}
						}}
					/>
				</div>
			</form>
			<MapContainer
				center={[51.5074, -0.1276]}
				zoom={2}
				style={{ width: '100vw', height: '100vh' }}
			>
				<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
				<AdjustMapView events={events} />
				{events
					.filter(
						event =>
							event.year >= yearRange[0] &&
							event.year <= yearRange[1]
					)
					.map((event, index) => (
						<Marker
							key={`${event.title}-${event.year}-${index}`}
							position={[event.lat, event.lon]}
							icon={
								highlightedLocations.has(event.title)
									? selectedIcon
									: defaultIcon
							}
							eventHandlers={{
								click: () => {
									fetchEvents(event.title, event.year, topic);
									setHighlightedLocations(
										prev => new Set([...prev, event.title])
									);
								},
							}}
						>
							<Popup>
								<h3>{event.title}</h3>
								<p>{event.info}</p>
								<h4>Event in {event.year}:</h4>
							</Popup>
						</Marker>
					))}
			</MapContainer>
		</div>
	);
};

export default App;
