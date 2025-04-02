'use client';

import React from 'react';
import Link from 'next/link';

export const Header: React.FC = () => {
	return (
		<header
			id="header"
			className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b-2 border-amber-700 bg-amber-50/95 p-4 shadow-sm backdrop-blur-md"
		>
			<div className="flex items-center">
				<Link
					href="/"
					className="mr-8 font-serif text-xl font-bold text-amber-700"
				>
					History Map
				</Link>
				<nav className="flex gap-8">
					<Link
						href="/"
						className="font-serif text-stone-800 transition-colors hover:text-amber-700"
					>
						Map
					</Link>
					<Link
						href="/quizzes"
						className="font-serif text-stone-800 transition-colors hover:text-amber-700"
					>
						Quizzes
					</Link>
				</nav>
			</div>
			<div className="flex items-center gap-4">
				<button
					className="cursor-pointer rounded-md bg-amber-700 px-3 py-2 font-serif text-white transition-colors hover:bg-amber-800"
					onClick={() => {}}
				>
					Sign In
				</button>
			</div>
		</header>
	);
};
