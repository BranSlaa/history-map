import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { Quiz } from '@/types/quiz';
import { createClient } from '@supabase/supabase-js';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Create a Supabase client
const supabaseAdmin = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL || '',
	process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(request: NextRequest) {
	try {
		// Get query parameters
		const searchParams = request.nextUrl.searchParams;
		const userId = searchParams.get('userId');
		const difficultyLevel = searchParams.get('difficulty');
		const limit = searchParams.get('limit') || '20';

		// Create authenticated Supabase client with proper cookie handling
		const cookieStore = cookies();
		const supabase = createServerComponentClient({ 
			cookies: () => cookieStore 
		});

		// If userId is provided, fetch quizzes for that specific user only
		if (userId) {
			const { data: { user } } = await supabase.auth.getUser();
			
			// Only allow fetching your own quizzes unless an admin
			if (!user || (user.id !== userId)) {
				return NextResponse.json(
					{ error: 'Unauthorized access' },
					{ status: 403 }
				);
			}
			
			// Fetch quizzes for the specific user
			let query = supabase.from('quizzes').select('*').eq('user_id', userId);
			
			// Apply difficulty filter if provided
			if (difficultyLevel) {
				query = query.eq('difficulty', difficultyLevel);
			}
			
			const { data, error } = await query.order('created_at', { ascending: false });
			
			if (error) {
				console.error('Error fetching quizzes:', error);
				return NextResponse.json(
					{ error: 'Failed to fetch quizzes' },
					{ status: 500 }
				);
			}
			
			return NextResponse.json(data);
		} else {
			// For all quizzes, just fetch the quizzes without trying to join with creator
			// since the relationship between quizzes and user_id is not properly set up
			let query = supabase.from('quizzes').select('*');
				
			// Apply difficulty filter if provided
			if (difficultyLevel) {
				query = query.eq('difficulty', difficultyLevel);
			}
			
			const { data, error } = await query
				.order('created_at', { ascending: false })
				.limit(parseInt(limit));
				
			if (error) {
				console.error('Error fetching quizzes:', error);
				return NextResponse.json(
					{ error: 'Failed to fetch quizzes' },
					{ status: 500 }
				);
			}
			
			// For each quiz, if we have user_id, fetch the creator's profile separately
			// This is a workaround since the direct join doesn't work
			if (data && data.length > 0) {
				const quizzesWithCreators = await Promise.all(
					data.map(async (quiz) => {
						if (quiz.user_id) {
							const { data: profileData } = await supabase
								.from('profiles')
								.select('id, username, first_name, last_name')
								.eq('id', quiz.user_id)
								.single();
								
							return {
								...quiz,
								creator: profileData
							};
						}
						return quiz;
					})
				);
				
				return NextResponse.json(quizzesWithCreators);
			}
			
			return NextResponse.json(data);
		}
	} catch (error) {
		console.error('Unexpected error in GET /api/quizzes:', error);
		return NextResponse.json(
			{ error: 'An unexpected error occurred' },
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const cookieStore = cookies();
		const supabase = createServerComponentClient({ 
			cookies: () => cookieStore 
		});
		
		// Get the authenticated user
		const { data: { user } } = await supabase.auth.getUser();
		
		if (!user) {
			return NextResponse.json(
				{ error: 'Unauthorized: You must be logged in to create a quiz' },
				{ status: 401 }
			);
		}

		// Validate required fields
		if (!body.title || !body.description || !body.difficulty || !body.subject || !body.topic) {
			return NextResponse.json(
				{ error: 'Missing required fields: title, description, difficulty, subject, and topic are required' },
				{ status: 400 },
			);
		}

		// Create the new quiz with all required fields
		const newQuiz: Quiz = {
			id: uuidv4(),
			title: body.title,
			description: body.description,
			difficulty: body.difficulty,
			subject: body.subject,
			topic: body.topic,
			question_count: body.question_count || 0,
			user_id: user.id,
			related_event_ids: body.related_event_ids || [],
			created_at: new Date().toISOString(),
		};

		// Insert the quiz into the database
		const { data, error } = await supabase
			.from('quizzes')
			.insert(newQuiz)
			.select();
			
		if (error) {
			console.error('Error creating quiz in database:', error);
			return NextResponse.json(
				{ error: 'Failed to save quiz to database' },
				{ status: 500 },
			);
		}

		return NextResponse.json(data[0], { status: 201 });
	} catch (error) {
		console.error('Error creating quiz:', error);
		return NextResponse.json(
			{ error: 'Failed to create quiz' },
			{ status: 500 },
		);
	}
}
