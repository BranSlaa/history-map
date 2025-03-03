import { useCallback, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { Event } from '@/types/event';
import supabase from '@/lib/supabaseClient';
import OpenAI from 'openai';
import crypto from 'crypto';

const openai = new OpenAI({
	apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
	dangerouslyAllowBrowser: true, // Only for client-side use
});

const maxEvents = 2;
const unchosenEventIds = new Set<string>();

async function fetchFromOpenAI(
	topic: string,
	title: string,
	year: number | null,
	numberOfEvents: number,
): Promise<Event[]> {
	console.log(`Fetching ${numberOfEvents} more events from OpenAI`);

	// Build prompt
	let prompt = `Provide exactly ${numberOfEvents} significant and DIVERSE historical events related to the topic "${topic}".`;

	// Help with building a path through history
	prompt += ` These events should be interesting connections to create a meaningful historical narrative or "Path through history".`;

	if (title) {
		prompt += ` The events should connect with the event titled '${title}' either conceptually, chronologically, or geographically.`;
	}

	if (year) {
		prompt += ` The events should have occurred shortly after the year ${year}, while still being related to the topic.`;
	}

	if (topic.includes('related to')) {
		prompt += ` Focus on finding DIFFERENT but RELATED events that would build upon the mentioned event, either by consequence, influence, or thematic connection.`;
	}

	prompt += `
		Each event must be unique and distinct from others already provided.
		
		Respond in JSON format as a list of objects, each containing:
		- "title" (string) - The specific title of the event (should be unique and descriptive)
		- "year" (int) - The precise year of the event (use negative number for BCE/BC)
		- "lat" (float) - The latitude coordinate of the event location
		- "lon" (float) - The longitude coordinate of the event location
		- "subject" (string) - The primary subject category of the event
		- "info" (string) - A brief description of the event and why it's significant
	`;

	try {
		console.log('Sending request to OpenAI for diverse historical events');

		// Make sure we have an API key before attempting the request
		if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
			console.error('OpenAI API key is missing');
			return [];
		}

		const response = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{
					role: 'system',
					content:
						'You are an expert historian specializing in finding connections between historical events across time and geography. Your goal is to help users build engaging, educational paths through history by suggesting diverse but meaningfully connected events.',
				},
				{ role: 'user', content: prompt },
			],
			max_tokens: 500,
		});

		console.log('OpenAI response received');

		if (!response.choices[0].message.content) {
			console.error('OpenAI returned empty content');
			return [];
		}

		const rawContent = response.choices[0].message.content.trim();
		console.log('Raw OpenAI response:', rawContent);

		const cleanedJson = rawContent.replace(/```json|```/g, '').trim();

		try {
			const suggestions = JSON.parse(cleanedJson);
			console.log('Successfully parsed OpenAI response:', suggestions);

			const returnedEventIds = new Set();
			const newEvents: Event[] = [];

			for (const item of suggestions) {
				if (
					item &&
					typeof item === 'object' &&
					'title' in item &&
					'year' in item &&
					'lat' in item &&
					'lon' in item &&
					'subject' in item &&
					'info' in item
				) {
					const eventId = crypto
						.createHash('sha256')
						.update(`${item.title}-${item.year}`)
						.digest('hex');

					if (!returnedEventIds.has(eventId)) {
						newEvents.push({
							id: eventId,
							title: item.title,
							year: parseInt(item.year),
							lat: parseFloat(item.lat),
							lon: parseFloat(item.lon),
							subject: item.subject,
							info: item.info,
						});

						returnedEventIds.add(eventId);

						if (newEvents.length === numberOfEvents) {
							break;
						}
					}
				}
			}

			console.log(
				`Parsed ${newEvents.length} new events from OpenAI response`,
			);

			try {
				// Save the events to the database before returning them
				console.log('Attempting to save OpenAI events to database');
				await saveEventsToDatabase(newEvents);
				console.log('Events saved successfully');

				return newEvents;
			} catch (saveError) {
				console.error(
					'Error while saving events to database:',
					saveError,
				);
				// Return the events even if saving fails
				return newEvents;
			}
		} catch (parseError) {
			console.error('Error parsing OpenAI response:', parseError);
			console.log('Raw response:', rawContent);
			return [];
		}
	} catch (error) {
		console.error('Error fetching from OpenAI:', error);
		return [];
	}
}

