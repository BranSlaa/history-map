import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { repairQuiz } from '@/utils/quizService';

// Create a Supabase service role client with admin privileges at the top level
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        serviceRoleKey
    )
    : null;

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const quizId = params?.id;
    
    if (!quizId) {
        return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 });
    }
    
    try {
        // Check if we have admin client
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Server configuration error - missing admin access' }, { status: 500 });
        }
        
        // Parse request body once at the beginning
        const requestBody = await request.json().catch(() => ({}));
        const { subject, topic } = requestBody;
        
        if (!subject) {
            return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
        }
        
        // Create Supabase client with cookies from the request
        const cookieStore = cookies();
        const supabase = createServerComponentClient({ cookies: () => cookieStore });

        // Get user ID from session
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        
        // Require authentication
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        
        // Fetch user's recent interactions to get context for generating questions
        const { data: userEvents, error: eventsError } = await supabaseAdmin
            .from('user_event_interactions')
            .select('event_id, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (eventsError) {
            console.error('Error fetching recent events:', eventsError);
            return NextResponse.json({ error: 'Failed to fetch user events' }, { status: 500 });
        }
        
        if (!userEvents || userEvents.length === 0) {
            return NextResponse.json({ 
                error: 'No events found',
                message: 'You need to explore some historical events before repairing a quiz'
            }, { status: 400 });
        }
        
        // Get full event details for the interactions
        const eventIds = userEvents.map(e => e.event_id);
        const { data: events, error: eventDetailsError } = await supabaseAdmin
            .from('events')
            .select('id, title, subject, year, info')
            .in('id', eventIds);
            
        if (eventDetailsError || !events || events.length === 0) {
            console.error('Error fetching event details:', eventDetailsError);
            return NextResponse.json({ error: 'Failed to fetch event details' }, { status: 500 });
        }
        
        // Use the quiz service to handle the repair process
        try {
            const result = await repairQuiz(
                quizId,
                userId,
                events,
                subject,
                topic || 'History'
            );
            
            return NextResponse.json(result);
        } catch (error: any) {
            // Handle specific error cases
            if (error.message === 'Quiz not found') {
                return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
            }
            
            if (error.message === 'Unauthorized to repair this quiz') {
                return NextResponse.json({ error: 'Not authorized to repair this quiz' }, { status: 403 });
            }
            
            console.error('Error in quiz repair:', error);
            return NextResponse.json({ 
                error: 'Failed to repair quiz', 
                message: error.message || 'Unknown error'
            }, { status: 500 });
        }
    } catch (error) {
        console.error('Error processing repair request:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 