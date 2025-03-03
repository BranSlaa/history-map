import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import crypto from 'crypto';
import { Event } from '@/types/event';
import supabase from '@/lib/supabaseClient';

const openai = new OpenAI({
	apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
	dangerouslyAllowBrowser: true, // Only for client-side use
});

export async function POST(req: NextRequest) {
	try {
		const { topic, title, year, count = 2 } = await req.json();

		console.log(`Generating ${count} events via API for topic: ${topic}`);

		// Build prompt
		let prompt = `Provide exactly ${count} significant and DIVERSE historical events related to the topic "${topic}".`;

		// Help with building a path through history
		prompt += ` These events should be interesting connections to create a meaningful historical narrative or "Path through history".`;

		if (title) {
			prompt += ` The events should connect with the event titled '${title}' either conceptually, chronologically, or geographically.`;
		}

		if (year) {
			prompt += ` These events should have occurred around the year ${year} or have a strong connection to events from that time.`;
		}

		prompt += ` Format as a valid JSON array with each object containing: "title" (string), "year" (number, negative for BCE), "subject" (one of: archaeology, art-culture, early-agriculture, architecture, science-technology, politics, warfare, religion, philosophy), "lat" (latitude, float), "lon" (longitude, float), and "info" (1-2 sentence description).`;

		// Call OpenAI API to generate events
		const completion = await openai.chat.completions.create({
			messages: [
				{
					role: 'system',
					content:
						'You are a history expert specializing in creating educational content.',
				},
				{
					role: 'user',
					content: prompt,
				},
			],
			model: 'gpt-4-turbo-preview',
			response_format: { type: 'json_object' },
		});

		const responseContent = completion.choices[0].message.content;
		if (!responseContent) {
			throw new Error('No content returned from OpenAI');
		}

		// Parse the JSON response
		const parsed = JSON.parse(responseContent);
		let newEvents = parsed.events || parsed; // Handle both formats

		if (!Array.isArray(newEvents)) {
			throw new Error('Invalid format returned from OpenAI');
		}

		// Ensure we have exactly the requested number of events
		newEvents = newEvents.slice(0, count);

		// Process the events
		const processedEvents: Event[] = newEvents.map((event: any) => {
			// Generate a deterministic ID based on the event content
			const eventContent = `${event.title}${event.year}${event.lat}${event.lon}`;
			const id = crypto
				.createHash('sha256')
				.update(eventContent)
				.digest('hex');

			return {
				id,
				title: event.title,
				year: event.year,
				lat: event.lat,
				lon: event.lon,
				subject: event.subject.toLowerCase().replace(/\s+/g, '-'),
				info: event.info,
			};
		});

		// Save events to database in background
		saveEventsToDatabase(processedEvents).catch(error => {
			console.error('Failed to save events to database:', error);
		});

		return NextResponse.json(processedEvents);
	} catch (error) {
		console.error('Failed to generate events:', error);
		return NextResponse.json(
			{ error: 'Failed to generate events' },
			{ status: 500 },
		);
	}
}

// Helper function to save events to database
async function saveEventsToDatabase(events: Event[]): Promise<void> {
	try {
		for (const event of events) {
			// Check if event already exists
			const { data: existingEvent } = await supabase
				.from('events')
				.select('id')
				.eq('id', event.id)
				.single();

			if (!existingEvent) {
				// Generate embedding for event
				try {
					const response = await fetch('/api/generate-embedding', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							text: `${event.title}. ${event.info}`,
						}),
					});

					if (!response.ok) {
						throw new Error(
							`API responded with status: ${response.status}`,
						);
					}

					const embedding = await response.json();
					event.embedding = embedding;
				} catch (error) {
					console.error('Failed to generate embedding:', error);
				}

				// Insert event into database
				const { error } = await supabase.from('events').insert(event);
				if (error) {
					console.error('Failed to insert event:', error);
				}
			}
		}
	} catch (error) {
		console.error('Error in saveEventsToDatabase:', error);
		throw error;
	}
}
