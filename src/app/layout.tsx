import type { Metadata } from 'next';
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
		<html lang="en" className="h-full">
			<body className="antialiased bg-white text-stone-800 h-full font-serif">
				<div className="grid grid-cols-[auto_1920px_auto] grid-rows-[auto_1fr] min-h-screen">
					<Header />
					<main className="bg-gray-900 text-white col-start-2 col-span-1">
						{children}
					</main>
				</div>
			</body>
		</html>
	);
}
