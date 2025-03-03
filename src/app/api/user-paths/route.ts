import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { UserPath, PathData } from '@/types/event';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error('Supabase credentials not found');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// GET handler to retrieve user paths
export async function GET(req: NextRequest) {
	try {
		const userId = req.nextUrl.searchParams.get('userId');

		if (!userId) {
			return NextResponse.json(
				{ error: 'User ID is required' },
				{ status: 400 },
			);
		}

		// Retrieve path data for the user
		const { data, error } = await supabase
			.from('user_paths')
			.select('*')
			.eq('user_id', userId)
			.order('updated_at', { ascending: false })
			.limit(1)
			.single();

		if (error) {
			// If no path exists yet, return an empty path
			if (error.code === 'PGRST116') {
				return NextResponse.json({
					pathData: { chosenEvents: [], unchosenEvents: [] },
				});
			}

			console.error('Error fetching user path:', error);
			return NextResponse.json(
				{ error: 'Failed to fetch user path' },
				{ status: 500 },
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error('Error in GET handler:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}

// POST handler to create or update user path
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { userId, pathData, currentEventId } = body;

		if (!userId || !pathData) {
			return NextResponse.json(
				{ error: 'User ID and path data are required' },
				{ status: 400 },
			);
		}

		// Check if a path already exists for this user
		const { data: existingPath, error: fetchError } = await supabase
			.from('user_paths')
			.select('id')
			.eq('user_id', userId)
			.order('updated_at', { ascending: false })
			.limit(1)
			.single();

		if (fetchError && fetchError.code !== 'PGRST116') {
			console.error('Error checking for existing path:', fetchError);
			return NextResponse.json(
				{ error: 'Failed to check for existing path' },
				{ status: 500 },
			);
		}

		let result;

		if (existingPath) {
			// Update existing path
			result = await supabase
				.from('user_paths')
				.update({
					path_data: pathData,
					current_event_id: currentEventId || null,
					updated_at: new Date().toISOString(),
				})
				.eq('id', existingPath.id)
				.select()
				.single();
		} else {
			// Create new path
			result = await supabase
				.from('user_paths')
				.insert({
					user_id: userId,
					path_data: pathData,
					current_event_id: currentEventId || null,
				})
				.select()
				.single();
		}

		if (result.error) {
			console.error('Error updating user path:', result.error);
			return NextResponse.json(
				{ error: 'Failed to update user path' },
				{ status: 500 },
			);
		}

		return NextResponse.json(result.data);
	} catch (error) {
		console.error('Error in POST handler:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}
