'use client';

import React from 'react';
import Auth from '@/components/Auth';
import { Header } from '../components/Header';

export default function LoginPage(): React.ReactElement {
	return (
		<div className="min-h-screen grid grid-rows-[auto_1fr] bg-gray-100 dark:bg-gray-900">
			<Header />
			<div className="flex items-center justify-center">
				<Auth />
			</div>
		</div>
	);
}
