import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { 
    AI_MODEL, 
    AI_MAX_QUIZ_TOKENS,
    AI_TEMPERATURE,
    AI_TOP_P,
    AI_FREQUENCY_PENALTY,
    AI_PRESENCE_PENALTY
} from '@/constants/ai';

// Initialize OpenAI client - server-side only
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // No NEXT_PUBLIC_ prefix for server-side env vars
});

export async function POST(request: NextRequest) {
    try {
        // Extract parameters from request
        const { events, topic, subject, difficulty, questionsPerEvent } = await request.json();
        
        // Validate inputs
        if (!events || !Array.isArray(events) || events.length === 0) {
            return NextResponse.json(
                { error: 'Valid events array is required' }, 
                { status: 400 }
            );
        }
        
        if (!process.env.OPENAI_API_KEY) {
            console.error('OpenAI API key is missing');
            return NextResponse.json(
                { error: 'Server configuration error' }, 
                { status: 500 }
            );
        }
        
        // Process valid events
        const validEvents = events.filter(event => event && event.id && event.title);
        if (validEvents.length === 0) {
            return NextResponse.json(
                { error: 'No valid events after filtering' }, 
                { status: 400 }
            );
        }
        
        const questions = [];
        const questionsPerEventLimit = questionsPerEvent || 1;
        const difficultyLevel = difficulty || 'intermediate';
        
        // Generate one question per event, limited by questionsPerEvent
        for (let i = 0; i < Math.min(validEvents.length, questionsPerEventLimit * validEvents.length); i++) {
            const eventIndex = i % validEvents.length;
            const event = validEvents[eventIndex];
            
            // Create prompt for this specific event
            const prompt = `
            Create one challenging but fair multiple-choice question about this historical event:
            
            Topic: ${topic || 'History'}
            Event: ${event.title}
            Year: ${event.year || 'Unknown'}
            Subject: ${subject || event.subject || 'History'}
            Details: ${event.info || ''}
            
            Make sure the question is at difficulty level: ${difficultyLevel.toLowerCase()}.
            
            Return a JSON object with this format:
            {
                "question_text": "The question",
                "explanation": "Explanation of the correct answer",
                "difficulty": "${difficultyLevel.toLowerCase()}",
                "options": [
                    {"option_text": "Option 1", "is_correct": true|false},
                    {"option_text": "Option 2", "is_correct": true|false},
                    {"option_text": "Option 3", "is_correct": true|false},
                    {"option_text": "Option 4", "is_correct": true|false}
                ]
            }
            `;
            
            // Call OpenAI API
            const response = await openai.chat.completions.create({
                model: AI_MODEL,
                messages: [
                    { 
                        role: 'system', 
                        content: `You create challenging but fair multiple-choice history questions at ${difficultyLevel.toLowerCase()} difficulty level.` 
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: AI_TEMPERATURE,
                max_tokens: AI_MAX_QUIZ_TOKENS,
                top_p: AI_TOP_P,
                frequency_penalty: AI_FREQUENCY_PENALTY,
                presence_penalty: AI_PRESENCE_PENALTY,
                response_format: { type: 'json_object' }
            });
            
            const content = response.choices[0]?.message?.content;
            
            if (!content) {
                console.error(`Empty response from OpenAI for event ${event.id}`);
                continue;
            }
            
            try {
                // Parse the response
                const questionData = JSON.parse(content);
                
                // Validate the question structure
                if (
                    questionData &&
                    typeof questionData === 'object' &&
                    'question_text' in questionData &&
                    'options' in questionData &&
                    Array.isArray(questionData.options) &&
                    questionData.options.length >= 2
                ) {
                    // Add event reference for context
                    const formattedQuestion = {
                        ...questionData,
                        event_id: event.id,
                        event_title: event.title
                    };
                    
                    questions.push(formattedQuestion);
                } else {
                    console.warn(`Invalid question format for event ${event.id}`, questionData);
                }
            } catch (parseError) {
                console.error(`Error parsing question for event ${event.id}:`, parseError);
            }
        }
        
        if (questions.length === 0) {
            return NextResponse.json(
                { error: 'Failed to generate any valid questions' }, 
                { status: 500 }
            );
        }
        
        return NextResponse.json({ questions });
    } catch (error) {
        console.error('API route error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
} 