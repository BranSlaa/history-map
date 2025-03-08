import { createClient } from '@supabase/supabase-js';

if (
	!process.env.NEXT_PUBLIC_SUPABASE_URL ||
	!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
	throw new Error('Missing Supabase environment variables');
}

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a client with improved authentication options
export const supabase = createClient(
	supabaseUrl, 
	supabaseAnonKey,
	{
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true
		}
	}
);

export default supabase;
