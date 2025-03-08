import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, withErrorHandling } from '@/utils/api-helpers';

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
    
    // Create a new profile for the user using the admin client
    // This bypasses RLS policies
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .insert([profileData])
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