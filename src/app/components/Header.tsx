'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export const Header: React.FC = () => {
	const [isDesktop, setIsDesktop] = useState(false);
	const { authUser, signOut } = useAuth();
	const router = useRouter();

	useEffect(() => {
		const checkScreenSize = () => {
			setIsDesktop(window.innerWidth >= 768);
		};

		// Initial check
		checkScreenSize();

		// Add listener for resize
		window.addEventListener('resize', checkScreenSize);

		// Cleanup
		return () => window.removeEventListener('resize', checkScreenSize);
	}, []);

	const handleSignIn = () => {
		router.push('/login');
	};

	const handleSignOut = async () => {
		await signOut();
		router.push('/');
	};

	return (
		<header className="flex justify-between items-center p-4 h-16 bg-amber-50/95 dark:bg-stone-900/95 backdrop-blur-md border-b-2 border-amber-700 dark:border-amber-800 shadow-sm dark:shadow-none">
			<div className="flex items-center">
				<Link
					href="/"
					className="text-xl font-bold text-amber-700 dark:text-amber-500 mr-8 font-serif"
				>
					History Map
				</Link>
				<nav className={`${isDesktop ? 'flex' : 'hidden'} gap-8`}>
					<Link
						href="/"
						className="text-stone-800 dark:text-amber-100 hover:text-amber-700 dark:hover:text-amber-500 font-medium transition-colors"
					>
						Map
					</Link>
					{authUser && (
						<Link
							href="/profile"
							className="text-stone-800 dark:text-amber-100 hover:text-amber-700 dark:hover:text-amber-500 font-medium transition-colors"
						>
							Profile
						</Link>
					)}
				</nav>
			</div>
			<div className="flex items-center gap-4">
				<ThemeToggle />
				{!authUser ? (
					<button
						className="px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-md font-medium cursor-pointer transition-colors"
						onClick={handleSignIn}
					>
						Sign In
					</button>
				) : (
					<button
						className="px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-md font-medium cursor-pointer transition-colors"
						onClick={handleSignOut}
					>
						Sign Out
					</button>
				)}
			</div>
		</header>
	);
};
