import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PathEvent } from '@/types/path';

// Ensure environment variables are loaded
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if environment variables are set
if (!supabaseUrl || !supabaseServiceKey) {
	console.error('Required environment variables are missing:', {
		supabaseUrl: !!supabaseUrl,
		supabaseServiceKey: !!supabaseServiceKey,
	});
}

// Create Supabase client with service role key for bypassing RLS
let supabase: any;
try {
	supabase = createClient(supabaseUrl!, supabaseServiceKey!);
	console.log('Supabase client created successfully');
} catch (error) {
	console.error('Error creating Supabase client:', error);
}

export async function POST(request: NextRequest) {
	try {
		const { userId, eventId, pathId, title, eventOrder = 1 } = await request.json();

		if (!userId || !eventId || !pathId) {
			return NextResponse.json(
				{ error: 'Missing required fields (userId, eventId, or pathId)' },
				{ status: 400 },
			);
		}

		const pathEvent = {
			path_id: pathId,
			event_id: eventId,
			title: title || 'Unknown Event',
			event_order: eventOrder,
			explored_at: new Date().toISOString(),
		};

		console.log('Attempting to insert path event:', pathEvent);

		const { data, error } = await supabase
			.from('path_events')
			.upsert(pathEvent, { onConflict: 'path_id,event_id' })
			.select();

		if (error) {
			console.error('Error recording path event:', error);
			return NextResponse.json(
				{ error: 'Failed to record path event' },
				{ status: 500 },
			);
		}

		return NextResponse.json({ success: true, data });
	} catch (error) {
		console.error('Error in event interaction API POST:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}

export async function GET(request: NextRequest) {
	try {
		console.log('GET request received');

		const url = new URL(request.url);
		const userId = url.searchParams.get('userId');
		const pathId = url.searchParams.get('pathId');

		if (!userId) {
			return NextResponse.json(
				{ error: 'Missing required userId parameter' },
				{ status: 400 },
			);
		}

		console.log(`Fetching path events for userId: ${userId}`);

		try {
			// First get all paths for this user if pathId is not specified
			let path_ids: string[] = [];
			
			if (pathId) {
				path_ids = [pathId];
			} else {
				const { data: paths, error: pathsError } = await supabase
					.from('paths')
					.select('id')
					.eq('user_id', userId);
				
				if (pathsError) {
					console.error('Error fetching user paths:', pathsError);
					return NextResponse.json(
						{ error: 'Failed to fetch user paths' },
						{ status: 500 },
					);
				}
				
				path_ids = paths.map((path: { id: string }) => path.id);
			}
			
			if (path_ids.length === 0) {
				console.log('No paths found for this user');
				return NextResponse.json({ interactedEventIds: [] });
			}
			
			// Now get all events from these paths
			const { data, error } = await supabase
				.from('path_events')
				.select('event_id')
				.in('path_id', path_ids);

			console.log('Query completed');

			if (error) {
				console.error('Error fetching path events:', error);
				return NextResponse.json(
					{ error: 'Failed to fetch path events' },
					{ status: 500 },
				);
			}

			const interactedEventIds = data.map(
				(event: { event_id: string }) => event.event_id,
			);

			console.log(`Found ${interactedEventIds.length} interacted events`);

			return NextResponse.json({ interactedEventIds });
		} catch (queryError) {
			console.error('Error executing Supabase query:', queryError);
			return NextResponse.json(
				{ error: 'Error executing database query' },
				{ status: 500 },
			);
		}
	} catch (error) {
		console.error('Error in event interaction API GET:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}

export async function PUT(request: NextRequest) {
	try {
		const { pathId, eventId, quizGenerated = false } = await request.json();

		if (!pathId || !eventId) {
			return NextResponse.json(
				{ error: 'Missing required fields (pathId or eventId)' },
				{ status: 400 },
			);
		}

		console.log(
			`Updating path event for pathId: ${pathId}, eventId: ${eventId}, quizGenerated: ${quizGenerated}`,
		);

		const { data, error } = await supabase
			.from('path_events')
			.update({ quiz_generated: quizGenerated })
			.eq('path_id', pathId)
			.eq('event_id', eventId)
			.select();

		if (error) {
			console.error('Error updating path event:', error);
			return NextResponse.json(
				{ error: 'Failed to update path event' },
				{ status: 500 },
			);
		}

		return NextResponse.json({ success: true, data });
	} catch (error) {
		console.error('Error in path event API PUT:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}
