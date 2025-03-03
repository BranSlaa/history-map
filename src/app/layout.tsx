import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { UserProvider } from '@/contexts/UserContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { Header } from './components/Header';
import './globals.css';
import './output.css';

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
		<AuthProvider>
			<UserProvider>
				<html lang="en" className="h-full">
					<body
						className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white dark:bg-stone-900 text-stone-800 dark:text-amber-100 h-full`}
					>
						<ThemeProvider>
							<main>{children}</main>
						</ThemeProvider>
					</body>
				</html>
			</UserProvider>
		</AuthProvider>
	);
}
