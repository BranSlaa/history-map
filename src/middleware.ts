import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
	const res = NextResponse.next();
	const supabase = createMiddlewareClient({ req, res });
	
	// Refresh the session to keep it active, but don't redirect
	await supabase.auth.getSession();
	
	return res;
}

export const config = {
	matcher: [
		'/((?!api|_next/static|_next/image|favicon.ico|images|public).*)',
	],
};
