import { Event } from '@/types/event';
import { SupabaseClient } from '@supabase/supabase-js';

export const fetchEventsCallback = async (
	topic: string,
	title: string,
	year: number | undefined,
	onEventsFetched: ((newEvents: Event[]) => void) | undefined,
	isAdditionalEvent: boolean = false,
	supabase: SupabaseClient,
	isEventAlreadyInLists: (eventId: string) => boolean,
	setLoading: (loading: boolean) => void,
	setCurrentEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	interactedEventIds: Set<string>,
	chosenEvents: Event[],
	unchosenEvents: Event[],
	selectedEvent: Event | null,
) => {
	setLoading(true);

	try {
		console.log('Search Parameters:', {
			topic,
			title,
			year,
			isAdditionalEvent,
		});

		// Get current user
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user?.id) {
			console.error('No user ID found');
			return;
		}

		// Step 1: Build exclusion list from all three sources
		const excludedIds = [
			...Array.from(interactedEventIds),
			...chosenEvents.map(event => event.id),
			...unchosenEvents.map(event => event.id),
		];

		// Always exclude the selected event to prevent self-fetching
		if (selectedEvent) {
			if (!excludedIds.includes(selectedEvent.id)) {
				excludedIds.push(selectedEvent.id);
			}
			console.log('Excluding selected event ID:', selectedEvent.id);
		}

		// For additional event, we need to limit to just 1
		const limitCount = isAdditionalEvent ? 1 : 2;
		console.log(`Setting limit to ${limitCount} events`);
		console.log('Total excluded IDs:', excludedIds.length);

		// Handle the case where no IDs are found
		if (excludedIds.length === 0) {
			console.log('No events to exclude');
		} else {
			console.log('Sample of excluded IDs:', excludedIds.slice(0, 3));
		}

		// Step 2: Build database query with all filters
		let query = supabase
			.from('events')
			.select('*')
			.order('year', { ascending: true });

		// Add year filter if provided
		if (year !== undefined) {
			query = query.gte('year', year);
		}

		// Add title filter if provided
		if (title) {
			// Use fuzzy search instead of exact match
			query = query.textSearch('title', title, {
				type: 'plain',
				config: 'english',
			});
		}

		// CRITICAL: Exclude already seen events with proper SQL syntax
		if (excludedIds.length > 0) {
			// Use a more explicit NOT IN syntax
			const notInClause = `(${excludedIds.map(id => `'${id}'`).join(',')})`;
			console.log('NOT IN clause:', notInClause);

			// Apply the NOT IN filter
			query = query.not('id', 'in', notInClause);
		}

		// Limit results
		query = query.limit(limitCount);

		// Log query information - since we can't access the internal query parameters
		console.log('Query constructed with:', {
			excludedIds: excludedIds.length,
			yearFilter: year,
			title,
			limitCount,
		});

		// Step 3: Execute query
		const { data, error } = await query;

		if (error) {
			throw new Error(`Database query failed: ${error.message}`);
		}

		console.log('Query results:', data?.length || 0, 'events found');
		if (data?.length) {
			console.log(
				'Result IDs:',
				data.map(e => e.id),
			);
		}

		// Step 4: Handle results or fallback to OpenAI
		let newEvents: Event[] = [];

		if (data && data.length > 0) {
			// We got events from the database
			newEvents = data;

			// Double-check that we're not fetching the selected event
			if (selectedEvent) {
				newEvents = newEvents.filter(
					event => event.id !== selectedEvent.id,
				);
			}

			if (newEvents.length === 0) {
				console.warn(
					'All fetched events were filtered out by client-side checks',
				);
			}
		} else {
			// No results from database, try OpenAI
			const response = await fetch('/api/generate-events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					topic,
					title,
					year: year || null,
					count: limitCount,
				}),
			});

			if (!response.ok) {
				throw new Error(`API request failed: ${response.status}`);
			}

			newEvents = await response.json();

			// Also filter these results to ensure no duplicates
			if (selectedEvent) {
				newEvents = newEvents.filter(
					event => event.id !== selectedEvent.id,
				);
			}
		}

		// Step 5: Update state based on context
		if (newEvents.length > 0) {
			// Filter out any events that already exist in our lists
			const uniqueEvents = newEvents.filter(
				event => !isEventAlreadyInLists(event.id),
			);

			if (uniqueEvents.length < newEvents.length) {
				console.log(
					`Filtered out ${newEvents.length - uniqueEvents.length} duplicate events`,
				);
			}

			if (uniqueEvents.length > 0) {
				if (isAdditionalEvent) {
					// Adding additional event - add new events to current events
					console.log('Adding additional event to current events');
					setCurrentEvents(current => [...current, ...uniqueEvents]);
				} else if (title && selectedEvent) {
					// Exploring from a selected event - add new events to current events
					console.log('Adding related events to current events');
					setCurrentEvents(current => [...current, ...uniqueEvents]);
				} else {
					// Initial search - set new events as current events
					console.log('Setting new events as current events');
					setCurrentEvents(uniqueEvents);
				}

				// Call the callback if provided
				if (onEventsFetched) {
					onEventsFetched(uniqueEvents);
				}
			} else {
				console.log('All events were filtered as duplicates');
				if (onEventsFetched) {
					onEventsFetched([]);
				}
			}
		} else {
			console.log('No events found');
			if (onEventsFetched) {
				onEventsFetched([]);
			}
		}
	} catch (error) {
		console.error('Error fetching events:', error);
	} finally {
		setLoading(false);
	}
};

export const fetchMoreEvents = (
	currentEvents: Event[], 
	selectedEvent: Event | null,
	setUnchosenEvents: React.Dispatch<React.SetStateAction<Event[]>>,
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
	topic: string
) => {
	console.log('fetchMoreEvents called');
	console.log('Current events:', currentEvents.length);
	console.log('Selected event:', selectedEvent?.title);
	console.log('Selected event ID:', selectedEvent?.id);

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

		// Record this interaction
		recordEventInteraction(selectedEvent.id, selectedEvent.id);

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
		);
	} else {
		console.log('No selected event, fetching with topic:', topic);
		// No year filter in the fetch - we'll filter on the client side
		fetchEventsCallback(topic, '', undefined, newEvents => {
			console.log(
				`Received ${newEvents.length} new events for topic: ${topic}`,
			);
		});
	}
}; 