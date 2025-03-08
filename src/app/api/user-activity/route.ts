import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase service role client with admin privileges
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        serviceRoleKey
    )
    : null;

export async function POST(request: NextRequest) {
    try {
        const cookieStore = cookies();
        const supabase = createServerComponentClient({ cookies: () => cookieStore });
        
        // Get current user
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const userId = session.user.id;
        const { activityType } = await request.json();
        
        if (!activityType || !['search', 'connection'].includes(activityType)) {
            return NextResponse.json({ error: 'Invalid activity type' }, { status: 400 });
        }
        
        // Use the service role client for user metrics operations if available
        const metricsClient = supabaseAdmin || supabase;
        
        // Get user's activity metrics or create if doesn't exist
        let { data: metrics, error: metricsError } = await metricsClient
            .from('user_activity_metrics')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        if (metricsError) {
            // Create metrics record if it doesn't exist
            const { data: newMetrics, error: createError } = await metricsClient
                .from('user_activity_metrics')
                .insert({ user_id: userId })
                .select()
                .single();
                
            if (createError) {
                console.error('Error creating user metrics:', createError);
                return NextResponse.json({ error: 'Failed to create user metrics' }, { status: 500 });
            }
            
            metrics = newMetrics;
        }
        
        // Update metrics based on activity type
        const updateData: Record<string, any> = {
            updated_at: new Date().toISOString()
        };
        
        if (activityType === 'search') {
            updateData.search_count = (metrics.search_count || 0) + 1;
            updateData.last_search_at = new Date().toISOString();
        } else if (activityType === 'connection') {
            updateData.connection_count = (metrics.connection_count || 0) + 1;
            updateData.last_connection_at = new Date().toISOString();
        }
        
        // Update metrics
        const { error: updateError } = await metricsClient
            .from('user_activity_metrics')
            .update(updateData)
            .eq('user_id', userId);
            
        if (updateError) {
            console.error('Error updating user metrics:', updateError);
            return NextResponse.json({ error: 'Failed to update metrics' }, { status: 500 });
        }
        
        // Calculate whether it's time for a quiz
        const totalCount = (
            activityType === 'search' 
                ? (metrics.search_count || 0) + 1 
                : (metrics.search_count || 0)
        ) + (
            activityType === 'connection' 
                ? (metrics.connection_count || 0) + 1 
                : (metrics.connection_count || 0)
        );
        
        const shouldTriggerQuiz = totalCount % 3 === 0 && totalCount > 0;
        console.log(`[Quiz Debug] User: ${userId}, Activity: ${activityType}, Total Count: ${totalCount}, Should Trigger Quiz: ${shouldTriggerQuiz}`);
        
        return NextResponse.json({
            success: true,
            metrics: {
                searchCount: activityType === 'search' ? (metrics.search_count || 0) + 1 : (metrics.search_count || 0),
                connectionCount: activityType === 'connection' ? (metrics.connection_count || 0) + 1 : (metrics.connection_count || 0),
                totalCount,
                quizTriggerCount: metrics.quiz_trigger_count || 0
            },
            shouldTriggerQuiz
        });
        
    } catch (error) {
        console.error('Error in activity tracking:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 