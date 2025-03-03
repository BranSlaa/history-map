import { Event } from '@/types/event';

// Function to generate embedding for an event
async function generateEmbeddingForEvent(event: Event): Promise<number[] | null> {
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
export async function saveEventsToDatabase(events: Event[]): Promise<void> {
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