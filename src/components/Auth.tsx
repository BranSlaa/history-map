import React from 'react';
import { Auth as SupabaseAuth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import supabase from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';

export default function Auth(): React.ReactElement | null {
	const router = useRouter();
	const [session, setSession] = useState<Session | null>(null);

	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
			if (session) {
				router.push('/');
			}
		});

		return () => subscription.unsubscribe();
	}, [router]);

	if (session) {
		return null;
	}

	return (
		<div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
			<h2 className="text-2xl font-bold mb-6 text-center">
				Welcome to History Map
			</h2>
			<SupabaseAuth
				supabaseClient={supabase}
				appearance={{ theme: ThemeSupa }}
				providers={['google', 'github']}
				redirectTo={`${window.location.origin}/`}
				theme="dark"
			/>
		</div>
	);
}
