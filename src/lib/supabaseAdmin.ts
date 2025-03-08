import { createClient, SupabaseClient } from '@supabase/supabase-js';

// This file should only be imported in server components or API routes
// It contains the admin client with the service role key

// Function to get the admin client - only works server-side
export function getSupabaseAdmin(): SupabaseClient {
    // Ensure this is only used on the server
    if (typeof window !== 'undefined') {
        console.error('getSupabaseAdmin was called on the client side. This is a security risk and should never happen.');
        throw new Error('getSupabaseAdmin must only be called on the server');
    }
    
    // Create and return the admin client
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
}

// For backwards compatibility - but this should be removed in the future
// and all code should use getSupabaseAdmin() instead
const supabaseAdmin = typeof window === 'undefined' 
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      )
    : null;

export default supabaseAdmin; 