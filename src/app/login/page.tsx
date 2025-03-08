'use client';

import React from 'react';
import Auth from '@/components/Auth';
import { Header } from '../components/Header';

export default function LoginPage(): React.ReactElement {
	return (
		<div className="flex items-center justify-center">
			<Auth />
		</div>
	);
}
