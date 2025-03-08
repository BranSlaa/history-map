import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, withErrorHandling } from '@/utils/api-helpers';
import { SubscriptionTier } from '@/types/user';

export const POST = withErrorHandling(async (request: NextRequest) => {
    // Get the user data from the request
    const userData = await request.json();
    
    // Validate the request
    if (!userData.id) {
        return NextResponse.json(
            { error: 'User ID is required' },
            { status: 400 }
        );
    }
    
    // Get the admin client (this will throw if not available)
    const supabaseAdmin = getSupabaseAdmin();
    
    // Handle different operations based on the action parameter
    const action = userData.action;
    
    if (action === 'updateTier') {
        // Update the user's tier
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update({ tier: userData.tier })
            .eq('id', userData.id)
            .select('*')
            .single();
            
        if (error) {
            console.error('Error updating user tier via API:', error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }
        
        return NextResponse.json({ data });
    } else {
        return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
        );
    }
}); 