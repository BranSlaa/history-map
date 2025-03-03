import { Event } from '@/types/event';
import OpenAI from 'openai';
import crypto from 'crypto';
import { saveEventsToDatabase } from './databaseUtils';

const openai = new OpenAI({
	apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
	dangerouslyAllowBrowser: true, // Only for client-side use
});

export async function fetchFromOpenAI(
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