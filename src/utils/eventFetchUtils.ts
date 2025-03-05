import { Event } from '@/types/event';
import { SupabaseClient } from '@supabase/supabase-js';
import supabase from '@/lib/supabaseClient';
import { fetchFromOpenAI } from './aiUtils';
import { trackUserActivity } from './interactionUtils';

// Create a wrapper that maintains the same signature but uses the unified fetchEvents function
export const fetchEventsCallback = async (
	topic: string,
	title: string,
	year: number | undefined,
	onEventsFetched: ((newEvents: Event[]) => void) | undefined,
	setLoading: React.Dispatch<React.SetStateAction<boolean>>,
	setCurrentEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	chosenEvents: Event[],
	unchosenEvents: Event[],
	selectedEvent: Event | null,
) => {
	// Create a fetchEvents instance with the correct parameters
	const fetchEventsInstance = fetchEvents(setLoading, setCurrentEvents, []);
	
	console.log('fetchEventsCallback: Delegating to unified fetchEvents function');
	console.log('Parameters:', {
		chosenEventsCount: chosenEvents.length,
		unchosenEventsCount: unchosenEvents.length,
		hasSelectedEvent: !!selectedEvent
	});
	
	// Call the fetchEvents function
	return fetchEventsInstance(
		topic, 
		title, 
		year, 
		onEventsFetched,
		chosenEvents,
		unchosenEvents,
		selectedEvent
	);
};

export const fetchMoreEvents = (
	currentEvents: Event[], 
	selectedEvent: Event | null,
	setUnchosenEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	setChosenEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	setCurrentEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	updatePathData: () => Promise<void>,
	recordEventInteraction: (eventId: string, previousEventId?: string) => void,
	fetchEventsCallback: (
		topic: string,
		title: string,
		year?: number,
		onEventsFetched?: (newEvents: Event[]) => void,
		isAdditionalEvent?: boolean,
	) => void,
	topic: string,
	chosenEvents: Event[] = [],
	unchosenEvents: Event[] = []
) => {
	console.log('fetchMoreEvents called');
	console.log('Current events:', currentEvents.length);
	console.log('Selected event:', selectedEvent?.title);
	console.log('Selected event ID:', selectedEvent?.id);
	console.log('Chosen events count:', chosenEvents.length);
	console.log('Unchosen events count:', unchosenEvents.length);

	// Only proceed if explicitly requested through a UI action
	if (selectedEvent) {
		console.log(`Fetching more events related to ${selectedEvent.title}`);

		// Now move unselected events to unchosenEvents
		const otherEvents = currentEvents.filter(
			e => e.id !== selectedEvent.id,
		);
		if (otherEvents.length > 0) {
			setUnchosenEvents(prev => [...prev, ...otherEvents]);
			// Should always be 1
			console.log(
				`Moving ${otherEvents.length} unselected events to unchosenEvents`,
			);

			// Keep only the selected event in the current list when exploring more
			setCurrentEvents([selectedEvent]);
			console.log('Current events now contains only the selected event');

			// Update the path data in the database
			updatePathData();
		}

		setChosenEvents(prev => [...prev, selectedEvent]);

		// Record this interaction
		recordEventInteraction(selectedEvent.id, selectedEvent.id);

		// Note we don't pass chosenEvents and unchosenEvents explicitly here
		// since they are handled in the fetchEventsCallback wrapper
		fetchEventsCallback(
			`related to ${selectedEvent.title}`,
			selectedEvent.title,
			selectedEvent.year,
			newEvents => {
				console.log(
					`Received ${newEvents.length} new events related to ${selectedEvent.title}`,
				);
				console.log(
					'New event IDs:',
					newEvents.map(e => e.id),
				);
			},
			false  // Not an additional event
		);
	} else {
		console.log('No selected event, fetching with topic:', topic);
		// No year filter in the fetch - we'll filter on the client side
		// Note we don't pass chosenEvents and unchosenEvents explicitly here
		// since they are handled in the fetchEventsCallback wrapper
		fetchEventsCallback(
			topic, 
			'', 
			undefined, 
			newEvents => {
				console.log(
					`Received ${newEvents.length} new events for topic: ${topic}`,
				);
			},
			false  // Not an additional event
		);
	}
};

// Constants
const maxEvents = 2;
const unchosenEventIds = new Set<string>();

