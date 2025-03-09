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

// Helper function to normalize text for better comparison
function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s]/g, '') // Remove punctuation
		.replace(/\s+/g, ' ')    // Normalize whitespace
		.trim();
}

// Function to check if two strings are similar (simple implementation)
function areTextsSimilar(text1: string, text2: string, threshold = 0.7): boolean {
	const normalized1 = normalizeText(text1);
	const normalized2 = normalizeText(text2);
	
	// Calculate Jaccard similarity
	const words1 = new Set(normalized1.split(' '));
	const words2 = new Set(normalized2.split(' '));
	
	const intersection = new Set([...words1].filter(word => words2.has(word)));
	const union = new Set([...words1, ...words2]);
	
	const similarity = intersection.size / union.size;
	return similarity >= threshold;
}

// Function to check if coordinates are similar
function areCoordinatesSimilar(lat1: number, lon1: number, lat2: number, lon2: number, precision = 0.001): boolean {
	return Math.abs(lat1 - lat2) < precision && Math.abs(lon1 - lon2) < precision;
}

// Function to check if an event is a potential duplicate
async function checkDuplicate(event: EventWithEmbedding): Promise<{ isDuplicate: boolean, existingEventId?: string }> {
	// First check for exact title match
	const { data: exactMatches, error: exactMatchError } = await supabase
		.from('events')
		.select('id, title')
		.eq('title', event.title);
	
	if (exactMatchError) {
		console.error('Error checking for exact title match:', exactMatchError);
		return { isDuplicate: false };
	}
	
	if (exactMatches && exactMatches.length > 0) {
		return { isDuplicate: true, existingEventId: exactMatches[0].id };
	}
	
	// Check for similar events in the same area and year
	const { data: potentialDuplicates, error: queryError } = await supabase
		.from('events')
		.select('id, title, lat, lon, year')
		.eq('year', event.year)
		.gte('lat', event.lat - 0.01)
		.lte('lat', event.lat + 0.01)
		.gte('lon', event.lon - 0.01)
		.lte('lon', event.lon + 0.01);
	
	if (queryError) {
		console.error('Error checking for potential duplicates:', queryError);
		return { isDuplicate: false };
	}
	
	if (potentialDuplicates && potentialDuplicates.length > 0) {
		for (const potentialDupe of potentialDuplicates) {
			if (
				areCoordinatesSimilar(event.lat, event.lon, potentialDupe.lat, potentialDupe.lon) &&
				areTextsSimilar(event.title, potentialDupe.title)
			) {
				return { isDuplicate: true, existingEventId: potentialDupe.id };
			}
		}
	}
	
	return { isDuplicate: false };
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
				// Check if event is a duplicate using our enhanced logic
				console.log(
					`Checking if event '${event.title}' is a duplicate`,
				);
				
				const { isDuplicate, existingEventId } = await checkDuplicate({
					id: event.id,
					title: event.title,
					year: event.year,
					lat: event.lat,
					lon: event.lon,
					subject: event.subject,
					info: event.info || event.description,
					embedding: event.embedding
				});

				if (isDuplicate) {
					console.log(
						`Event '${event.title}' appears to be a duplicate of event ${existingEventId}, skipping`,
					);
					results.push({
						id: event.id,
						success: true,
						message: 'Similar event already exists in database',
						existingEventId
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
					info: event.info || event.description,
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
