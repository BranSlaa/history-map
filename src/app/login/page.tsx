'use client';

import React from 'react';
import Auth from '@/components/Auth';

export default function LoginPage(): React.ReactElement {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
			<Auth />
		</div>
	);
}
