'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Location {
	name: string;
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
	const [locations, setLocations] = useState<Location[]>([]);
	const [highlightedLocations, setHighlightedLocations] = useState<
		Set<string>
	>(new Set());
	const [mapZoom, setMapZoom] = useState<number>(2);
	const [mapCenter, setMapCenter] = useState<[number, number]>([
		51.5074, -0.1276,
	]);

	useEffect(() => {
		fetchLocations('history');
	}, []);

	const fetchLocations = useCallback(
		async (query: string) => {
			if (!query) return;
			const queryParam = query.includes(' ')
				? `name=${query}`
				: `topic=${query}`;
			const response = await fetch(
				`http://127.0.0.1:8000/get_locations?${queryParam}`
			);
			if (!response.ok) {
				console.error('API request failed', response.statusText);
				return;
			}
			const data: Location[] = await response.json();
			setLocations(prev => [
				...prev,
				...data.filter(loc => !prev.some(p => p.name === loc.name)),
			]);
		},
		[setLocations]
	);

	const fetchSuggestions = async (name: string) => {
		const response = await fetch(
			`http://127.0.0.1:8000/suggest_more?name=${name}`
		);
		if (!response.ok) {
			console.error('API request failed', response.statusText);
			return;
		}
		const data: Location[] = await response.json();
		setLocations(prev => [
			...prev,
			...data.filter(loc => !prev.some(p => p.name === loc.name)),
		]);
		setHighlightedLocations(prev => new Set([...prev, name]));
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			fetchLocations(topic);
		}
	};

	return (
		<div>
			<input
				type="text"
				value={topic}
				onChange={e => setTopic(e.target.value)}
				onKeyDown={handleKeyPress}
				placeholder="Enter a topic"
			/>
			<button onClick={() => fetchLocations(topic)}>Search</button>
			<MapContainer
				center={mapCenter}
				zoom={mapZoom}
				style={{ width: '100vw', height: '100vh' }}
			>
				<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
				{locations.map(loc => (
					<Marker
						key={loc.name}
						position={[loc.lat, loc.lon]}
						icon={
							highlightedLocations.has(loc.name)
								? selectedIcon
								: defaultIcon
						}
						eventHandlers={{
							click: () => {
								fetchSuggestions(loc.name);
								setHighlightedLocations(
									prev => new Set([...prev, loc.name])
								);
								setMapZoom(15);
								setMapCenter([loc.lat, loc.lon]);
							},
						}}
					>
						<Popup>
							<h3>{loc.name}</h3>
							<p>{loc.info}</p>
						</Popup>
					</Marker>
				))}
			</MapContainer>
		</div>
	);
};

export default App;
