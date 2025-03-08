import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Set CORS headers for the API route
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Create a Supabase service role client with admin privileges
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAdmin = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null;

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = cookies();
        const supabase = createServerComponentClient({ cookies: () => cookieStore });
        
        // Parse request body
        const { activityType, userId: providedUserId } = await request.json();
        
        if (!activityType || !['search', 'connection'].includes(activityType)) {
            return NextResponse.json(
                { error: 'Invalid activity type' }, 
                { status: 400, headers: corsHeaders }
            );
        }
        
        // Get current user
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || providedUserId;
        
        // If no authenticated user and no provided userId, return an anonymous success
        // This allows the app to function without requiring authentication
        if (!userId) {
            return NextResponse.json(
                { 
                    success: true, 
                    anonymous: true,
                    shouldTriggerQuiz: false
                }, 
                { headers: corsHeaders }
            );
        }
        
        // Use the service role client for profile operations if available
        const metricsClient = supabaseAdmin || supabase;
        
        // Get user's profile
        let { data: profileData, error: profileError } = await metricsClient
            .from('profiles')
            .select('search_count, connection_count')
            .eq('id', userId)
            .single();
            
        if (profileError) {
            console.error('Error fetching user profile:', profileError);
            return NextResponse.json(
                { error: 'Failed to fetch user profile' }, 
                { status: 500, headers: corsHeaders }
            );
        }
        
        // Ensure we have a valid profile
        const profile = profileData || { search_count: 0, connection_count: 0 };
        
        // Update metrics based on activity type
        const updateData: Record<string, any> = {};
        
        if (activityType === 'search') {
            updateData.search_count = (profile.search_count || 0) + 1;
            updateData.last_search_at = new Date().toISOString();
        } else if (activityType === 'connection') {
            updateData.connection_count = (profile.connection_count || 0) + 1;
            updateData.last_connection_at = new Date().toISOString();
        }
        
        // Update profile
        const { error: updateError } = await metricsClient
            .from('profiles')
            .update(updateData)
            .eq('id', userId);
            
        if (updateError) {
            console.error('Error updating user profile:', updateError);
            return NextResponse.json(
                { error: 'Failed to update metrics' }, 
                { status: 500, headers: corsHeaders }
            );
        }
        
        // Calculate whether it's time for a quiz
        const searchCount = profile.search_count || 0;
        const connectionCount = profile.connection_count || 0;
        
        const updatedSearchCount = activityType === 'search' ? searchCount + 1 : searchCount;
        const updatedConnectionCount = activityType === 'connection' ? connectionCount + 1 : connectionCount;
        const totalCount = updatedSearchCount + updatedConnectionCount;
        
        const shouldTriggerQuiz = totalCount % 3 === 0 && totalCount > 0;
        console.log(`[Quiz Debug] User: ${userId}, Activity: ${activityType}, Total Count: ${totalCount}, Should Trigger Quiz: ${shouldTriggerQuiz}`);
        
        return NextResponse.json({
            success: true,
            metrics: {
                searchCount: updatedSearchCount,
                connectionCount: updatedConnectionCount,
                totalCount,
            },
            shouldTriggerQuiz
        }, { headers: corsHeaders });
        
    } catch (error) {
        console.error('Error in activity tracking:', error);
        return NextResponse.json(
            { error: 'Internal server error' }, 
            { status: 500, headers: corsHeaders }
        );
    }
} 