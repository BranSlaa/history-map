import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import {
	ClerkProvider,
	SignInButton,
	SignUpButton,
	SignedIn,
	SignedOut,
	UserButton,
} from '@clerk/nextjs';
import { UserProvider } from '@/contexts/UserContext';
import Link from 'next/link';
import './globals.css';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

export const metadata: Metadata = {
	title: 'History Map',
	description:
		'A new way to learn history. Search topics, take quizzes, beat your friends to see who is the best historian!',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<ClerkProvider>
			<UserProvider>
				<html lang="en">
					<body
						className={`${geistSans.variable} ${geistMono.variable} antialiased`}
					>
						<header className="flex justify-between items-center p-4 h-16 bg-white shadow-sm">
							<div className="flex items-center">
								<Link
									href="/"
									className="text-xl font-bold mr-8"
								>
									History Map
								</Link>
								<nav className="hidden md:flex space-x-6">
									<Link
										href="/"
										className="hover:text-blue-600 transition-colors"
									>
										Map
									</Link>
									<Link
										href="/scholar/advanced-search"
										className="hover:text-blue-600 transition-colors"
									>
										Advanced Search
									</Link>
									<Link
										href="/historian/data-analysis"
										className="hover:text-blue-600 transition-colors"
									>
										Data Analysis
									</Link>
									<Link
										href="/profile"
										className="hover:text-blue-600 transition-colors"
									>
										Profile
									</Link>
								</nav>
							</div>
							<div className="flex items-center gap-4">
								<SignedOut>
									<SignInButton />
									<SignUpButton />
								</SignedOut>
								<SignedIn>
									<UserButton />
								</SignedIn>
							</div>
						</header>
						{children}
					</body>
				</html>
			</UserProvider>
		</ClerkProvider>
	);
}
