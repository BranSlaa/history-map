import { useCallback, useState } from 'react';
import { Event } from '@/types/event';
import { scrollToSelectedEvent } from '@/utils/uiUtils';
import { recordEventInteraction, updateNextEvent } from '@/utils/interactionUtils';
import { addEventToList } from '@/utils/eventUtils';

export const useEvents = (
	userId: string | undefined,
	options?: {
		onEventSelected?: (event: Event) => void;
	}
) => {
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [currentEvents, setCurrentEvents] = useState<Event[]>([]);
	const [chosenEvents, setChosenEvents] = useState<Event[]>([]);
	const [unchosenEvents, setUnchosenEvents] = useState<Event[]>([]);
	const [interactedEventIds, setInteractedEventIds] = useState<Set<string>>(
		new Set(),
	);
	const [events, setEvents] = useState<Event[]>([]);

	// Utility function to check if an event already exists in any of our lists
	const isEventAlreadyInLists = useCallback(
		(eventId: string) => {
			return (
				currentEvents.some(e => e.id === eventId) ||
				chosenEvents.some(e => e.id === eventId) ||
				unchosenEvents.some(e => e.id === eventId)
			);
		},
		[currentEvents, chosenEvents, unchosenEvents],
	);

	// Update handleSelectEvent to use these utilities
	const handleSelectEvent = useCallback(
		(event: Event) => {
			// Get the ID of the previously selected event (if any)
			const previousEventId = selectedEvent?.id;

			// Set the selected event to update the UI
			setSelectedEvent(event);
			
			// Scroll to the event in the sidebar
			scrollToSelectedEvent(event.id);

			// Call the optional callback if provided
			if (options?.onEventSelected) {
				options.onEventSelected(event);
			}

			// Record the interaction
			recordEventInteraction(
				event.id, 
				userId, 
				interactedEventIds, 
				setInteractedEventIds,
				previousEventId
			);

			// If coming from another event, update the navigation path
			if (previousEventId && event.id !== previousEventId) {
				updateNextEvent(previousEventId, event.id, userId);
			}

			// Add the selected event to chosenEvents if not already there
			setChosenEvents(prev => addEventToList(event, prev));

			// Note: We no longer remove other events here
			// They will stay visible until "Explore Related Events" is clicked
		},
		[
			selectedEvent,
			userId,
			interactedEventIds,
			setInteractedEventIds,
			options,
			setChosenEvents
		],
	);

	// Effect to sync events and currentEvents
	const syncEvents = useCallback(() => {
		setEvents(currentEvents);
	}, [currentEvents]);

	return {
		selectedEvent,
		setSelectedEvent,
		currentEvents,
		setCurrentEvents,
		chosenEvents,
		setChosenEvents,
		unchosenEvents,
		setUnchosenEvents,
		interactedEventIds,
		setInteractedEventIds,
		events,
		setEvents,
		isEventAlreadyInLists,
		handleSelectEvent,
		syncEvents
	};
}; 