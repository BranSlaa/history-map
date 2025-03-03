import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { UserEventInteraction } from '@/types/event';

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
		const { userId, eventId, previousEventId, nextEventId } =
			await request.json();

		if (!userId || !eventId) {
			return NextResponse.json(
				{ error: 'Missing required fields' },
				{ status: 400 },
			);
		}

		const interaction: UserEventInteraction = {
			user_id: userId,
			event_id: eventId,
			previous_event_id: previousEventId || null,
			next_event_id: nextEventId || null,
			interaction_type: 'fetch_more',
		};

		console.log(
			'Attempting to upsert user event interaction:',
			interaction,
		);

		const { data, error } = await supabase
			.from('user_event_interactions')
			.upsert(interaction, { onConflict: 'user_id,event_id' })
			.select();

		if (error) {
			console.error('Error recording event interaction:', error);
			return NextResponse.json(
				{ error: 'Failed to record event interaction' },
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

		if (!userId) {
			return NextResponse.json(
				{ error: 'Missing required userId parameter' },
				{ status: 400 },
			);
		}

		console.log(`Fetching interactions for userId: ${userId}`);

		try {
			const { data, error } = await supabase
				.from('user_event_interactions')
				.select('event_id')
				.eq('user_id', userId);

			console.log('Query completed');

			if (error) {
				console.error('Error fetching user event interactions:', error);
				return NextResponse.json(
					{ error: 'Failed to fetch event interactions' },
					{ status: 500 },
				);
			}

			const interactedEventIds = data.map(
				(interaction: { event_id: string }) => interaction.event_id,
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
		const { userId, eventId, nextEventId } = await request.json();

		if (!userId || !eventId) {
			return NextResponse.json(
				{ error: 'Missing required fields' },
				{ status: 400 },
			);
		}

		console.log(
			`Updating event interaction for userId: ${userId}, eventId: ${eventId}, nextEventId: ${nextEventId}`,
		);

		const { error } = await supabase
			.from('user_event_interactions')
			.update({ next_event_id: nextEventId })
			.eq('user_id', userId)
			.eq('event_id', eventId);

		if (error) {
			console.error('Error updating event interaction:', error);
			return NextResponse.json(
				{ error: 'Failed to update event interaction' },
				{ status: 500 },
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error in event interaction API PUT:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}
