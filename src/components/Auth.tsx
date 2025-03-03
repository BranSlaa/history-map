'use client';

import React from 'react';
import { Auth as SupabaseAuth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function Auth(): React.ReactElement {
	const { loading } = useAuth();

	if (loading) {
		return (
			<div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
				<div className="text-center">Loading...</div>
			</div>
		);
	}

	return (
		<div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
			<h2 className="text-2xl font-bold mb-6 text-center dark:text-white">
				Welcome to History Map
			</h2>
			<SupabaseAuth
				supabaseClient={supabase}
				appearance={{
					theme: ThemeSupa,
					variables: {
						default: {
							colors: {
								brand: '#3B82F6',
								brandAccent: '#2563EB',
							},
						},
					},
				}}
				providers={['google', 'github']}
				redirectTo={`${window.location.origin}/profile`}
				theme={
					document.documentElement.classList.contains('dark')
						? 'dark'
						: 'light'
				}
			/>
		</div>
	);
}
