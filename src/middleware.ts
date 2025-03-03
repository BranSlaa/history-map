import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
	const res = NextResponse.next();
	const supabase = createMiddlewareClient({ req, res });

	const {
		data: { session },
	} = await supabase.auth.getSession();

	// Check authentication for protected routes
	if (
		!session &&
		(req.nextUrl.pathname.startsWith('/dashboard') ||
			req.nextUrl.pathname.startsWith('/profile'))
	) {
		return NextResponse.redirect(new URL('/login', req.url));
	}

	return res;
}

export const config = {
	matcher: [
		'/((?!api|_next/static|_next/image|favicon.ico|images|public).*)',
	],
};
