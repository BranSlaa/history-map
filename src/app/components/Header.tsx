'use client';

import React from 'react';
import Link from 'next/link';

export const Header: React.FC = () => {
	return (
		<header
			id="header"
			className="flex justify-between items-center p-4 h-16 bg-amber-50/95 dark:bg-stone-900/95 backdrop-blur-md border-b-2 border-amber-700 dark:border-amber-800 shadow-sm dark:shadow-none sticky top-0 z-50 w-full"
		>
			<div className="flex items-center">
				<Link
					href="/"
					className="text-xl font-bold text-amber-700 dark:text-amber-500 mr-8 font-serif"
				>
					History Map
				</Link>
				<nav className="flex gap-8">
					<Link
						href="/"
						className="text-stone-800 dark:text-amber-100 hover:text-amber-700 dark:hover:text-amber-500 font-serif transition-colors"
					>
						Map
					</Link>
					<Link
						href="/quizzes"
						className="text-stone-800 dark:text-amber-100 hover:text-amber-700 dark:hover:text-amber-500 font-serif transition-colors"
					>
						Quizzes
					</Link>
				</nav>
			</div>
			<div className="flex items-center gap-4">
				<button
					className="px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-md font-serif cursor-pointer transition-colors"
					onClick={() => {}}
				>
					Sign In
				</button>
			</div>
		</header>
	);
};
