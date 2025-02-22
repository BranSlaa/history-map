'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { Event } from '@/types/event';
import EventPanel from './components/EventPanel';
import InformationPanel from './components/InformationPanel';
import SubjectFilterBar from './components/SubjectFilterBar';
import { fetchEvents, AdjustMapView } from '@/utils/mapUtils';

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
	const [searchVisible, setSearchVisible] = useState<boolean>(true);
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
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [selectedSubjects, setSelectedSubjects] = useState<string[]>([
		'significant-events',
		'great-people',
		'important-places',
		'scientific-discoveries',
		'works-of-art',
		'military-conflicts',
	]);
	const fetchEventsCallback = fetchEvents(
		setLoading,
		setEvents,
		events,
		selectedSubjects
	);

	const handleSelectEvent = (event: Event) => {
		setSelectedEvent(event);
	};

	const handleFilterChange = (subjects: string[]) => {
		setSelectedSubjects(subjects);
	};

	return (
		<div className="container">
			{loading && (
				<div className="loading-indicator">Loading. Please wait.</div>
			)}
			<form
				className={`search-container ${searchVisible ? '' : 'hidden'}`}
				onSubmit={e => {
					e.preventDefault();
					fetchEventsCallback(
						topic,
						'',
						yearRange[0],
						yearRange[1],
						selectedSubjects
					);
					setSearchVisible(false);
				}}
			>
				<label className="search-label" htmlFor="topic">
					Enter a topic to start:
					<input
						type="text"
						id="topic"
						name="topic"
						value={topic}
						placeholder="Search a Topic"
						onChange={e => setTopic(e.target.value)}
					/>
				</label>
				<button type="submit">Search</button>
			</form>
			<div className="main-app-window">
				<div className="information-sidebar">
					<EventPanel
						events={events}
						onSelectEvent={handleSelectEvent}
					/>
					<InformationPanel event={selectedEvent} />
				</div>
				<div className="main-app-container">
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
								if (
									Array.isArray(value) &&
									value.length === 2
								) {
									setYearRange([value[0], value[1]]);
								}
							}}
						/>
					</div>
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
											fetchEventsCallback(
												topic,
												event.title,
												event.year,
												selectedSubjects
											);
											setHighlightedLocations(
												prev =>
													new Set([
														...prev,
														event.title,
													])
											);
											setSelectedEvent(event);
										},
									}}
								>
									{/* <Popup>
										<h3>{event.title}</h3>
										<h4>Year:{event.year}:</h4>
										<h4>Subject:{event.subject}:</h4>
										<p>{event.info}</p>
									</Popup> */}
								</Marker>
							))}
					</MapContainer>
					<SubjectFilterBar onFilterChange={handleFilterChange} />
				</div>
			</div>
		</div>
	);
};

export default App;
