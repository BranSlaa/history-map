import { NextResponse } from 'next/server';
import { getSupabaseAdmin as getAdmin } from '@/lib/supabaseAdmin';

/**
 * Helper function to safely get the supabaseAdmin client in API routes
 * Includes error handling for when the client is not available
 */
export function getSupabaseAdmin() {
    try {
        return getAdmin();
    } catch (error) {
        console.error('Failed to get supabaseAdmin client:', error);
        throw new Error('Database admin client not available');
    }
}

/**
 * Helper function to handle API errors consistently
 */
export function handleApiError(error: any, message: string = 'An error occurred') {
    console.error(`API Error: ${message}`, error);
    
    const errorMessage = error instanceof Error 
        ? error.message 
        : (typeof error === 'string' ? error : JSON.stringify(error));
    
    return NextResponse.json(
        { error: `${message}: ${errorMessage}` },
        { status: 500 }
    );
}

/**
 * Wrapper function for API handlers to handle common error cases
 */
export function withErrorHandling(handler: Function) {
    return async (...args: any[]) => {
        try {
            return await handler(...args);
        } catch (error) {
            if (error instanceof Error && error.message === 'Database admin client not available') {
                return NextResponse.json(
                    { error: 'Server configuration error' },
                    { status: 500 }
                );
            }
            
            return handleApiError(error);
        }
    };
} 