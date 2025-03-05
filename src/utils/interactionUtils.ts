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

// Add a function to track user activity (search or connection)
export const trackUserActivity = async (
	userId: string | undefined,
	activityType: 'search' | 'connection'
) => {
	try {
		if (!userId) {
			console.log('User not logged in, skipping activity tracking');
			return null;
		}

		const response = await fetch('/api/user-activity', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				activityType,
			}),
		});

		// If we get an authentication error, log it but don't throw
		if (response.status === 401) {
			console.warn(`Authentication issue when tracking ${activityType} activity. This won't affect your browsing experience.`);
			return null;
		}

		if (!response.ok) {
			throw new Error(`Failed to track ${activityType} activity`);
		}

		const data = await response.json();
		
		// Check if a quiz should be triggered
		if (data.shouldTriggerQuiz) {
			console.log('Quiz trigger threshold reached! Generating quiz...');
			try {
				// Call the generate quiz API
				const quizResponse = await fetch('/api/quizzes/generate', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						userId
					}),
				});
				
				// Handle authentication errors gracefully
				if (quizResponse.status === 401) {
					console.warn('Authentication issue when generating quiz. You can still generate quizzes manually in your profile.');
					return data;
				}
				
				if (!quizResponse.ok) {
					console.error('Failed to generate quiz:', await quizResponse.text());
					return data;
				}
				
				const quizData = await quizResponse.json();
				console.log('Quiz generated successfully:', quizData.title);
				
				return {
					...data,
					quiz: quizData
				};
			} catch (error) {
				console.error('Error generating quiz:', error);
				// Return original data even if quiz generation fails
				return data;
			}
		}
		
		return data;
	} catch (error) {
		console.error(`Error tracking ${activityType} activity:`, error);
		return null;
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
		
		// Track this connection as user activity
		await trackUserActivity(userId, 'connection');
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