import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

export const maxDuration = 60; // Set max execution time to 60 seconds

// OpenAI client initialization
const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

// Setup Supabase clients
export async function POST(request: NextRequest) {
    // Get the service role key
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!serviceRoleKey) {
        console.error('Missing service role key');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    try {
        // Read the request body
        const body = await request.json();
        const { userid } = body;

        if (!userid) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        
        // Create standard client (user's perspective)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                auth: {
                    persistSession: false,
                }
            }
        );

        // Create service role client (bypasses RLS)
        const metricsClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            {
                auth: {
                    persistSession: false,
                }
            }
        );
        
        // First, ensure user has an entry in user_activity_metrics
        const { data: existingMetrics, error: metricsError } = await metricsClient
            .from('user_activity_metrics')
            .select('*')
            .eq('user_id', userid)
            .single();
            
        if (metricsError && metricsError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
            console.error('Error checking user metrics:', metricsError);
            return NextResponse.json({ error: 'Failed to check user metrics' }, { status: 500 });
        }
        
        if (!existingMetrics) {
            // Create a new user_activity_metrics record
            const { error: insertError } = await metricsClient
                .from('user_activity_metrics')
                .insert({
                    user_id: userid,
                    search_count: 0,
                    connection_count: 0,
                    quiz_trigger_count: 0
                });
                
            if (insertError) {
                console.error('Error creating user metrics:', insertError);
                return NextResponse.json({ error: 'Failed to create user metrics' }, { status: 500 });
            }
        }
        
        // Get the user's most recently viewed events (up to 10)
        const { data: recentlyViewedEvents, error: viewedError } = await metricsClient
            .from('user_event_views')
            .select('events(id, title, subject, topics, info), viewed_at')
            .eq('user_id', userid)
            .order('viewed_at', { ascending: false })
            .limit(10);
            
        if (viewedError) {
            console.error('Error fetching recently viewed events:', viewedError);
            return NextResponse.json({ error: 'Failed to fetch viewed events' }, { status: 500 });
        }
        
        // Get the user's recently created connections
        const { data: recentlyCreatedConnections, error: connectionsError } = await metricsClient
            .from('connections')
            .select('source_id, target_id, relationship_type, created_at')
            .eq('created_by', userid)
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (connectionsError) {
            console.error('Error fetching created connections:', connectionsError);
            return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
        }
        
        // Get the user's metrics to determine quiz trigger count
        const { data: userMetrics, error: userMetricsError } = await metricsClient
            .from('user_activity_metrics')
            .select('quiz_trigger_count')
            .eq('user_id', userid)
            .single();
            
        if (userMetricsError) {
            console.error('Error fetching user metrics:', userMetricsError);
            return NextResponse.json({ error: 'Failed to fetch user metrics' }, { status: 500 });
        }
        
        const quizTriggerCount = (userMetrics?.quiz_trigger_count || 0) + 1;
        
        // Update the user's quiz trigger count
        const { error: updateError } = await metricsClient
            .from('user_activity_metrics')
            .update({
                quiz_trigger_count: quizTriggerCount,
                last_quiz_at: new Date().toISOString()
            })
            .eq('user_id', userid);
            
        if (updateError) {
            console.error('Error updating user quiz trigger count:', updateError);
            return NextResponse.json({ error: 'Failed to update quiz trigger count' }, { status: 500 });
        }
        
        // Limit number of questions based on quiz trigger count (more quizzes = more questions)
        const questionCount = Math.min(quizTriggerCount, 20);
        
        // Extract events from the query result
        const events = recentlyViewedEvents.map(item => {
            const eventData = Array.isArray(item.events) ? item.events[0] : item.events;
            return {
                id: eventData?.id,
                title: eventData?.title,
                subject: eventData?.subject,
                topics: eventData?.topics,
                info: eventData?.info,
                viewed_at: item.viewed_at
            };
        });
        
        if (events.length === 0) {
            // Not enough events to generate a quiz
            return NextResponse.json({ 
                error: 'Not enough historical context',
                message: 'View more historical events to generate a quiz'
            }, { status: 400 });
        }
        
        // Determine quiz subject & topic from recent activity
        const subjectFrequency: Record<string, number> = {};
        events.forEach(event => {
            subjectFrequency[event.subject] = (subjectFrequency[event.subject] || 0) + 1;
        });
        
        // Get the most common subject
        let quizSubject = 'History';
        let maxCount = 0;
        
        Object.entries(subjectFrequency).forEach(([subject, count]) => {
            if (count > maxCount) {
                maxCount = count;
                quizSubject = subject;
            }
        });
        
        // Generate quiz content using OpenAI
        const result = await generateQuizWithOpenAI(
            quizSubject,
            events, 
            recentlyCreatedConnections, 
            questionCount, 
            quizTriggerCount
        );
        
        if (!result) {
            return NextResponse.json({ error: 'Failed to generate quiz' }, { status: 500 });
        }
        
        // Save quiz to database
        const quizId = uuidv4();
        
        console.log('Saving quiz to database:', {
            id: quizId,
            title: result.title,
            subject: result.subject,
            questionCount: result.questions.length
        });
        
        try {
            // Insert quiz
            const { error: quizInsertError } = await metricsClient
                .from('quizzes')
                .insert({
                    id: quizId,
                    title: result.title,
                    description: result.description,
                    difficulty: result.difficulty,
                    subject: result.subject,
                    topic: result.topic,
                    question_count: result.questions.length
                });
                
            if (quizInsertError) {
                console.error('Error creating quiz record:', quizInsertError);
                throw new Error(`Failed to create quiz: ${quizInsertError.message}`);
            }
            
            console.log('Quiz created successfully, now creating questions...');
            
            // Save related events if available
            if (events.length > 0) {
                try {
                    const relatedEventInserts = events.slice(0, 5).map(event => ({
                        quiz_id: quizId,
                        event_id: event.id,
                        event_metadata: {
                            title: event.title,
                            subject: event.subject,
                            topics: event.topics || [],
                            info: event.info || '',
                            included_at: new Date().toISOString()
                        }
                    }));
                    
                    const { error: relatedError } = await metricsClient
                        .from('quiz_related_events')
                        .insert(relatedEventInserts);
                        
                    if (relatedError) {
                        console.error('Error inserting related events:', relatedError);
                        // Don't throw here, continue with quiz creation
                    } else {
                        console.log('Related events added to quiz:', relatedEventInserts.length);
                    }
                } catch (relatedError) {
                    console.error('Failed to add related events:', relatedError);
                    // Continue with quiz creation
                }
            }
            
            // Insert questions
            for (const question of result.questions) {
                const questionId = uuidv4();
                
                const { error: questionInsertError } = await metricsClient
                    .from('quiz_questions')
                    .insert({
                        id: questionId,
                        quiz_id: quizId,
                        text: question.text,
                        explanation: question.explanation || null,
                        difficulty: question.difficulty || 'beginner',
                        points: 1
                    });
                    
                if (questionInsertError) {
                    console.error('Error creating question:', questionInsertError);
                    continue; // Skip this question but continue with others
                }
                
                // Insert options for this question
                if (question.options && Array.isArray(question.options)) {
                    const optionInserts = question.options.map((option: {text: string, is_correct: boolean}) => ({
                        id: uuidv4(),
                        question_id: questionId,
                        text: option.text,
                        is_correct: option.is_correct
                    }));
                    
                    const { error: optionsError } = await metricsClient
                        .from('quiz_options')
                        .insert(optionInserts);
                        
                    if (optionsError) {
                        console.error('Error creating question options:', optionsError);
                        // Continue with other questions
                    }
                }
            }
            
            // Create a quiz attempt for the user
            const attemptId = uuidv4();
            const { error: attemptError } = await metricsClient
                .from('quiz_attempts')
                .insert({
                    id: attemptId,
                    user_id: userid,
                    quiz_id: quizId,
                    generated_after_searches: userMetrics?.quiz_trigger_count || 0
                });
                
            if (attemptError) {
                console.error('Error creating quiz attempt:', attemptError);
                // Continue and return the quiz data anyway
            }
            
            return NextResponse.json({ 
                message: 'Quiz generated successfully',
                quizId,
                attemptId,
                title: result.title,
                description: result.description,
                difficulty: result.difficulty, 
                subject: result.subject,
                topic: result.topic,
                questionCount: result.questions.length,
                userMetrics: {
                    quizTriggerCount
                }
            });
            
        } catch (error) {
            console.error('Error saving quiz to database:', error);
            return NextResponse.json({ error: 'Failed to save quiz' }, { status: 500 });
        }
    } catch (error) {
        console.error('Quiz generation error:', error);
        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
}

