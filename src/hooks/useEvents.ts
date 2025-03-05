import { useCallback, useState } from 'react';
import { Event } from '@/types/event';
import { scrollToSelectedEvent } from '@/utils/uiUtils';
import { recordEventInteraction, updateNextEvent } from '@/utils/interactionUtils';

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

	// Utility function to check if an event already exists in any of our lists - memoized
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

	// More efficient way to add event to chosen events
	const addToChosenEvents = useCallback((event: Event) => {
		setChosenEvents(prev => {
			// Only update if the event isn't already in the list
			if (!prev.some(e => e.id === event.id)) {
				return [...prev, event];
			}
			return prev;
		});
	}, []);

	// Update handleSelectEvent to use these utilities and minimize state updates
	const handleSelectEvent = useCallback(
		(event: Event) => {
			// Get the ID of the previously selected event (if any)
			const previousEventId = selectedEvent?.id;
			
			// Only update selected event if it changed
			if (!selectedEvent || selectedEvent.id !== event.id) {
				setSelectedEvent(event);
				
				// Scroll to the event in the sidebar
				scrollToSelectedEvent(event.id);

				// Call the optional callback if provided
				if (options?.onEventSelected) {
					options.onEventSelected(event);
				}

				// Record the interaction - only if this is a new selection
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
				// addToChosenEvents(event);
			}
		},
		[
			selectedEvent,
			userId,
			interactedEventIds,
			setInteractedEventIds,
			options,
			addToChosenEvents
		],
	);

	// Effect to sync events and currentEvents
	const syncEvents = useCallback(() => {
		// Only sync if arrays are different
		if (events.length !== currentEvents.length || 
			(events.length > 0 && currentEvents.length > 0 && 
			events[0].id !== currentEvents[0].id)) {
			setEvents(currentEvents);
		}
	}, [currentEvents, events]);

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