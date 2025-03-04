import { Event } from '@/types/event';

export const recordEventInteraction = async (
	eventId: string,
	userId: string | undefined,
	interactedEventIds: Set<string>,
	setInteractedEventIds: (value: React.SetStateAction<Set<string>>) => void,
	previousEventId?: string,
) => {
	try {
		if (!userId) {
			console.log('User not logged in, skipping interaction recording');
			return;
		}

		// If we've already recorded this event, don't record it again
		if (interactedEventIds.has(eventId)) {
			return;
		}

		const response = await fetch('/api/event-interactions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				userId,
				eventId,
				previousEventId,
				interactionType: 'fetch_more',
			}),
		});

		if (!response.ok) {
			throw new Error('Failed to record event interaction');
		}

		// Add to interacted event IDs set
		setInteractedEventIds(prev => new Set([...prev, eventId]));
		console.log(`Recorded interaction with event ${eventId}`);
	} catch (error) {
		console.error('Error recording event interaction:', error);
	}
};

export const updateNextEvent = async (
	sourceEventId: string,
	targetEventId: string,
	userId: string | undefined,
) => {
	try {
		// Don't update if source and target are the same
		if (sourceEventId === targetEventId) {
			return;
		}

		// Get the current user's ID
		if (!userId) {
			console.log('User not logged in, skipping next event update');
			return;
		}

		// Send the update to the API
		const response = await fetch('/api/event-connections', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				userId,
				sourceEventId,
				targetEventId,
			}),
		});

		if (!response.ok) {
			throw new Error('Failed to update next event');
		}

		console.log(`Updated connection: ${sourceEventId} -> ${targetEventId}`);
	} catch (error) {
		console.error('Error updating next event:', error);
	}
};

export const fetchUserInteractions = async (
	userId: string,
	setInteractedEventIds: (value: React.SetStateAction<Set<string>>) => void,
) => {
	try {
		const response = await fetch(`/api/event-interactions?userId=${userId}`);
		if (response.ok) {
			const data = await response.json();
			setInteractedEventIds(new Set(data.interactedEventIds));
		}
	} catch (error) {
		console.error('Error fetching user interactions:', error);
	}
}; 