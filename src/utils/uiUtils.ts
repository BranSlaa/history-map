import { Event } from '@/types/event';

export const scrollToSelectedEvent = (eventId: string): void => {
	if (!eventId) return;

	// Use setTimeout to ensure the DOM has updated
	setTimeout(() => {
		const eventElement = document.getElementById(`event-${eventId}`);
		if (eventElement) {
			// First ensure element is visible
			if (typeof eventElement.scrollIntoView === 'function') {
				eventElement.scrollIntoView({
					behavior: 'smooth',
					block: 'center',
				});
			} else {
				// Fallback for browsers that don't support scrollIntoView options
				try {
					eventElement.scrollIntoView();
				} catch (e) {
					console.warn('Failed to scroll to event:', e);
				}
			}
		} else {
			console.warn(`Could not find element with id event-${eventId}`);
		}
	}, 200); // Increased timeout to ensure DOM is fully updated
};

// Function to center map on an event
export const centerMapOnEvent = (map: any, event: Event, zoomLevel: number = 6): void => {
	if (!map || !event || !event.lat || !event.lon) return;
	
	map.flyTo([event.lat, event.lon], zoomLevel, {
		duration: 1.5,
		animate: true
	});
}; 