// Regular function that returns a callback function instead of using useCallback
export const fetchEvents = (
	setLoading: React.Dispatch<React.SetStateAction<boolean>>,
	setEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	events: Event[],
) => {
	// Return a function that can be called with the parameters
	return async (
		topic: string,
		title: string,
		year?: number,
		onEventsFetched?: (newEvents: Event[]) => void,
		chosenEvents: Event[] = [],
		unchosenEvents: Event[] = [],
		selectedEvent: Event | null = null,
	) => {
		setLoading(true);

		try {
			console.log('Search Parameters:');
			console.log('- topic:', topic);
			console.log('- title:', title);
			console.log('- year:', year);
			console.log('- chosenEvents count:', chosenEvents.length);
			console.log('- unchosenEvents count:', unchosenEvents.length);

			if (title && events.length > 0) {
				const eventSelected = events.find(e => e.title === title);
				if (eventSelected) {
					// Add other events from the current set to unchosen
					const currentOptions = events.slice(-maxEvents);
					currentOptions.forEach(event => {
						if (event.id !== eventSelected.id) {
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

			// Track search activity if a topic is provided
			if (topic) {
				// Track the search activity
				await trackUserActivity(user.id, 'search');
			}

			// Build database query
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

			// Exclude events using a Set for deduplication
			interface EventInteraction {
				event_id: string;
			}

			// Get previously interacted events
			const { data: interactedEvents = [] } = (await supabase
				.from('user_event_interactions')
				.select('event_id')
				.eq('user_id', user.id)) as {
				data: EventInteraction[] | null;
			};

			// Create a Set of all event IDs to exclude to ensure uniqueness
			const excludeIdSet = new Set<string>();
			
			// Add all sources of excluded events to the Set
			
			// 1. Add interacted events from database
			(interactedEvents || []).forEach(ie => excludeIdSet.add(ie.event_id));
			
			// 2. Add unchosen events from memory
			Array.from(unchosenEventIds).forEach(id => excludeIdSet.add(id));
			
			// 3. Add chosen events from parameters
			chosenEvents.forEach(event => excludeIdSet.add(event.id));
			
			// 4. Add unchosen events from parameters
			unchosenEvents.forEach(event => excludeIdSet.add(event.id));
			
			// 5. Add selected event if provided
			if (selectedEvent) {
				excludeIdSet.add(selectedEvent.id);
			}

			// Convert Set to Array for the query
			const allExcludedIds = Array.from(excludeIdSet);

			// Apply exclusion to the query
			if (allExcludedIds.length > 0) {
				console.log(`Excluding ${allExcludedIds.length} unique event IDs`);
				console.log('Sample of excluded IDs:', allExcludedIds.slice(0, 3));
				query = query.not(
					'id',
					'in',
					`(${allExcludedIds.map(id => `'${id}'`).join(',')})`,
				);
			}

			// Handle topic search
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

							// Filter out events that should be excluded
							const filteredResults = semanticResults.filter(
								(event: Event) => !excludeIdSet.has(event.id)
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
			
			// Execute the query
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
			
			// Double-check that we're not fetching any excluded events
			const filteredQueryData = data.filter(event => !excludeIdSet.has(event.id));

			if (filteredQueryData.length < data.length) {
				console.log(`Filtered out ${data.length - filteredQueryData.length} duplicate events from query results`);
			}

			if (topic) {
				await supabase.rpc('track_search_term', {
					p_term: topic,
					p_had_results: filteredQueryData.length > 0,
				});
			}

			// If no results from database, try OpenAI
			if (filteredQueryData.length === 0) {
				const additionalEvents = await fetchFromOpenAI(
					topic,
					title,
					year || null,
					2,
				);
				
				// Filter out any events that should be excluded
				const filteredAdditionalEvents = additionalEvents.filter(
					(event: Event) => !excludeIdSet.has(event.id)
				);
				
				if (filteredAdditionalEvents.length > 0) {
					// If we're exploring from a selected event, keep it and add new events
					if (title) {
						const selectedEvent = events.find(
							e => e.title === title,
						);
						
						setEvents(prevEvents => {
							// First check if we already have the selected event
							const hasSelectedEvent = prevEvents.some(e => e.title === title);
							// If the selected event is already in the list, just add new events
							if (hasSelectedEvent) {
								return [...prevEvents, ...filteredAdditionalEvents];
							}
							// Otherwise add selected event and new events
							return selectedEvent 
								? [...prevEvents, selectedEvent, ...filteredAdditionalEvents]
								: [...prevEvents, ...filteredAdditionalEvents];
						});
					
					} else {
						// Always append events when no title is specified
						setEvents(prevEvents => [
							...prevEvents,
							...filteredAdditionalEvents,
						]);
					}
					if (onEventsFetched) onEventsFetched(filteredAdditionalEvents);
				}
			} else {
				// We got events from the database
				
				// If we're exploring from a selected event, keep it and add new events
				if (title) {
					const selectedEvent = events.find(
						e => e.title === title,
					);
					
					// If this is an additional event, always append to existing events
					setEvents(prevEvents => {
						// First check if we already have the selected event
						const hasSelectedEvent = prevEvents.some(e => e.title === title);
						// If the selected event is already in the list, just add new events
						if (hasSelectedEvent) {
							return [...prevEvents, ...filteredQueryData];
						}
						// Otherwise add selected event and new events
						return selectedEvent 
							? [...prevEvents, selectedEvent, ...filteredQueryData]
							: [...prevEvents, ...filteredQueryData];
					});
				} else {
					// Always append events when no title is specified
					setEvents(prevEvents => [...prevEvents, ...filteredQueryData]);
				}
				if (onEventsFetched) onEventsFetched(filteredQueryData);
			}
		} catch (error) {
			console.error('Failed to fetch events:', error);
		} finally {
			setLoading(false);
		}
	};
};