// Generate quiz questions using OpenAI API
async function generateQuizWithOpenAI(
    subject: string, 
    recentEvents: any[], 
    recentConnections: any[], 
    questionCount: number,
    quizNumber: number
) {
    // Calculate question distribution based on difficulty
    const beginnerCount = Math.min(questionCount, 5);
    const intermediateCount = Math.min(Math.max(0, questionCount - 5), 10);
    const advancedCount = Math.max(0, questionCount - 15);
    
    // Format recent events
    const eventsContext = recentEvents.map(event => `
- Event: ${event.title}
  Subject: ${event.subject}
  Topics: ${Array.isArray(event.topics) ? event.topics.join(', ') : ''}
  Info: ${event.info || 'No additional information'}
`).join('\n');

    // Format recent connections
    const connectionsContext = recentConnections.map(conn => `
- Connection: between events with IDs ${conn.source_id} and ${conn.target_id}
  Type: ${conn.relationship_type}
`).join('\n');
    
    // Prepare prompt for OpenAI
    const prompt = `
Generate a history quiz with ${questionCount || 3} questions based on the following historical events and connections:

RECENT EVENTS:
${eventsContext || 'No recent events'}

RECENT CONNECTIONS:
${connectionsContext || 'No recent connections'}

REQUIREMENTS:
- Create a quiz with ${questionCount || 3} multiple-choice questions
- Include a mix of difficulties: ${beginnerCount} beginner, ${intermediateCount} intermediate, and ${advancedCount} advanced questions
- Each question should have 4 options with exactly one correct answer
- Questions should test knowledge about the events, their significance, and relationships
- For each question, provide a brief explanation of the correct answer

OUTPUT FORMAT:
Return a JSON object with the following structure:
{
  "title": "Quiz title related to the subject",
  "description": "Brief description of the quiz",
  "subject": "${subject}",
  "topic": "More specific topic within the subject",
  "difficulty": "beginner|intermediate|advanced",
  "questions": [
    {
      "text": "Question text",
      "difficulty": "beginner|intermediate|advanced",
      "explanation": "Why this answer is correct",
      "options": [
        {"text": "Option text", "is_correct": true|false},
        {"text": "Option text", "is_correct": true|false},
        {"text": "Option text", "is_correct": true|false},
        {"text": "Option text", "is_correct": true|false}
      ]
    }
  ]
}
`;

    try {
        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a history teacher creating quizzes to test students on their knowledge of historical events. Create challenging but fair questions that test comprehension and connections between events.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
            response_format: { type: 'json_object' }
        });
        
        const responseContent = response.choices[0]?.message?.content;
        
        try {
            const quizData = JSON.parse(responseContent || '{}');
            
            // Validate the response
            if (!quizData.title || !quizData.questions || !Array.isArray(quizData.questions)) {
                console.error('Invalid quiz data from OpenAI:', quizData);
                throw new Error('Invalid quiz data structure from OpenAI');
            }
            
            return quizData;
        } catch (parseError) {
            console.error('Failed to parse OpenAI response:', parseError, 'Content:', responseContent);
            throw new Error('Failed to parse quiz data from OpenAI');
        }
        
    } catch (error) {
        console.error('OpenAI API error:', error);
        // Return a fallback quiz on error
        return createFallbackQuiz(subject, questionCount);
    }
}

// Create a fallback quiz if OpenAI fails
function createFallbackQuiz(subject: string, questionCount: number) {
    const questions = [];
    for (let i = 0; i < Math.min(questionCount || 3, 5); i++) {
        questions.push({
            text: `Sample history question ${i+1}`,
            difficulty: "beginner",
            explanation: "This is a fallback question because quiz generation failed.",
            options: [
                { text: "Correct answer", is_correct: true },
                { text: "Wrong answer 1", is_correct: false },
                { text: "Wrong answer 2", is_correct: false },
                { text: "Wrong answer 3", is_correct: false }
            ]
        });
    }
    
    return {
        title: `${subject || 'History'} Quiz`,
        description: "A quiz about historical events and connections.",
        subject: subject || "History",
        topic: "General History",
        difficulty: "beginner",
        questions
    };
}