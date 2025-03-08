import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, withErrorHandling } from '@/utils/api-helpers';
import { generateUsername } from '@/utils/usernameGenerator';

export const POST = withErrorHandling(async (request: NextRequest) => {
    // Get the profile data from the request
    const profileData = await request.json();
    
    // Validate the request
    if (!profileData.id) {
        return NextResponse.json(
            { error: 'User ID is required' },
            { status: 400 }
        );
    }
    
    // Get the admin client (this will throw if not available)
    const supabaseAdmin = getSupabaseAdmin();
    
    // Ensure all required fields are present with defaults if needed
    const profileToInsert = {
        id: profileData.id,
        username: profileData.username || generateUsername(),
        avatar_url: profileData.avatar_url || null,
        subscription_tier: profileData.tier === 'student' ? 1 : 
						profileData.tier === 'scholar' ? 2 : 
						profileData.tier === 'historian' ? 3 : 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        search_count: 0,
        connection_count: 0
    };
    
    // Create a new profile for the user using the admin client
    // This bypasses RLS policies
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .insert([profileToInsert])
        .select('*')
        .single();
        
    if (error) {
        console.error('Error creating profile via API:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
    
    // Return the new profile data
    return NextResponse.json({ data });
}); 