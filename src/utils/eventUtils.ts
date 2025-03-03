import { useCallback } from "react";
import supabase from '@/lib/supabaseClient';
import { Event } from '@/types/event';
import { SupabaseClient } from '@supabase/supabase-js';
import { fetchFromOpenAI } from './aiUtils';

// Constants
const maxEvents = 2;
const unchosenEventIds = new Set<string>();

export const fetchEvents = (
	setLoading: React.Dispatch<React.SetStateAction<boolean>>,
	setEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	events: Event[],
) =>
	useCallback(
		async (
			topic: string,
			title: string,
			year?: number,
			onEventsFetched?: (newEvents: Event[]) => void,
		) => {
			setLoading(true);

			try {
				console.log('Search Parameters:');
				console.log('- topic:', topic);
				console.log('- title:', title);
				console.log('- year:', year);

				if (title && events.length > 0) {
					const selectedEvent = events.find(e => e.title === title);
					if (selectedEvent) {
						// Only add events from the current set of options (max 2) to unchosen
						const currentOptions = events.slice(-maxEvents);
						currentOptions.forEach(event => {
							if (event.id !== selectedEvent.id) {
								unchosenEventIds.add(event.id);
							}
						});
					}
				}

				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (!user?.id) {
					console.error('No user ID found');
					return;
				}

				let query = supabase
					.from('events')
					.select('*')
					.order('year', { ascending: true });

				if (year !== undefined) {
					query = query.gte('year', year);
				}

				if (title) {
					query = query.ilike('title', `%${title}%`);
				}

				// Exclude both interacted and unchosen events
				interface EventInteraction {
					event_id: string;
				}

				const { data: interactedEvents = [] } = (await supabase
					.from('user_event_interactions')
					.select('event_id')
					.eq('user_id', user.id)) as {
					data: EventInteraction[] | null;
				};

				const safeInteractedEvents = interactedEvents || [];
				const allExcludedIds = [
					...safeInteractedEvents.map(ie => ie.event_id),
					...Array.from(unchosenEventIds),
				];

				if (allExcludedIds.length > 0) {
					query = query.not(
						'id',
						'in',
						`(${allExcludedIds.map(id => `'${id}'`).join(',')})`,
					);
				}

				if (topic) {
					console.log('Topic search:', topic);
					await supabase.rpc('track_search_term', {
						p_term: topic,
						p_had_results: false,
					});

					if (!topic.includes(' ')) {
						query = query.or(
							`title.ilike.%${topic}%,info.ilike.%${topic}%`,
						);
					} else {
						try {
							const response = await fetch(
								'/api/generate-embedding',
								{
									method: 'POST',
									headers: {
										'Content-Type': 'application/json',
									},
									body: JSON.stringify({ text: topic }),
								},
							);

							if (!response.ok) {
								throw new Error(
									`API responded with status: ${response.status}`,
								);
							}

							const embedding = await response.json();
							const {
								data: semanticResults,
								error: searchError,
							} = await supabase.rpc('match_events', {
								query_embedding: embedding,
								match_threshold: 0.9,
								match_count: maxEvents,
							});

							if (semanticResults && !searchError) {
								await supabase.rpc('track_search_term', {
									p_term: topic,
									p_had_results: semanticResults.length > 0,
								});

								const filteredResults = semanticResults.filter(
									(event: Event) =>
										!safeInteractedEvents.some(
											ie => ie.event_id === event.id,
										),
								);

								if (filteredResults.length > 0) {
									if (title) {
										const selectedEvent = events.find(
											e => e.title === title,
										);
										setEvents(() =>
											selectedEvent
												? [
														selectedEvent,
														...filteredResults,
													]
												: filteredResults,
										);
									} else {
										setEvents(() => filteredResults);
									}
									if (onEventsFetched)
										onEventsFetched(filteredResults);
									setLoading(false);
									return;
								}
							}
						} catch (error) {
							console.error('Vector search failed:', error);
							query = query.or(
								`title.ilike.%${topic}%,info.ilike.%${topic}%`,
							);
						}
					}
				}

				query = query.limit(maxEvents);
				const { data: queryData, error } = await query;

				if (error) {
					console.error('Failed to fetch events:', error);
					setLoading(false);
					return;
				}

				const data = queryData || [];
				console.log(
					`Retrieved ${data.length} events from database query`,
				);

				if (topic) {
					await supabase.rpc('track_search_term', {
						p_term: topic,
						p_had_results: data.length > 0,
					});
				}

				if (data.length === 0) {
					const additionalEvents = await fetchFromOpenAI(
						topic,
						title,
						year || null,
						maxEvents,
					);
					if (additionalEvents.length > 0) {
						// If we're exploring from a selected event, keep it and add new events
						if (title) {
							const selectedEvent = events.find(
								e => e.title === title,
							);
							setEvents(prevEvents =>
								selectedEvent
									? [selectedEvent, ...additionalEvents]
									: additionalEvents,
							);
						} else {
							setEvents(prevEvents => [
								...prevEvents,
								...additionalEvents,
							]);
						}
						if (onEventsFetched) onEventsFetched(additionalEvents);
					}
				} else {
					// If we're exploring from a selected event, keep it and add new events
					if (title) {
						const selectedEvent = events.find(
							e => e.title === title,
						);
						setEvents(prevEvents =>
							selectedEvent ? [selectedEvent, ...data] : data,
						);
					} else {
						setEvents(prevEvents => [...prevEvents, ...data]);
					}
					if (onEventsFetched) onEventsFetched(data);
				}
			} catch (error) {
				console.error('Failed to fetch events:', error);
			} finally {
				setLoading(false);
			}
		},
		[],
	);

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
			
			// Check for current_event_id in different levels of the data structure
			let currentEventId = 
				// First check root level
				pathData[0].current_event_id || 
				// Then check path_data object
				(pathData[0].path_data && pathData[0].path_data.current_event_id);
			
			console.log(`[${mountId.current}] Current event ID:`, currentEventId);
			
			// Check if we have chosen events
			const chosenEvents = pathData[0].path_data && pathData[0].path_data.chosen_events
				? pathData[0].path_data.chosen_events
				: [];
			
			console.log(`[${mountId.current}] Chosen events:`, chosenEvents);
			
			// Fallback: If no current event ID but we have chosen events, use the last chosen event
			if (!currentEventId && chosenEvents && chosenEvents.length > 0) {
				currentEventId = chosenEvents[chosenEvents.length - 1];
				console.log(`[${mountId.current}] Using last chosen event as fallback:`, currentEventId);
			}
			
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
		if (!userId) return;

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

			// Create path data object with both camelCase (client) and snake_case (database) properties
			// to ensure compatibility
			const pathData = {
				chosenEvents: chosenEventIds,
				chosen_events: chosenEventIds,
				unchosenEvents: unchosenEventIds,
				unchosen_events: unchosenEventIds,
				currentEventId,
				current_event_id: currentEventId,
			};

			// Log the path data to be sent
			console.log(`[${mountId.current}] Path data to be sent:`, JSON.stringify(pathData));

			// Send directly to Supabase
			const { data, error } = await supabase
				.from('user_paths')
				.upsert(
					{
						user_id: userId,
						path_data: pathData,
						current_event_id: currentEventId,
						updated_at: new Date().toISOString(),
					},
					{ onConflict: 'user_id' },
				)
				.select();

			if (error) {
				throw error;
			}

			console.log(`[${mountId.current}] Updated path data in database:`, data);
			return data;
		} catch (error) {
			console.error(`[${mountId.current}] Error updating path data:`, error);
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