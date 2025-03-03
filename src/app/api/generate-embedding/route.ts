import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Configure OpenAI
const openai = new OpenAI({
	apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

// Set CORS headers
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
	try {
		// Check if API key exists
		if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
			console.error('OpenAI API key is missing');
			return NextResponse.json(
				{ error: 'OpenAI API key is not configured' },
				{ status: 500, headers: corsHeaders },
			);
		}

		// Parse the request body
		const { text } = await request.json();

		if (!text) {
			return NextResponse.json(
				{ error: 'Text is required' },
				{ status: 400, headers: corsHeaders },
			);
		}

		console.log(
			`Generating embedding for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
		);

		// Generate embedding using OpenAI
		try {
			const embeddingResponse = await openai.embeddings.create({
				model: 'text-embedding-ada-002',
				input: text.trim(),
			});

			// Extract the embedding
			const embedding = embeddingResponse.data[0].embedding;

			// Return the embedding
			return NextResponse.json(embedding, { headers: corsHeaders });
		} catch (openaiError) {
			console.error('OpenAI API error:', openaiError);
			return NextResponse.json(
				{
					error: 'Error from OpenAI API',
					details:
						openaiError instanceof Error
							? openaiError.message
							: String(openaiError),
				},
				{ status: 500, headers: corsHeaders },
			);
		}
	} catch (error) {
		console.error('Error in API route:', error);

		return NextResponse.json(
			{
				error: 'Server error',
				details:
					error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
			},
			{ status: 500, headers: corsHeaders },
		);
	}
}
