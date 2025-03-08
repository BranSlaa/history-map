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
				.from('paths')
				.select('*')
				.eq('user_id', userId)
				.eq('status', 'active')
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
			
			// Check for currentEventId
			const currentEventId = pathData[0].current_event_id;
			
			console.log(`[${mountId.current}] Current event ID:`, currentEventId);
			
			if (!currentEventId) {
				console.log(`[${mountId.current}] No current event ID found in path data`);
				return null;
			}
			
			// Fetch the event from the database
			try {
				const { data, error } = await supabase
					.from('events')
					.select('*')
					.eq('id', currentEventId);
				
				if (error) {
					console.error(`[${mountId.current}] Error fetching last event:`, error);
					return null;
				}
				
				if (!data || data.length === 0) {
					console.log(`[${mountId.current}] No event found with ID:`, currentEventId);
					return null;
				}
				
				console.log(`[${mountId.current}] Last event found:`, data[0].title);
				return data[0];
			} catch (queryError) {
				console.error(`[${mountId.current}] Error querying event:`, queryError);
				return null;
			}
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
			// Get the current event ID
			const currentEventId = selectedEvent?.id;

			console.log(`[${mountId.current}] Updating path data with:`, {
				chosenEvents: chosenEvents.length,
				unchosenEvents: unchosenEvents.length,
				currentEventId,
			});

			// First check if an active path exists for this user
			const { data: existingData, error: checkError } = await supabase
				.from('paths')
				.select('id, search_term, title')
				.eq('user_id', userId)
				.eq('status', 'active')
				.order('updated_at', { ascending: false })
				.limit(1);

			if (checkError) {
				console.error(`[${mountId.current}] Error checking for existing path data:`, checkError);
				throw checkError;
			}

			let result;
			let pathId;
			
			if (existingData && existingData.length > 0) {
				// Update existing path
				pathId = existingData[0].id;
				console.log(`[${mountId.current}] Updating existing path record ${pathId} for user ${userId}`);
				
				const { data, error } = await supabase
					.from('paths')
					.update({
						current_event_id: currentEventId,
						event_count: chosenEvents.length,
						updated_at: new Date().toISOString(),
					})
					.eq('id', pathId)
					.select();

				if (error) {
					console.error(`[${mountId.current}] Update error:`, error);
					throw error;
				}
				result = data;
				
				// Update path_events table for this path
				// Only add new chosen events that aren't already in the database
				if (chosenEvents.length > 0) {
					for (let i = 0; i < chosenEvents.length; i++) {
						const event = chosenEvents[i];
						
						// Check if this event is already in path_events
						const { data: existingEvent, error: eventCheckError } = await supabase
							.from('path_events')
							.select('id')
							.eq('path_id', pathId)
							.eq('event_id', event.id)
							.limit(1);
							
						if (eventCheckError) {
							console.error(`[${mountId.current}] Error checking if event exists in path:`, eventCheckError);
							continue;
						}
						
						// Only add if it doesn't already exist
						if (!existingEvent || existingEvent.length === 0) {
							const { error: insertError } = await supabase
								.from('path_events')
								.insert({
									path_id: pathId,
									event_id: event.id,
									title: event.title,
									event_order: i,
								});
								
							if (insertError) {
								console.error(`[${mountId.current}] Error inserting path event:`, insertError);
							}
						}
					}
				}
			} else if (selectedEvent) {
				// Create a new path only if there's a selected event
				console.log(`[${mountId.current}] Creating new path record for user ${userId}`);
				
				const { data, error } = await supabase
					.from('paths')
					.insert({
						user_id: userId,
						search_term: selectedEvent.subject || 'History',
						subject: selectedEvent.subject || 'History',
						title: selectedEvent.title,
						current_event_id: currentEventId,
						event_count: chosenEvents.length > 0 ? chosenEvents.length : 1,
					})
					.select();

				if (error) {
					console.error(`[${mountId.current}] Insert error:`, error);
					throw error;
				}
				result = data;
				
				// Get the newly created path ID
				pathId = data[0].id;
				
				// Add the selected event to path_events
				const { error: insertError } = await supabase
					.from('path_events')
					.insert({
						path_id: pathId,
						event_id: selectedEvent.id,
						title: selectedEvent.title,
						event_order: 0,
					});
					
				if (insertError) {
					console.error(`[${mountId.current}] Error inserting initial path event:`, insertError);
				}
				
				// Add any other chosen events
				if (chosenEvents.length > 0) {
					for (let i = 0; i < chosenEvents.length; i++) {
						const event = chosenEvents[i];
						if (event.id !== selectedEvent.id) {
							const { error: insertError } = await supabase
								.from('path_events')
								.insert({
									path_id: pathId,
									event_id: event.id,
									title: event.title,
									event_order: i + 1,
								});
								
							if (insertError) {
								console.error(`[${mountId.current}] Error inserting additional path event:`, insertError);
							}
						}
					}
				}
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
			// Fetch the active path
			const { data: pathData, error: pathError } = await supabase
				.from('paths')
				.select('id, current_event_id')
				.eq('user_id', userId)
				.eq('status', 'active')
				.order('updated_at', { ascending: false })
				.limit(1);

			if (pathError) {
				console.error(`[${mountId.current}] Error fetching path:`, pathError);
				throw pathError;
			}

			if (!pathData || pathData.length === 0) {
				console.log(`[${mountId.current}] No active path found for user ${userId}`);
				return null;
			}

			const pathId = pathData[0].id;
			const currentEventId = pathData[0].current_event_id;
			
			// Fetch events in this path
			const { data: pathEvents, error: eventsError } = await supabase
				.from('path_events')
				.select('event_id, title, event_order')
				.eq('path_id', pathId)
				.order('event_order', { ascending: true });
				
			if (eventsError) {
				console.error(`[${mountId.current}] Error fetching path events:`, eventsError);
				throw eventsError;
			}
			
			if (!pathEvents || pathEvents.length === 0) {
				console.log(`[${mountId.current}] No events found in path ${pathId}`);
				return null;
			}
			
			// Fetch full event details
			const eventIds = pathEvents.map(pe => pe.event_id);
			const { data: events, error: fullEventsError } = await supabase
				.from('events')
				.select('*')
				.in('id', eventIds);
				
			if (fullEventsError) {
				console.error(`[${mountId.current}] Error fetching full event details:`, fullEventsError);
				throw fullEventsError;
			}
			
			if (!events || events.length === 0) {
				console.log(`[${mountId.current}] No full event details found`);
				return null;
			}
			
			// Convert to Event objects and sort by path order
			const chosenEvents: Event[] = [];
			for (const pathEvent of pathEvents) {
				const fullEvent = events.find(e => e.id === pathEvent.event_id);
				if (fullEvent) {
					chosenEvents.push(fullEvent);
				}
			}
			
			// Find the current event
			const currentEvent = currentEventId 
				? events.find(e => e.id === currentEventId) 
				: null;
				
			if (callbacks) {
				if (callbacks.onChosenEvents) {
					callbacks.onChosenEvents(chosenEvents);
				}
				if (callbacks.onUnchosenEvents) {
					callbacks.onUnchosenEvents([]);  // We don't store unchosen events anymore
				}
				if (callbacks.onCurrentEvents && currentEvent) {
					callbacks.onCurrentEvents([currentEvent]);
				}
			}
			
			return {
				chosenEvents,
				unchosenEvents: [],
				currentEventId,
			};
		} catch (error) {
			console.error(`[${mountId.current}] Error fetching user path data:`, error);
			return null;
		}
	};
};