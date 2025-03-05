import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        serviceRoleKey
      )
    : null;

export async function GET() {
    try {
        const cookieStore = cookies();
        const supabase = createServerComponentClient({ cookies: () => cookieStore });
        
        // Use the admin client if available
        const client = supabaseAdmin || supabase;
        
        // Query for the table information
        const { data, error } = await client.rpc('get_table_definition', {
            table_name: 'quizzes'
        });
        
        if (error) {
            // Try a simpler approach - just select a dummy row to get columns
            const { data: columns, error: columnsError } = await client
                .from('quizzes')
                .select('*')
                .limit(1);
                
            if (columnsError) {
                return NextResponse.json({ 
                    error: 'Failed to get schema information',
                    details: columnsError
                }, { status: 500 });
            }
            
            return NextResponse.json({ 
                message: 'Retrieved columns instead of schema',
                columns: columns.length > 0 ? Object.keys(columns[0]) : [],
                sample: columns
            });
        }
        
        return NextResponse.json({ 
            message: 'Schema retrieved successfully',
            schema: data
        });
    } catch (error) {
        console.error('Error checking schema:', error);
        return NextResponse.json({ 
            error: 'Internal server error', 
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
} 