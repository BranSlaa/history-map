import { Event } from '@/types/event';
import { SupabaseClient } from '@supabase/supabase-js';

// Function to mark events as interacted based on interacted event IDs
export const markInteractedEvents = (
	events: Event[],
	interactedEventIds: Set<string>,
): Event[] => {
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
};

/**
 * Fetches the last event a user interacted with
 * @param supabase Supabase client instance
 * @param userId User ID to fetch data for
 * @param mountId Reference to mount ID for logging purposes
 * @returns The last event or null if not found
 */
export const createFetchLastEvent = (supabase: SupabaseClient) => {
	return async (userId: string, mountId: React.MutableRefObject<string>) => {
		try {
			console.log(`[${mountId.current}] Fetching last event...`);
			
			// Get path data from the database
			const { data: pathData, error: pathError } = await supabase
				.from('user_paths')
				.select('*')
				.eq('user_id', userId)
				.order('updated_at', { ascending: false })
				.limit(1);
			
			if (pathError) {
				console.error(`[${mountId.current}] Error fetching path data:`, pathError);
				return null;
			}
			
			if (!pathData || pathData.length === 0) {
				console.log(`[${mountId.current}] No path data found`);
				return null;
			}
			
			// Check for currentEventId in different levels of the data structure
			let currentEventId = pathData[0].currentEventId || pathData[0].path_data && pathData[0].path_data.currentEventId;
			
			console.log(`[${mountId.current}] Current event ID:`, currentEventId);
			
			if (!currentEventId) {
				console.log(`[${mountId.current}] No current event ID found in path data`);
				return null;
			}
			
			// Fetch the event from the database
			const { data: events, error } = await supabase
				.from('events')
				.select('*')
				.eq('id', currentEventId)
				.single();
			
			if (error) {
				console.error(`[${mountId.current}] Error fetching last event:`, error);
				return null;
			}
			
			if (!events) {
				console.log(`[${mountId.current}] No event found with ID:`, currentEventId);
				return null;
			}
			
			console.log(`[${mountId.current}] Last event found:`, events.title);
			return events;
		} catch (error) {
			console.error(`[${mountId.current}] Error in fetchLastEvent:`, error);
			return null;
		}
	};
};

/**
 * Utility function to add an event to a list if it doesn't exist yet
 */
export const addEventToList = (event: Event, eventList: Event[]) => {
	// Check if the event is already in the list
	if (!eventList.some(e => e.id === event.id)) {
		return [...eventList, event];
	}
	return eventList;
};

/**
 * Determines if the welcome back component should be shown
 */
export const shouldShowWelcomeBack = (
	lastEvent: Event | null, 
	currentEvents: Event[], 
	showWelcomeBackFlag: boolean
) => {
	return !!lastEvent && (currentEvents.length === 0 || showWelcomeBackFlag);
};

/**
 * Creates a function to update the user's path data in the database
 */
export const createUpdatePathData = (supabase: SupabaseClient) => {
	return async (
		userId: string,
		chosenEvents: Event[],
		unchosenEvents: Event[],
		selectedEvent: Event | null,
		mountId: React.MutableRefObject<string>
	) => {
		if (!userId) {
			console.warn(`[${mountId.current}] Cannot update path data: userId is empty`);
			return;
		}

		try {
			// Convert events to IDs for storage
			const chosenEventIds = chosenEvents.map(event => event.id);
			const unchosenEventIds = unchosenEvents.map(event => event.id);
			const currentEventId = selectedEvent?.id;

			console.log(`[${mountId.current}] Updating path data with:`, {
				chosenEventIds,
				unchosenEventIds,
				currentEventId,
			});

			const pathData = {
				chosenEvents: chosenEventIds,
				unchosenEvents: unchosenEventIds,
				currentEventId : currentEventId,
			};

			// Log the path data to be sent
			console.log(`[${mountId.current}] Path data to be sent:`, JSON.stringify(pathData));

			// First check if a record exists for this user
			const { data: existingData, error: checkError } = await supabase
				.from('user_paths')
				.select('id')
				.eq('user_id', userId)
				.limit(1);

			if (checkError) {
				console.error(`[${mountId.current}] Error checking for existing path data:`, checkError);
				throw checkError;
			}

			let result;
			if (existingData && existingData.length > 0) {
				// Update existing record
				console.log(`[${mountId.current}] Updating existing path record for user ${userId}`);
				const { data, error } = await supabase
					.from('user_paths')
					.update({
						path_data: pathData,
						current_event_id: currentEventId,
						updated_at: new Date().toISOString(),
					})
					.eq('user_id', userId)
					.select();

				if (error) {
					console.error(`[${mountId.current}] Update error:`, error);
					throw error;
				}
				result = data;
			} else {
				// Insert new record
				console.log(`[${mountId.current}] Creating new path record for user ${userId}`);
				const { data, error } = await supabase
					.from('user_paths')
					.insert({
						user_id: userId,
						path_data: pathData,
						current_event_id: currentEventId,
						updated_at: new Date().toISOString(),
					})
					.select();

				if (error) {
					console.error(`[${mountId.current}] Insert error:`, error);
					throw error;
				}
				result = data;
			}

			console.log(`[${mountId.current}] Updated path data in database:`, result);
			return result;
		} catch (error) {
			// Enhanced error logging with type checking
			if (error instanceof Error) {
				console.error(`[${mountId.current}] Error updating path data:`, {
					name: error.name,
					message: error.message,
					stack: error.stack
				});
			} else {
				console.error(`[${mountId.current}] Unknown error updating path data:`, 
					typeof error === 'object' ? JSON.stringify(error) : error);
			}
			return null;
		}
	};
};

