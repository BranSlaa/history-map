import type { Metadata } from 'next';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { Header } from './components/Header';
import './globals.css';
import './output.css';

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
					<body className="antialiased bg-white dark:bg-stone-900 text-stone-800 dark:text-amber-100 h-full font-serif">
						<ThemeProvider>
							<div className="grid grid-cols-12 grid-rows-[auto_1fr] min-h-screen">
								<div className="col-span-12">
									<Header />
								</div>
								<div className="col-span-12">
									<main>{children}</main>
								</div>
							</div>
						</ThemeProvider>
					</body>
				</html>
			</UserProvider>
		</AuthProvider>
	);
}
