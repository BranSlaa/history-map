import type { Metadata } from 'next';
import { Header } from './components/Header';
import './globals.css';
import './output.css';
import 'leaflet/dist/leaflet.css';

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
				<div className="flex flex-col h-screen">
					<Header />
					<main className="flex-1 bg-amber-50">{children}</main>
				</div>
			</body>
		</html>
	);
}