/**
 * Creates a function to fetch user path data
 */
export const createFetchUserPathData = (supabase: SupabaseClient) => {
	return async (
		userId: string,
		mountId: React.MutableRefObject<string>,
		callbacks?: {
			onChosenEvents?: (events: Event[]) => void;
			onUnchosenEvents?: (events: Event[]) => void;
			onCurrentEvents?: (events: Event[]) => void;
		}
	) => {
		if (!userId) return null;

		try {
			const { data, error } = await supabase
				.from('user_paths')
				.select('*')
				.eq('user_id', userId)
				.order('updated_at', { ascending: false })
				.limit(1);

			if (error) {
				throw error;
			}

			if (data && data.length > 0 && data[0].path_data) {
				const pathData = data[0].path_data;
				console.log(`[${mountId.current}] Retrieved path data:`, pathData);

				// Handle both camelCase and snake_case property naming
				const chosenEvents = pathData.chosen_events || pathData.chosenEvents || [];
				const unchosenEvents = pathData.unchosen_events || pathData.unchosenEvents || [];
				const currentEventId = pathData.current_event_id || pathData.currentEventId;

				console.log(`[${mountId.current}] Setting path data - chosen events:`,
					chosenEvents ? chosenEvents.length : 0,
					"unchosen events:", unchosenEvents ? unchosenEvents.length : 0);

				// If callbacks are provided, call them with the retrieved data
				if (callbacks) {
					// If events are IDs, fetch the full events
					if (chosenEvents && chosenEvents.length > 0 && typeof chosenEvents[0] === 'string') {
						const { data: chosenEventData } = await supabase
							.from('events')
							.select('*')
							.in('id', chosenEvents);
						
						if (chosenEventData && callbacks.onChosenEvents) {
							callbacks.onChosenEvents(chosenEventData);
						}
					} else if (chosenEvents && callbacks.onChosenEvents) {
						// If chosen events are already complete objects
						callbacks.onChosenEvents(chosenEvents);
					}

					// Similar for unchosen events
					if (unchosenEvents && unchosenEvents.length > 0 && typeof unchosenEvents[0] === 'string') {
						const { data: unchosenEventData } = await supabase
							.from('events')
							.select('*')
							.in('id', unchosenEvents);
						
						if (unchosenEventData && callbacks.onUnchosenEvents) {
							callbacks.onUnchosenEvents(unchosenEventData);
						}
					} else if (unchosenEvents && callbacks.onUnchosenEvents) {
						callbacks.onUnchosenEvents(unchosenEvents);
					}

					// If current events are based on chosen events
					if (callbacks.onCurrentEvents) {
						if (currentEventId) {
							const { data: eventData } = await supabase
								.from('events')
								.select('*')
								.eq('id', currentEventId);
							
							if (eventData && eventData.length > 0) {
								callbacks.onCurrentEvents([eventData[0]]);
							}
						}
					}
				}

				return pathData;
			}

			console.log(`[${mountId.current}] No path data found for user`);
			return null;
		} catch (error) {
			console.error(`[${mountId.current}] Error fetching user path data:`, error);
			return null;
		}
	};
};