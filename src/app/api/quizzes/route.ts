import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { Quiz } from '@/types/quiz';

// Mock data for quizzes
const mockQuizzes: Quiz[] = [
	{
		id: uuidv4(),
		title: 'Ancient Civilizations',
		description:
			'Test your knowledge about the great ancient civilizations of the world including Egypt, Greece, Rome, and Mesopotamia.',
		difficulty: 'medium',
		created_at: new Date().toISOString(),
	},
	{
		id: uuidv4(),
		title: 'World War II',
		description:
			'A comprehensive quiz about the major events, figures, and impacts of World War II (1939-1945).',
		difficulty: 'hard',
		created_at: new Date().toISOString(),
	},
	{
		id: uuidv4(),
		title: 'The Renaissance',
		description:
			'Explore the artistic and cultural rebirth of Europe from the 14th to the 17th century.',
		difficulty: 'medium',
		created_at: new Date().toISOString(),
	},
	{
		id: uuidv4(),
		title: 'Canadian History Essentials',
		description:
			'Test your knowledge of key events and figures in Canadian history.',
		difficulty: 'easy',
		created_at: new Date().toISOString(),
	},
	{
		id: uuidv4(),
		title: 'Industrial Revolution',
		description:
			'Learn about the technological and societal changes that transformed manufacturing and society.',
		difficulty: 'medium',
		created_at: new Date().toISOString(),
	},
];

export async function GET(request: NextRequest) {
	// In a real app, you would fetch from a database
	// and implement authentication checks

	return NextResponse.json(mockQuizzes);
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
