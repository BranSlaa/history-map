import { NextResponse } from 'next/server';
import { Event } from '@/types/event';

/**
 * Helper function to safely get the admin client in API routes
 * This has been modified to remove direct Supabase dependency
 */
export function getSupabaseAdmin() {
	throw new Error(
		'Direct database access has been removed. Use API endpoints instead.',
	);
}

/**
 * Helper function to handle API errors consistently
 */
export function handleApiError(
	error: any,
	message: string = 'An error occurred',
) {
	console.error(`API Error: ${message}`, error);

	const errorMessage =
		error instanceof Error
			? error.message
			: typeof error === 'string'
				? error
				: JSON.stringify(error);

	return NextResponse.json(
		{ error: `${message}: ${errorMessage}` },
		{ status: 500 },
	);
}

/**
 * Wrapper function for API handlers to handle common error cases
 */
export function withErrorHandling(handler: Function) {
	return async (...args: any[]) => {
		try {
			return await handler(...args);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message === 'Database admin client not available'
			) {
				return NextResponse.json(
					{ error: 'Server configuration error' },
					{ status: 500 },
				);
			}

			return handleApiError(error);
		}
	};
}

// CLIENT-SIDE API UTILITIES
// ------------------------

/**
 * Generic function to make API requests
 */
async function apiRequest(
	endpoint: string,
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
	body?: any,
	queryParams?: Record<string, string>,
) {
	try {
		const url = new URL(`/api/${endpoint}`, window.location.origin);

		// Add query parameters if provided
		if (queryParams) {
			Object.entries(queryParams).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					url.searchParams.append(key, value);
				}
			});
		}

		const options: RequestInit = {
			method,
			headers: {
				'Content-Type': 'application/json',
			},
		};

		if (body && (method === 'POST' || method === 'PUT')) {
			options.body = JSON.stringify(body);
		}

		const response = await fetch(url.toString(), options);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API error (${response.status}): ${errorText}`);
		}

		return await response.json();
	} catch (error) {
		console.error(`Error in ${method} ${endpoint}:`, error);
		throw error;
	}
}

/**
 * Fetch events with various filters - replaces eventFetchUtils
 */
export async function fetchEvents(options: {
	topic?: string;
	title?: string;
	year?: number;
	limit?: number;
	excludeEventIds?: string[];
}) {
	return apiRequest('generate-events', 'POST', options);
}

/**
 * Record an event interaction - replaces recordEventInteraction
 */
export async function recordEventInteraction(
	userId: string,
	eventId: string,
	previousEventId?: string,
	interactionType: string = 'fetch_more',
) {
	return apiRequest('event-interactions', 'POST', {
		userId,
		eventId,
		previousEventId,
		interactionType,
	});
}

/**
 * Track user activity - replaces trackUserActivity
 */
export async function trackUserActivity(
	userId: string,
	activityType: 'search' | 'connection',
) {
	return apiRequest('user-activity', 'POST', {
		userId,
		activityType,
	});
}

/**
 * Update event connections - replaces updateNextEvent
 */
export async function updateEventConnection(
	userId: string,
	sourceEventId: string,
	targetEventId: string,
) {
	return apiRequest('event-connections', 'POST', {
		userId,
		sourceEventId,
		targetEventId,
	});
}

/**
 * Fetch user interactions - replaces fetchUserInteractions
 */
export async function fetchUserInteractions(userId: string) {
	return apiRequest('event-interactions', 'GET', undefined, { userId });
}

/**
 * Generate a quiz - replaces quizService functions
 */
export async function generateQuiz(options: {
	userId: string;
	subject?: string;
	topic?: string;
	difficulty?: string;
	pathId?: string;
	searchTerm?: string;
	eventIds?: string[];
}) {
	return apiRequest('quizzes/generate', 'POST', options);
}

/**
 * Get recommended difficulty - replaces adaptiveDifficultyUtils
 */
export async function getRecommendedDifficulty(
	userId: string,
	currentDifficulty: string,
) {
	return apiRequest('quizzes/recommended-difficulty', 'POST', {
		userId,
		currentDifficulty,
	});
}

/**
 * Mark events as interacted based on a set of interacted event IDs
 * Replaces markInteractedEvents from eventUtils.ts
 */
export function markInteractedEvents(
	events: Event[],
	interactedEventIds: Set<string>,
): Event[] {
	if (
		!events ||
		events.length === 0 ||
		!interactedEventIds ||
		interactedEventIds.size === 0
	) {
		return events;
	}

	return events.map(event => ({
		...event,
		interacted: interactedEventIds.has(event.id),
	}));
}

/**
 * Fetch the last event a user interacted with
 * Replaces fetchLastEvent from eventUtils.ts
 */
export async function fetchLastEvent(userId: string) {
	return apiRequest('user-paths/last-event', 'GET', undefined, { userId });
}

/**
 * Update user path data
 * Replaces updatePathData from eventUtils.ts
 */
export async function updatePathData(
	userId: string,
	pathId: string,
	selectedEvent: Event,
	chosenEvents: Event[],
) {
	return apiRequest('user-paths/update', 'POST', {
		userId,
		pathId,
		selectedEventId: selectedEvent.id,
		chosenEventIds: chosenEvents.map(e => e.id),
	});
}

/**
 * Fetch user path data
 * Replaces fetchUserPathData from eventUtils.ts
 */
export async function fetchUserPathData(userId: string) {
	return apiRequest('user-paths', 'GET', undefined, { userId });
}

/**
 * Save user events
 * Replaces related functions from eventUtils.ts
 */
export async function saveUserEvents(
	userId: string,
	events: Event[],
	pathId?: string,
) {
	return apiRequest('save-events', 'POST', {
		userId,
		events,
		pathId,
	});
}
