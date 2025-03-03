'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export const ThemeToggle: React.FC = () => {
	const { isDarkMode, toggleDarkMode } = useTheme();

	return (
		<div
			role="switch"
			aria-checked={isDarkMode}
			tabIndex={0}
			onClick={toggleDarkMode}
			onKeyDown={e => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggleDarkMode();
				}
			}}
			className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors flex items-center p-0.5 ${
				isDarkMode
					? 'bg-gray-300 dark:bg-gray-700'
					: 'bg-gray-200 dark:bg-gray-600'
			}`}
		>
			<span
				className={`absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center transition-opacity ${
					isDarkMode ? 'opacity-0' : 'opacity-100'
				}`}
			>
				☀️
			</span>
			<span
				className={`absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center transition-opacity ${
					isDarkMode ? 'opacity-100' : 'opacity-0'
				}`}
			>
				🌙
			</span>
			<div
				className={`absolute w-5 h-5 rounded-full shadow-sm transition-transform ${
					isDarkMode
						? 'translate-x-6 bg-amber-500 dark:bg-amber-400'
						: 'translate-x-0 bg-white dark:bg-gray-200'
				}`}
			/>
		</div>
	);
};
