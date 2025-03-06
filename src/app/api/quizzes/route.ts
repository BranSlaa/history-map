import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { Quiz } from '@/types/quiz';
import { createClient } from '@supabase/supabase-js';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';


export async function GET(request: NextRequest) {
	const url = new URL(request.url);
	const featured = url.searchParams.get('featured') === 'true';
	const limit = parseInt(url.searchParams.get('limit') || '10');
	const userId = url.searchParams.get('user_id');
	
	try {
		// Create Supabase client
		const cookieStore = cookies();
		const supabase = createServerComponentClient({ cookies: () => cookieStore });
		
		// Start building the query
		let query = supabase
			.from('quizzes')
			.select(`
				id, title, description, difficulty, subject, topic, question_count, created_at, updated_at, user_id,
				quiz_questions:quiz_questions(
					id,
					question_text,
					explanation,
					difficulty,
					points,
					question_order
				),
				quiz_related_events:quiz_related_events(
					event_id,
					event_metadata
				)
			`)
			.order('created_at', { ascending: false });
		
		// If userId is provided, filter by user
		if (userId) {
			query = query.eq('user_id', userId);
		}
		
		// For featured quizzes, limit and filter by most taken or highest rated if available
		// This is a simple implementation - could be enhanced with more complex logic
		if (featured) {
			query = query.limit(5);
		} else {
			query = query.limit(limit);
		}
		
		const { data, error } = await query;
		
		if (error) {
			console.error('Error fetching quizzes:', error);
			return NextResponse.json(
				{ error: 'Failed to fetch quizzes' },
				{ status: 500 }
			);
		}
		
		// Add user profile data to each quiz if possible
		const userIds = data
			.map(quiz => quiz.user_id)
			.filter((id, index, self) => id && self.indexOf(id) === index);
			
		if (userIds.length > 0) {
			const { data: profilesData } = await supabase
				.from('profiles')
				.select('id, username, first_name, last_name')
				.in('id', userIds);
				
			// Create a map of profiles with proper type annotation
			const profilesMap: Record<string, any> = (profilesData || []).reduce((acc: Record<string, any>, profile: any) => {
				acc[profile.id] = profile;
				return acc;
			}, {});
			
			// Add profile data to quizzes
			data.forEach((quiz: any) => {
				if (quiz.user_id && profilesMap[quiz.user_id]) {
					quiz.creator = profilesMap[quiz.user_id];
				}
			});
		}
		
		// Format the quizzes for the client
		const formattedQuizzes = data.map((quiz: any) => ({
			id: quiz.id,
			title: quiz.title,
			description: quiz.description,
			subject: quiz.subject,
			topic: quiz.topic,
			difficulty: quiz.difficulty,
			question_count: quiz.question_count || quiz.quiz_questions?.length || 0,
			created_at: quiz.created_at,
			creator: quiz.creator ? {
				id: quiz.creator.id,
				username: quiz.creator.username,
				first_name: quiz.creator.first_name,
				last_name: quiz.creator.last_name
			} : undefined,
			questions: quiz.quiz_questions?.map((question: any) => ({
				id: question.id,
				text: question.question_text,
				explanation: question.explanation || '',
				options: [] // We don't fetch options in the list view for performance reasons
			})) || []
		}));
		
		return NextResponse.json(formattedQuizzes);
	} catch (error) {
		console.error('Unexpected error fetching quizzes:', error);
		return NextResponse.json(
			{ error: 'An unexpected error occurred' },
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		// Validate required fields
		if (!body.title || !body.description || !body.difficulty) {
			return NextResponse.json(
				{ error: 'Missing required fields' },
				{ status: 400 },
			);
		}

		// In a real app, you would save to a database
		const newQuiz: Quiz = {
			id: uuidv4(),
			title: body.title,
			description: body.description,
			difficulty: body.difficulty,
			created_at: new Date().toISOString(),
		};

		// For mock purposes, we could add to our array
		// mockQuizzes.push(newQuiz);

		return NextResponse.json(newQuiz, { status: 201 });
	} catch (error) {
		console.error('Error creating quiz:', error);
		return NextResponse.json(
			{ error: 'Failed to create quiz' },
			{ status: 500 },
		);
	}
}
