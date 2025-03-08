import { Event } from '@/types/event';

export async function fetchFromOpenAI(
	topic: string,
	title: string,
	year: number | null,
	numberOfEvents: number,
): Promise<Event[]> {
	console.log(`Fetching ${numberOfEvents} more events from API`);

	try {
		// Call our API endpoint instead of OpenAI directly
		const response = await fetch('/api/ai/historical-events', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				topic,
				title,
				year,
				numberOfEvents,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			console.error('API request failed:', response.status, errorData);
			return [];
		}

		const data = await response.json();
		return data.events || [];
	} catch (error) {
		console.error('Error fetching from API:', error);
		return [];
	}
}

/**
 * Generates quiz questions based on historical events
 * Uses a server-side API endpoint to handle the OpenAI interaction
 */
export async function generateQuizQuestionsWithAI(
	events: Array<{
		id: string;
		title: string;
		year?: number;
		subject?: string;
		info?: string;
		lat?: number;
		lon?: number;
		latitude?: number;
		longitude?: number;
	}>,
	topic: string,
	subject: string,
	difficulty: string = 'intermediate',
	questionsPerEvent: number = 1
) {
	if (!events || events.length === 0) {
		console.warn('No events provided for question generation');
		return [];
	}

	try {
		// Call our API endpoint instead of OpenAI directly
		const response = await fetch('/api/ai/quiz-questions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				events,
				topic,
				subject,
				difficulty,
				questionsPerEvent,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			console.error('API request failed:', response.status, errorData);
			return [];
		}

		const data = await response.json();
		return data.questions || [];
	} catch (error) {
		console.error('Error generating quiz questions:', error);
		return [];
	}
}