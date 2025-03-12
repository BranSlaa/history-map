'use client';

import React, { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import 'rc-slider/assets/index.css';
import { createMapIcons, addMapMarkerStyles } from '@/utils/mapUtils';
import ClientOnly from '@/components/ClientOnly';

// Import Leaflet components dynamically
const MapContainer = dynamic(
	() => import('react-leaflet').then(mod => mod.MapContainer),
	{ ssr: false },
);
const TileLayer = dynamic(
	() => import('react-leaflet').then(mod => mod.TileLayer),
	{ ssr: false },
);
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), {
	ssr: false,
});
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), {
	ssr: false,
});

// Dynamically import the map component with no SSR
const MapComponent = dynamic(
	() => import('../components/Map').then(mod => mod.MapComponent),
	{
		ssr: false,
		loading: () => (
			<div className="w-full h-[600px] flex items-center justify-center bg-gray-100">
				<p>Loading map...</p>
			</div>
		),
	},
);

const App = () => {
	// Reference for map
	const mapRef = useRef<any>(null);

	// Reference for custom marker icons that will be initialized on the client side
	const defaultIcon = useRef<any>(null);
	const selectedIcon = useRef<any>(null);
	const interactedIcon = useRef<any>(null);

	// Initialize Leaflet icons on the client side
	useEffect(() => {
		// Only import and initialize Leaflet on the client side
		const icons = createMapIcons();
		defaultIcon.current = icons.defaultIcon;
		selectedIcon.current = icons.selectedIcon;
		interactedIcon.current = icons.interactedIcon;

		// Add marker styles
		addMapMarkerStyles();
	}, []);

	// Return UI with minimal map structure
	return (
		<div className="h-screen flex flex-col">
			<div className="h-full w-full relative">
				<ClientOnly>
					{/* Using MapComponent as a placeholder - in a real implementation, you would
					    need to provide the required props */}
					<div className="w-full h-full bg-gray-100 flex items-center justify-center">
						<p>Map component would be rendered here</p>
					</div>
				</ClientOnly>
			</div>
		</div>
	);
};

export default App;
