import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { PathData, UserPath } from '@/types/path';
import { 
    QUIZ_DIFFICULTIES, 
    DEFAULT_QUIZ_TOPIC, 
    DEFAULT_QUIZ_VALUES,
    QUIZ_QUESTION_DISTRIBUTIONS 
} from '@/constants/quiz';

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
        // Get the user ID from the request body as a fallback
        // This is needed because server component auth can be tricky
        const body = await request.json();
        let userid = body.userid;
        
        // Try to get auth from the session if no user ID was provided
        if (!userid) {
            // Create supabase server client for authentication
            const cookieStore = cookies();
            const supabase = createServerComponentClient({ cookies: () => cookieStore });
            
            try {
                // Get the current user from the session
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session?.user) {
                    userid = session.user.id;
                    console.log('Using authenticated user:', userid);
                }
            } catch (authError) {
                console.error('Error retrieving auth session:', authError);
            }
        }
        
        // Check if we have a user ID from either source
        if (!userid) {
            console.error('No user ID found in session or request');
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        
        // Log which user ID we're using
        console.log('Generating quiz for user:', userid);
        
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
        
        // Define the processEventsForQuiz function early, before it's used
        async function processEventsForQuiz(eventsList: any[]) {
            if (eventsList.length === 0) {
                return NextResponse.json({ 
                    error: 'Not enough historical context',
                    message: 'Explore more historical events to generate a quiz'
                }, { status: 400 });
            }
            
            // Process each event to ensure it has the expected fields
            const processedEvents = eventsList.map(event => {
                return {
                    ...event,
                    // Provide default values for any missing fields
                    title: event.title || 'Untitled Event',
                    subject: event.subject || 'History',
                    info: event.info || 'No additional information available.',
                    // Add an empty topics array if it doesn't exist
                    topics: event.topics || []
                };
            });
            
            // Try to get user's recently created connections
            let recentlyCreatedConnections = null;
            try {
                const { data: connections, error: connectionsError } = await metricsClient
                    .from('connections')
                    .select('*')
                    .eq('user_id', userid)
                    .order('created_at', { ascending: false })
                    .limit(5);
                    
                if (connectionsError) {
                    console.error('Error fetching created connections:', connectionsError);
                    // If the table doesn't exist (code 42P01), just continue with null connections
                    if (connectionsError.code === '42P01') {
                        console.log('Connections table does not exist, continuing without connections data');
                        recentlyCreatedConnections = [];
                    }
                    // Continue with quiz generation
                } else {
                    recentlyCreatedConnections = connections;
                }
            } catch (error) {
                console.error('Unexpected error fetching connections:', error);
                // Continue with quiz generation, connections are optional
                recentlyCreatedConnections = [];
            }
            
            // Get the user's metrics to determine quiz trigger count
            const { data: userMetrics, error: userMetricsError } = await metricsClient
                .from('user_activity_metrics')
                .select('quiz_trigger_count')
                .eq('user_id', userid)
                .single();
                
            if (userMetricsError) {
                console.error('Error fetching user metrics:', userMetricsError);
                // Continue with default values
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
                // Continue with quiz generation
            }
            
            // Calculate how many questions to include based on quiz trigger count
            // More quizzes = more questions, up to a maximum
            const questionCount = Math.min(quizTriggerCount, DEFAULT_QUIZ_VALUES.MAX_QUESTIONS);
            
            // Determine quiz subject & topic from events
            const subjectFrequency: Record<string, number> = {};
            processedEvents.forEach((event: any) => {
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
                processedEvents, 
                recentlyCreatedConnections || [], 
                questionCount, 
                quizTriggerCount
            );
            
            // Validate the quiz data thoroughly before saving to the database
            if (!result) {
                console.error('Failed to generate quiz: OpenAI returned null or undefined result');
                return NextResponse.json({ error: 'Failed to generate quiz content' }, { status: 500 });
            }
            
            if (!result.questions || !Array.isArray(result.questions) || result.questions.length === 0) {
                console.error('Failed to generate quiz: No questions were generated', result);
                return NextResponse.json({ error: 'Quiz generation produced no questions' }, { status: 500 });
            }
            
            // Ensure required fields are present
            result.title = result.title || `${quizSubject} Quiz #${quizTriggerCount}`;
            result.description = result.description || `A quiz about ${quizSubject} generated based on your historical explorations.`;
            result.subject = result.subject || quizSubject;
            result.topic = result.topic || DEFAULT_QUIZ_TOPIC;
            
            // Validate questions have all required fields
            const validQuestions = result.questions.filter((question: any) => {
                const hasText = !!question.text;
                const hasOptions = question.options && Array.isArray(question.options) && question.options.length >= 2;
                const hasCorrectOption = question.options && question.options.some((opt: any) => opt.is_correct || opt.correct);
                
                return hasText && hasOptions && hasCorrectOption;
            });
            
            if (validQuestions.length === 0) {
                console.error('Failed to generate quiz: No valid questions found after validation', result.questions);
                return NextResponse.json({ error: 'Quiz generation produced no valid questions' }, { status: 500 });
            }
            
            // Continue with the rest of the quiz generation logic...
            if (validQuestions.length < result.questions.length) {
                console.warn(`Some questions were invalid: ${result.questions.length - validQuestions.length} removed`);
                result.questions = validQuestions;
            }
            
            // Save quiz to database
            const quizId = uuidv4();
            const timestamp = new Date().toISOString();
            
            // Prepare standardized quiz data for insertion
            const quizData = {
                id: quizId,
                title: result.title,
                description: result.description,
                subject: result.subject || quizSubject,
                topic: result.topic,
                difficulty: QUIZ_DIFFICULTIES.INTERMEDIATE,
                question_count: result.questions.length,
                user_id: userid,
                created_at: timestamp,
                updated_at: timestamp
            };
            
            // Add detailed logging of the quiz payload
            console.log('Attempting to insert quiz with payload:', quizData);
            
            // Insert quiz
            const { error: quizInsertError } = await metricsClient
                .from('quizzes')
                .insert(quizData);
            
            if (quizInsertError) {
                console.error('Error creating quiz record:', quizInsertError);
                return NextResponse.json({ error: 'Failed to save quiz' }, { status: 500 });
            }
            
            console.log('Quiz created successfully, now creating questions...');
            
            // Save related events if available
            if (processedEvents.length > 0) {
                try {
                    const relatedEventInserts = processedEvents.slice(0, 5).map(event => ({
                        quiz_id: quizId,
                        event_id: event.id,
                        event_metadata: {
                            title: event.title || 'Untitled Event',
                            subject: event.subject || 'History',
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
                        // If the table doesn't exist, log and continue
                        if (relatedError.code === '42P01') {
                            console.log('quiz_related_events table does not exist, continuing without related events');
                        }
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
            const questionInserts = result.questions.map((question: any, index: number) => ({
                id: uuidv4(),
                quiz_id: quizId,
                text: question.text,
                question_order: index,
                explanation: question.explanation || '',
                difficulty: QUIZ_DIFFICULTIES.INTERMEDIATE,
                points: DEFAULT_QUIZ_VALUES.DEFAULT_POINT_VALUE
            }));
            
            console.log(`Inserting ${questionInserts.length} questions for quiz ${quizId}`);
            
            const { error: questionInsertError } = await metricsClient
                .from('quiz_questions')
                .insert(questionInserts);
                
            if (questionInsertError) {
                console.error('Error inserting quiz questions:', questionInsertError);
                return NextResponse.json({ error: 'Failed to save quiz questions' }, { status: 500 });
            }
            
            console.log('Questions created successfully, now creating options...');
            
            // Insert options for each question
            const allOptions = result.questions.flatMap((question: any, qIndex: number) => {
                return question.options.map((option: any, oIndex: number) => {
                    // Ensure is_correct is a boolean
                    const isCorrect = Boolean(option.is_correct || option.correct || false);
                    
                    return {
                        id: uuidv4(),
                        question_id: questionInserts[qIndex].id,
                        option_text: option.text,
                        is_correct: isCorrect,
                        option_order: oIndex
                    };
                });
            });
            
            // Check if we have options before trying to insert them
            if (allOptions.length === 0) {
                console.error('No question options to insert');
                return NextResponse.json({ error: 'Failed to create quiz options' }, { status: 500 });
            }
            
            console.log(`Inserting ${allOptions.length} options for ${result.questions.length} questions`);
            
            const { error: optionInsertError } = await metricsClient
                .from('quiz_options')
                .insert(allOptions);
                
            if (optionInsertError) {
                console.error('Error inserting quiz options:', optionInsertError);
                return NextResponse.json({ error: 'Failed to save quiz options' }, { status: 500 });
            }
            
            console.log('Quiz creation completed successfully!');
            
            // Return success response with quiz data
            return NextResponse.json({
                success: true,
                quizId: quizId,
                quiz: {
                    id: quizId,
                    title: result.title,
                    description: result.description,
                    subject: result.subject || quizSubject,
                    topic: result.topic,
                    questionCount: result.questions.length,
                    difficulty: QUIZ_DIFFICULTIES.INTERMEDIATE,
                    // Include the complete quiz data for rendering on the client
                    questions: result.questions.map((question: any, qIndex: number) => ({
                        id: questionInserts[qIndex].id,
                        text: question.text,
                        explanation: question.explanation || '',
                        options: question.options.map((option: any, oIndex: number) => ({
                            id: allOptions.find(
                                (o: any) => o.question_id === questionInserts[qIndex].id && o.option_order === oIndex
                            )?.id,
                            text: option.text,
                            isCorrect: option.is_correct || option.correct
                        }))
                    }))
                }
            });
        }
        
        // Try to get the user's path data from the database
        const { data: userPathData, error: pathError } = await metricsClient
            .from('user_paths')
            .select('path_data, created_at, updated_at')
            .eq('user_id', userid)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();
            
        if (pathError) {
            console.error('Error fetching user path data:', pathError);
            
            if (pathError.code === '42P01' || pathError.code === 'PGRST116') {
                // Table doesn't exist or no results found, continue with sample events
                console.log('User path data table not found or no results, using sample events');
                const sampleEvents = [
                    {
                        id: uuidv4(),
                        title: "World War II",
                        subject: "Military History",
                        topics: ["War", "20th Century", "Europe"],
                        info: "Global conflict that lasted from 1939 to 1945, involving many nations including all great powers."
                    },
                    {
                        id: uuidv4(),
                        title: "Apollo 11 Moon Landing",
                        subject: "Space Exploration",
                        topics: ["NASA", "20th Century", "Astronomy"],
                        info: "First crewed mission to land on the Moon, on July 20, 1969."
                    },
                    {
                        id: uuidv4(),
                        title: "Industrial Revolution",
                        subject: "Economic History",
                        topics: ["Technology", "Economics", "Social Change"],
                        info: "Period of transition to new manufacturing processes from about 1760 to 1830."
                    }
                ];
                
                // Process the sample events to generate a quiz
                return processEventsForQuiz(sampleEvents);
            }
            
            return NextResponse.json({ error: 'Failed to fetch user path data' }, { status: 500 });
        }
        
        // Extract chosen events from the path
        const pathData = userPathData?.path_data as PathData;
        console.log('Path data retrieved:', JSON.stringify({
            rawPathData: userPathData?.path_data,
            pathDataType: typeof userPathData?.path_data,
            hasChosenEvents: pathData && 'chosenEvents' in pathData,
            chosenEventsType: pathData?.chosenEvents ? typeof pathData.chosenEvents : 'undefined',
            isChosenEventsArray: pathData?.chosenEvents ? Array.isArray(pathData.chosenEvents) : false,
            chosenEventsLength: pathData?.chosenEvents && Array.isArray(pathData.chosenEvents) ? pathData.chosenEvents.length : 0
        }, null, 2));
        
        const chosenEvents = pathData?.chosenEvents || [];
        
        if (chosenEvents.length === 0) {
            console.log('No chosen events found in path data, trying user_event_interactions as fallback');
            // Try to get events from user_event_interactions as fallback
            const { data: interactionEvents, error: interactionError } = await metricsClient
                .from('user_event_interactions')
                .select('event_id')
                .eq('user_id', userid)
                .order('created_at', { ascending: false })
                .limit(10);
                
            if (interactionError) {
                console.error('Error fetching user interaction events:', interactionError);
                // Continue with empty events list - we'll handle this below
            } else if (interactionEvents && interactionEvents.length > 0) {
                // Use event IDs from interactions
                console.log(`Found ${interactionEvents.length} interaction events to use as fallback`);
                const eventIds = interactionEvents.map(item => item.event_id);
                const { data: fallbackEvents, error: fallbackError } = await metricsClient
                    .from('events')
                    .select('id, title, subject, info')
                    .in('id', eventIds)
                    .limit(10);
                    
                if (!fallbackError && fallbackEvents && fallbackEvents.length > 0) {
                    console.log(`Successfully found ${fallbackEvents.length} event details for interactions`);
                    // Use these events instead
                    return processEventsForQuiz(fallbackEvents);
                } else if (fallbackError) {
                    console.error('Error fetching fallback event details:', fallbackError);
                }
            } else {
                console.log('No interaction events found either');
            }
            
            // If we get here, there's not enough events to generate a quiz
            console.log('No events found from any source, using sample data as last resort');
            
            // Use sample events as last resort when no other data is available
            const sampleEvents = [
                {
                    id: uuidv4(),
                    title: "World War II",
                    subject: "Military History",
                    topics: ["War", "20th Century", "Europe"],
                    info: "Global conflict that lasted from 1939 to 1945, involving many nations including all great powers."
                },
                {
                    id: uuidv4(),
                    title: "Apollo 11 Moon Landing",
                    subject: "Space Exploration",
                    topics: ["NASA", "20th Century", "Astronomy"],
                    info: "First crewed mission to land on the Moon, on July 20, 1969."
                },
                {
                    id: uuidv4(),
                    title: "Industrial Revolution",
                    subject: "Economic History",
                    topics: ["Technology", "Economics", "Social Change"],
                    info: "Period of transition to new manufacturing processes from about 1760 to 1830."
                }
            ];
            
            // Process the sample events to generate a quiz
            console.log('Using sample events as final fallback');
            return processEventsForQuiz(sampleEvents);
        }
        
        // Get details for the chosen events
        const eventIds = chosenEvents.map(event => event.id);
        console.log(`Fetching details for ${eventIds.length} chosen events: ${eventIds.join(', ')}`);
        
        try {
            // Get event details from the events table
            const { data: eventsData, error: eventsError } = await metricsClient
                .from('events')
                .select('id, title, subject, info')
                .in('id', eventIds)
                .limit(10);
                
            if (eventsError) {
                console.error('Error fetching event details:', eventsError, {
                    requestedIds: eventIds,
                    chosenEventsSource: 'path_data.chosenEvents'
                });
                return NextResponse.json({ error: 'Failed to fetch event details' }, { status: 500 });
            }
            
            if (!eventsData || eventsData.length === 0) {
                console.error('No event details found for the requested IDs:', {
                    requestedIds: eventIds,
                    chosenEventsSource: 'path_data.chosenEvents'
                });
                
                // Use sample events as fallback when no event details found
                const sampleEvents = [
                    {
                        id: uuidv4(),
                        title: "World War II",
                        subject: "Military History",
                        topics: ["War", "20th Century", "Europe"],
                        info: "Global conflict that lasted from 1939 to 1945, involving many nations including all great powers."
                    },
                    {
                        id: uuidv4(),
                        title: "Apollo 11 Moon Landing",
                        subject: "Space Exploration",
                        topics: ["NASA", "20th Century", "Astronomy"],
                        info: "First crewed mission to land on the Moon, on July 20, 1969."
                    },
                    {
                        id: uuidv4(),
                        title: "Industrial Revolution",
                        subject: "Economic History",
                        topics: ["Technology", "Economics", "Social Change"],
                        info: "Period of transition to new manufacturing processes from about 1760 to 1830."
                    }
                ];
                
                console.log('Using sample events instead of empty event details');
                return processEventsForQuiz(sampleEvents);
            }
            
            console.log(`Successfully found ${eventsData.length} event details`);
            
            // Generate quiz using the found events
            return processEventsForQuiz(eventsData);
            
        } catch (error) {
            console.error('Unexpected error fetching events:', error);
            return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
        }
    } catch (error) {
        console.error('Quiz generation failed:', error);
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
    // Calculate question distribution based on difficulty and ratios
    const beginnerCount = Math.round(questionCount * QUIZ_QUESTION_DISTRIBUTIONS.BEGINNER_RATIO);
    const intermediateCount = Math.round(questionCount * QUIZ_QUESTION_DISTRIBUTIONS.INTERMEDIATE_RATIO);
    const advancedCount = Math.round(questionCount * QUIZ_QUESTION_DISTRIBUTIONS.ADVANCED_RATIO);
    
    // Ensure we have at least one of each type if possible
    const adjustedBeginnerCount = Math.max(1, beginnerCount);
    const adjustedIntermediateCount = questionCount > 1 ? Math.max(1, intermediateCount) : 0;
    const adjustedAdvancedCount = questionCount > 2 ? Math.max(1, advancedCount) : 0;
    
    // Adjust counts to match total questionCount
    const totalCount = adjustedBeginnerCount + adjustedIntermediateCount + adjustedAdvancedCount;
    const finalBeginnerCount = adjustedBeginnerCount + (questionCount - totalCount);
    
    // Format recent events
    const eventsContext = recentEvents.map(event => `
- Event: ${event.title}
  Subject: ${event.subject}
  Topics: ${Array.isArray(event.topics) ? event.topics.join(', ') : ''}
  Info: ${event.info || 'No additional information'}
`).join('\n');

    // Format recent connections
    const connectionsContext = (recentConnections || []).map(conn => `
- Connection: between events with IDs ${conn.source_event_id || conn.source_id || 'unknown'} and ${conn.target_event_id || conn.target_id || 'unknown'}
  Type: ${conn.relationship_type || conn.type || 'unspecified'}
`).join('\n');
    
    // Prepare prompt for OpenAI
    const prompt = `
Generate a history quiz with ${questionCount || 3} multiple-choice questions based on the following historical events and connections:

RECENT EVENTS:
${eventsContext || 'No recent events'}

RECENT CONNECTIONS:
${connectionsContext || 'No recent connections'}

REQUIREMENTS:
- Create a quiz with ${questionCount || 3} multiple-choice questions
- Include a mix of difficulties: ${adjustedBeginnerCount} beginner, ${adjustedIntermediateCount} intermediate, and ${adjustedAdvancedCount} advanced questions
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
            
            // Add detailed logging of the parsed response
            console.log('Parsed OpenAI quiz response:', {
                hasTitle: !!quizData.title,
                hasDescription: !!quizData.description,
                hasSubject: !!quizData.subject,
                hasTopic: !!quizData.topic,
                questionCount: quizData.questions?.length || 0,
                questionSample: quizData.questions?.[0] ? {
                    hasText: !!quizData.questions[0].text,
                    hasExplanation: !!quizData.questions[0].explanation,
                    optionsCount: quizData.questions[0].options?.length || 0,
                    hasCorrectOption: quizData.questions[0].options?.some((opt: any) => opt.is_correct || opt.correct)
                } : 'No questions found'
            });
            
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
        return null;
    }
}