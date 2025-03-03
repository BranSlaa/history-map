import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Event } from '@/types/event';

// Ensure environment variables are loaded
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Debug environment variables
console.log('Environment variables:');
console.log('NEXT_PUBLIC_SUPABASE_URL length:', supabaseUrl?.length || 0);
console.log(
	'SUPABASE_SERVICE_ROLE_KEY length:',
	supabaseServiceKey?.length || 0,
);

// Check if environment variables are set
if (!supabaseUrl || !supabaseServiceKey) {
	console.error('Required environment variables are missing:', {
		supabaseUrl: !!supabaseUrl,
		supabaseServiceKey: !!supabaseServiceKey,
	});
	throw new Error('Required environment variables are missing');
}

// Create Supabase client with service role key for bypassing RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Type definition for event with embedding
interface EventWithEmbedding {
	id: string;
	title: string;
	year: number;
	lat: number;
	lon: number;
	subject: string;
	info: string;
	embedding?: number[];
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		console.log(
			'Received request to save events. Event count:',
			body.events?.length || 0,
		);

		const { events } = body;

		if (!events || !Array.isArray(events) || events.length === 0) {
			return NextResponse.json(
				{ error: 'No events provided' },
				{ status: 400 },
			);
		}

		const results = [];

		for (const event of events) {
			try {
				// Check if event already exists
				console.log(
					`Checking if event '${event.title}' already exists`,
				);
				const { data: existingEvents, error: existingError } =
					await supabase
						.from('events')
						.select('id')
						.eq('title', event.title)
						.eq('year', event.year);

				if (existingError) {
					console.error(
						'Error checking existing event:',
						existingError,
					);
					results.push({
						id: event.id,
						success: false,
						message: `Error checking if event exists: ${existingError.message}`,
					});
					continue;
				}

				if (existingEvents && existingEvents.length > 0) {
					console.log(
						`Event '${event.title}' already exists, skipping`,
					);
					results.push({
						id: event.id,
						success: true,
						message: 'Event already exists in database',
					});
					continue;
				}

				// Prepare event data with embedding
				const eventData: EventWithEmbedding = {
					id: event.id,
					title: event.title,
					year: event.year,
					lat: event.lat,
					lon: event.lon,
					subject: event.subject,
					info: event.info,
				};

				// Add embedding if available
				if (event.embedding) {
					eventData.embedding = event.embedding;
				}

				// Insert event
				console.log(`Inserting event '${event.title}'`);
				const { error: insertError } = await supabase
					.from('events')
					.insert([eventData]);

				if (insertError) {
					console.error('Error inserting event:', insertError);
					results.push({
						id: event.id,
						success: false,
						message: `Error inserting event: ${insertError.message}`,
					});
					continue;
				}

				console.log(`Successfully saved event '${event.title}'`);
				results.push({
					id: event.id,
					success: true,
					message: 'Event saved successfully',
				});
			} catch (eventError) {
				console.error(
					`Error processing event '${event.title}':`,
					eventError,
				);
				results.push({
					id: event.id,
					success: false,
					message: `Error processing event: ${(eventError as Error).message}`,
				});
			}
		}

		return NextResponse.json({ results });
	} catch (error) {
		console.error('Error in save-events API route:', error);
		return NextResponse.json(
			{ error: `Error saving events: ${(error as Error).message}` },
			{ status: 500 },
		);
	}
}
