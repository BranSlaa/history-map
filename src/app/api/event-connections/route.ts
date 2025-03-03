import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { UserEventConnection } from '@/types/event';

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
	console.log(
		'Supabase client created successfully for event-connections API',
	);
} catch (error) {
	console.error('Error creating Supabase client:', error);
}

export async function POST(request: NextRequest) {
	try {
		const { userId, sourceEventId, targetEventId } = await request.json();

		if (!userId || !sourceEventId || !targetEventId) {
			return NextResponse.json(
				{ error: 'Missing required fields' },
				{ status: 400 },
			);
		}

		const connection: UserEventConnection = {
			user_id: userId,
			source_event_id: sourceEventId,
			target_event_id: targetEventId,
			connection_strength: 1, // Default strength
		};

		console.log('Attempting to create event connection:', connection);

		const { data, error } = await supabase
			.from('event_connections')
			.upsert(connection, {
				onConflict: 'user_id,source_event_id,target_event_id',
				returning: true,
			})
			.select();

		if (error) {
			console.error('Error recording event connection:', error);
			return NextResponse.json(
				{ error: 'Failed to record event connection' },
				{ status: 500 },
			);
		}

		return NextResponse.json({ success: true, data });
	} catch (error) {
		console.error('Error in event connection API POST:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}

export async function GET(request: NextRequest) {
	try {
		const url = new URL(request.url);
		const userId = url.searchParams.get('userId');
		const sourceEventId = url.searchParams.get('sourceEventId');

		if (!userId) {
			return NextResponse.json(
				{ error: 'Missing required userId parameter' },
				{ status: 400 },
			);
		}

		let query = supabase
			.from('event_connections')
			.select('*')
			.eq('user_id', userId);

		// If sourceEventId is provided, filter by that as well
		if (sourceEventId) {
			query = query.eq('source_event_id', sourceEventId);
		}

		const { data, error } = await query;

		if (error) {
			console.error('Error fetching event connections:', error);
			return NextResponse.json(
				{ error: 'Failed to fetch event connections' },
				{ status: 500 },
			);
		}

		return NextResponse.json({ connections: data });
	} catch (error) {
		console.error('Error in event connections API GET:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}

export async function PUT(request: NextRequest) {
	try {
		const { userId, sourceEventId, targetEventId, connectionStrength } =
			await request.json();

		if (!userId || !sourceEventId || !targetEventId) {
			return NextResponse.json(
				{ error: 'Missing required fields' },
				{ status: 400 },
			);
		}

		// Update the connection strength of an existing connection
		const { error } = await supabase
			.from('event_connections')
			.update({ connection_strength: connectionStrength || 1 })
			.eq('user_id', userId)
			.eq('source_event_id', sourceEventId)
			.eq('target_event_id', targetEventId);

		if (error) {
			console.error('Error updating event connection:', error);
			return NextResponse.json(
				{ error: 'Failed to update event connection' },
				{ status: 500 },
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error in event connection API PUT:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}
