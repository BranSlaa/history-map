'use client';

import React, { useState, useEffect } from 'react';
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
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import crypto from 'crypto';
import { useUser } from '@/contexts/UserContext';
import Link from 'next/link';

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

const generateEventId = (title: string, year: number): string => {
	return crypto.createHash('sha256').update(`${title}-${year}`).digest('hex');
};

const App: React.FC = () => {
	const { user, isLoading: isUserLoading } = useUser();
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
	const fetchEventsCallback = fetchEvents(setLoading, setEvents, events);

	const handleSelectEvent = (event: Event) => {
		setSelectedEvent(event);
	};

	const handleFilterChange = (subjects: string[]) => {
		setSelectedSubjects(subjects);
	};

	const fetchMoreEvents = () => {
		if (selectedEvent) {
			fetchEventsCallback(
				selectedEvent.title,
				'',
				yearRange[0],
				yearRange[1],
				selectedSubjects
			);
		} else {
			fetchEventsCallback(
				topic,
				'',
				yearRange[0],
				yearRange[1],
				selectedSubjects
			);
		}
	};

	return (
		<div className="container">
			<SignedIn>
				{isUserLoading ? (
					<div className="loading-indicator">
						Loading user data. Please wait.
					</div>
				) : !user ? (
					<div className="auth-error">
						<p>Authentication error. Please sign in again.</p>
					</div>
				) : (
					<>
						{loading && (
							<div className="loading-indicator">
								Loading. Please wait.
							</div>
						)}
						<form
							className={`search-container ${
								searchVisible ? '' : 'hidden'
							}`}
							onSubmit={e => {
								e.preventDefault();
								fetchMoreEvents();
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
								<div className="user-info mb-4">
									<p className="font-medium">
										Logged in as: {user.username}
									</p>
									<p className="text-sm">
										Tier:{' '}
										<span className="capitalize">
											{user.subscription_tier}
										</span>
									</p>
									<Link
										href="/profile"
										className="text-blue-600 text-sm hover:underline"
									>
										Manage Subscription
									</Link>
								</div>
								<EventPanel
									events={events}
									onSelectEvent={handleSelectEvent}
								/>
								<InformationPanel event={selectedEvent} />
								<button onClick={fetchMoreEvents}>
									Fetch More Events
								</button>
							</div>
							<div className="main-app-container">
								<div className="range-container">
									<label>
										Year Range: {yearRange[0]} -{' '}
										{yearRange[1]}
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
												setYearRange([
													value[0],
													value[1],
												]);
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
												key={`${event.id}-marker`}
												position={[
													event.lat,
													event.lon,
												]}
												icon={
													highlightedLocations.has(
														event.title
													)
														? selectedIcon
														: defaultIcon
												}
												eventHandlers={{
													click: () => {
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
								<SubjectFilterBar
									onFilterChange={handleFilterChange}
								/>
							</div>
						</div>
					</>
				)}
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</div>
	);
};

export default App;
