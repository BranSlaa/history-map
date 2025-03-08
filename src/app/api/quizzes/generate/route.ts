import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { 
    QUIZ_DIFFICULTIES, 
    DEFAULT_QUIZ_TOPIC,
} from '@/constants/quiz';
import { generateCompleteQuiz } from '@/utils/quizService';

export const maxDuration = 300; // Increase max execution time to 5 minutes

// Create a Supabase service role client with admin privileges at the top level
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        serviceRoleKey
    )
    : null;

// Define difficulty types for TypeScript
type DifficultyLevel = typeof QUIZ_DIFFICULTIES[keyof typeof QUIZ_DIFFICULTIES];

// Performance thresholds for difficulty progression
const PROGRESSION_THRESHOLDS = {
    BEGINNER_TO_INTERMEDIATE: 75,    // 75% average required to progress
    INTERMEDIATE_TO_ADVANCED: 80,    // 80% average required to advance
    REGRESSION_THRESHOLD: 40         // Below 40% suggests regression
};

// Setup Supabase clients
export async function POST(request: NextRequest) {
    if (!supabaseAdmin) {
        console.error('Missing service role key or admin client setup failed');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    try {
        // Check for Authorization header
        const authHeader = request.headers.get('Authorization');
        let userId: string | null = null;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            
            // Verify the token with Supabase
            const { data, error } = await supabaseAdmin.auth.getUser(token);
            
            if (error) {
                console.error('Token verification failed:', error);
                return NextResponse.json({ 
                    error: 'Authentication failed', 
                    message: 'Invalid or expired token' 
                }, { status: 401 });
            }
            
            if (data?.user?.id) {
                userId = data.user.id;
            }
        }
        
        // If no valid token in header, try cookie-based auth as fallback
        if (!userId) {
            // Get authenticated session from auth context
            const cookieStore = cookies();
            const supabase = createServerComponentClient({ 
                cookies: () => cookieStore 
            });

            const { data: { user } } = await supabase.auth.getUser();
            
            if (user?.id) {
                userId = user.id;
            }
        }
        
        // If still no userId, authentication has failed
        if (!userId) {
            return NextResponse.json({ 
                error: 'Authentication required',
                message: 'Please log in to generate quizzes'
            }, { status: 401 });
        }
        
        // Get the request body to check for path_id
        const body = await request.json().catch(() => ({}));
        const pathId = body.path_id || null;
        const searchTerm = body.search_term || DEFAULT_QUIZ_TOPIC;
        
        let validEvents = [];
        
        // If a path_id is provided, get events from the path instead of user interactions
        if (pathId) {
            // First verify the path exists and belongs to the user
            const { data: pathData, error: pathError } = await supabaseAdmin
                .from('historical_paths')
                .select('id, name')
                .eq('id', pathId)
                .eq('user_id', userId)
                .single();
                
            if (pathError || !pathData) {
                console.error('Error fetching path:', pathError);
                return NextResponse.json({ 
                    error: 'Path not found',
                    message: 'The specified path does not exist or does not belong to you'
                }, { status: 404 });
            }
            
            // Get the events associated with this path
            const { data: pathEvents, error: pathEventsError } = await supabaseAdmin
                .from('path_events')
                .select('event_id, event:events(*)')
                .eq('path_id', pathId)
                .order('order_index', { ascending: true });
                
            if (pathEventsError) {
                console.error('Error fetching path events:', pathEventsError);
                return NextResponse.json({ 
                    error: 'Data error',
                    message: 'Failed to retrieve path events'
                }, { status: 500 });
            }
            
            if (!pathEvents || pathEvents.length === 0) {
                return NextResponse.json({ 
                    error: 'No events found',
                    message: 'This path has no events. Please add events to your path before generating a quiz.'
                }, { status: 400 });
            }
            
            // Extract the events from the path_events join table
            validEvents = pathEvents
                .map(pe => pe.event as any)
                .filter(event => event && typeof event === 'object' && event.id && event.title);
                
            if (validEvents.length === 0) {
                return NextResponse.json({ 
                    error: 'No valid events',
                    message: 'No valid events found in this path to generate a quiz from'
                }, { status: 400 });
            }
        } else {
            // Get user's event interactions (original logic for non-path quizzes)
            const { data: interactions, error: interactionsError } = await supabaseAdmin
                .from('user_event_interactions')
                .select('event_id')
                .eq('user_id', userId);
                
            if (interactionsError) {
                console.error('Error fetching user interactions:', interactionsError);
                return NextResponse.json({ 
                    error: 'Data error',
                    message: 'Failed to retrieve user history'
                }, { status: 500 });
            }
            
            if (!interactions || interactions.length === 0) {
                return NextResponse.json({ 
                    error: 'No events found',
                    message: 'You need to explore some historical events before generating a quiz'
                }, { status: 400 });
            }
            
            // Get the events for the interactions
            const eventIds = interactions.map(i => i.event_id);
            const { data: eventsData, error: eventsError } = await supabaseAdmin
                .from('events')
                .select('*')
                .in('id', eventIds);
                
            if (eventsError || !eventsData) {
                console.error('Error fetching events:', eventsError);
                return NextResponse.json({ 
                    error: 'Data error',
                    message: 'Failed to retrieve event data'
                }, { status: 500 });
            }
            
            // Filter for valid events
            validEvents = eventsData.filter(event => event && event.id && event.title);
            if (validEvents.length === 0) {
                return NextResponse.json({ 
                    error: 'No valid events',
                    message: 'No valid events found to generate quiz from'
                }, { status: 400 });
            }
        }
        
        // Determine user's skill level based on previous quiz attempts
        // First, fetch user's quiz attempts
        const { data: quizAttempts, error: attemptsError } = await supabaseAdmin
            .from('quiz_attempts')
            .select('*, quiz:quizzes(*)')
            .eq('user_id', userId)
            .order('started_at', { ascending: false })
            .limit(10); // Consider last 10 attempts for adaptive difficulty
            
        if (attemptsError) {
            console.error('Error fetching quiz attempts:', attemptsError);
            // Continue with default difficulty if there's an error fetching attempts
        }
        
        // Calculate user performance metrics
        let recommendedDifficulty: DifficultyLevel = QUIZ_DIFFICULTIES.BEGINNER; // Default for new users
        
        if (quizAttempts && quizAttempts.length > 0) {
            // Calculate average score across all attempts
            const totalScore = quizAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0);
            const averageScore = (totalScore / quizAttempts.length) * 100; // Convert to percentage
            
            // Calculate recent performance (last 3 attempts, weighted more heavily)
            const recentAttempts = quizAttempts.slice(0, 3);
            const recentScore = recentAttempts.length > 0 
                ? (recentAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / recentAttempts.length) * 100 
                : 0;
                
            // Determine current difficulty level based on most recent attempts
            const difficultyCount: Record<DifficultyLevel, number> = {
                [QUIZ_DIFFICULTIES.BEGINNER]: 0,
                [QUIZ_DIFFICULTIES.INTERMEDIATE]: 0,
                [QUIZ_DIFFICULTIES.ADVANCED]: 0
            };
            
            // Count difficulty levels in recent attempts
            recentAttempts.forEach(attempt => {
                const difficulty = attempt.quiz?.difficulty as DifficultyLevel;
                if (difficulty && difficulty in difficultyCount) {
                    difficultyCount[difficulty]++;
                }
            });
            
            // Determine current difficulty (what the user is currently taking)
            let currentDifficulty: DifficultyLevel = QUIZ_DIFFICULTIES.BEGINNER;
            let maxCount = difficultyCount[QUIZ_DIFFICULTIES.BEGINNER];
            
            if (difficultyCount[QUIZ_DIFFICULTIES.INTERMEDIATE] > maxCount) {
                currentDifficulty = QUIZ_DIFFICULTIES.INTERMEDIATE;
                maxCount = difficultyCount[QUIZ_DIFFICULTIES.INTERMEDIATE];
            }
            
            if (difficultyCount[QUIZ_DIFFICULTIES.ADVANCED] > maxCount) {
                currentDifficulty = QUIZ_DIFFICULTIES.ADVANCED;
            }
            
            // Recommend difficulty based on performance
            if (currentDifficulty === QUIZ_DIFFICULTIES.BEGINNER && averageScore >= PROGRESSION_THRESHOLDS.BEGINNER_TO_INTERMEDIATE) {
                // Progress from beginner to intermediate
                recommendedDifficulty = QUIZ_DIFFICULTIES.INTERMEDIATE;
            } else if (currentDifficulty === QUIZ_DIFFICULTIES.INTERMEDIATE) {
                if (averageScore >= PROGRESSION_THRESHOLDS.INTERMEDIATE_TO_ADVANCED) {
                    // Progress from intermediate to advanced
                    recommendedDifficulty = QUIZ_DIFFICULTIES.ADVANCED;
                } else if (averageScore < PROGRESSION_THRESHOLDS.REGRESSION_THRESHOLD) {
                    // Regress from intermediate to beginner if really struggling
                    recommendedDifficulty = QUIZ_DIFFICULTIES.BEGINNER;
                } else {
                    // Stay at intermediate
                    recommendedDifficulty = QUIZ_DIFFICULTIES.INTERMEDIATE;
                }
            } else if (currentDifficulty === QUIZ_DIFFICULTIES.ADVANCED) {
                if (averageScore < PROGRESSION_THRESHOLDS.REGRESSION_THRESHOLD) {
                    // Regress from advanced to intermediate if really struggling
                    recommendedDifficulty = QUIZ_DIFFICULTIES.INTERMEDIATE;
                } else {
                    // Stay at advanced
                    recommendedDifficulty = QUIZ_DIFFICULTIES.ADVANCED;
                }
            } else {
                // Stay at beginner if not meeting progression criteria
                recommendedDifficulty = QUIZ_DIFFICULTIES.BEGINNER;
            }
            
            console.log(`User performance metrics - Average: ${averageScore.toFixed(2)}%, Recent: ${recentScore.toFixed(2)}%, Current: ${currentDifficulty}, Recommended: ${recommendedDifficulty}`);
        }
        
        // Use the search term as the topic if available
        let quizTopic = DEFAULT_QUIZ_TOPIC;
        if (searchTerm && searchTerm !== DEFAULT_QUIZ_TOPIC) {
            quizTopic = searchTerm;
        }
        
        // Use our quiz service to generate the complete quiz
        const result = await generateCompleteQuiz(
            userId,
            validEvents,
            validEvents[0].subject || 'History',
            quizTopic,
            recommendedDifficulty,
            pathId,
            searchTerm
        );
        
        // Return success with the quiz ID and details
        return NextResponse.json({
            success: true,
            quizId: result.id,
            title: result.title,
            description: result.description,
            question_count: result.question_count,
            difficulty: recommendedDifficulty,
            message: `${recommendedDifficulty} quiz created successfully with ${result.question_count} questions`
        });
        
    } catch (error) {
        console.error('Error in quiz generation:', error);
        return NextResponse.json({ 
            error: 'Server error', 
            message: 'An unexpected error occurred while generating the quiz'
        }, { status: 500 });
    }
}

// Helper function to process events for quiz generation
function processEventsForQuiz(events: any[]) {
    if (!events || !Array.isArray(events)) return [];
    
    // Filter out events without essential data
    return events.filter(event => {
        return event && event.id && event.title;
    });
}