// Function to generate embedding for an event
async function generateEmbeddingForEvent(
	event: Event,
): Promise<number[] | null> {
	try {
		// Create a text representation of the event for embedding generation
		const textToEmbed = `${event.title}. ${event.info} This event occurred in year ${event.year} and is related to ${event.subject}.`;

		console.log(`Generating embedding for event: ${event.title}`);

		// Set a timeout for embedding generation
		const timeout = new Promise<null>(resolve => {
			setTimeout(() => {
				console.warn(
					`Embedding generation for "${event.title}" timed out after 5 seconds`,
				);
				resolve(null);
			}, 5000);
		});

		// Use the API route to generate embedding
		const fetchPromise = fetch('/api/generate-embedding', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ text: textToEmbed }),
		})
			.then(async response => {
				if (!response.ok) {
					const errorText = await response.text();
					console.error('Error generating embedding:', errorText);
					return null;
				}

				const embedding = await response.json();
				return embedding;
			})
			.catch(error => {
				console.error('Failed to fetch embedding:', error);
				return null;
			});

		// Race between fetch and timeout
		const embedding = await Promise.race([fetchPromise, timeout]);
		return embedding;
	} catch (error) {
		console.error('Failed to generate embedding for event:', error);
		return null;
	}
}

// Function to save events to the database
async function saveEventsToDatabase(events: Event[]): Promise<void> {
	if (!events || events.length === 0) return;

	console.log(
		`Saving ${events.length} OpenAI-generated events to the database`,
	);

	try {
		// First, generate embeddings for all events with a time limit
		const eventsWithEmbeddings = [...events];

		for (let i = 0; i < events.length; i++) {
			const event = events[i];
			if (!event.embedding) {
				try {
					console.log(
						`Processing embedding for event ${i + 1}/${events.length}: ${event.title}`,
					);
					const embedding = await generateEmbeddingForEvent(event);
					if (embedding) {
						eventsWithEmbeddings[i] = { ...event, embedding };
					}
				} catch (embeddingError) {
					console.error(
						`Error generating embedding for event #${i + 1}:`,
						embeddingError,
					);
					// Continue with the event without embedding
				}
			}
		}

		// Set a timeout for saving to database
		const apiTimeout = new Promise<void>((_, reject) => {
			setTimeout(() => {
				reject(
					new Error(
						'Database save operation timed out after 10 seconds',
					),
				);
			}, 10000);
		});

		// Use server-side API route to save events
		const savePromise = new Promise<void>(async (resolve, reject) => {
			try {
				console.log('Sending events to save-events API...');
				const response = await fetch('/api/save-events', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ events: eventsWithEmbeddings }),
				});

				if (!response.ok) {
					const errorData = await response.json();
					console.error('Error saving events:', errorData);
					reject(
						new Error(
							`API returned status ${response.status}: ${JSON.stringify(errorData)}`,
						),
					);
					return;
				}

				const result = await response.json();
				console.log('Events save result:', result);

				// Log individual event results
				if (result.results) {
					result.results.forEach((r: any) => {
						const eventTitle =
							events.find(e => e.id === r.id)?.title ||
							'Unknown event';

						if (r.success === true) {
							console.log(`${r.message}: ${eventTitle}`);
						} else {
							console.error(
								`Error saving event: ${eventTitle}`,
								r.message,
							);
						}
					});
				}
				resolve();
			} catch (error) {
				console.error('Error in save operation:', error);
				reject(error);
			}
		});

		// Race between save operation and timeout
		await Promise.race([savePromise, apiTimeout]);
	} catch (error) {
		console.error('Failed to save events:', error);
		// Allow the function to complete even if saving fails
	}
}

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

export const AdjustMapView: React.FC<{ events: Event[] }> = ({ events }) => {
	const map = useMap();

	useEffect(() => {
		if (events.length === 0 || typeof window === 'undefined') return;

		try {
			// Import leaflet dynamically to avoid SSR issues
			const L = require('leaflet');

			if (events.length > 0 && map) {
				const bounds = L.latLngBounds(
					events.map(event => [event.lat, event.lon]),
				);
				map.fitBounds(bounds, { padding: [50, 50] });
			}
		} catch (error) {
			console.error('Error adjusting map view:', error);
		}
	}, [events, map]);

	return null;
};
