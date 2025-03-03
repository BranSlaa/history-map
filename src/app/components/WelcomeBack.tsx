import React, { useEffect, useState } from 'react';
import { Event } from '@/types/event';

interface WelcomeBackProps {
	lastEvent: Event | null;
	onContinue: () => void;
	onNewSearch: () => void;
	fetchEventsCallback: (topic: string, title: string) => void;
	topic: string;
	setTopic: (topic: string) => void;
}

const WelcomeBack: React.FC<WelcomeBackProps> = ({
	lastEvent,
	onContinue,
	onNewSearch,
	fetchEventsCallback,
	topic,
	setTopic,
}) => {
	const [isSearchVisible, setIsSearchVisible] = useState(false);

	// Log when the component mounts or updates
	useEffect(() => {
		console.log(
			'WelcomeBack component rendered with event:',
			lastEvent?.title,
		);
	}, [lastEvent]);

	if (!lastEvent) {
		console.log('WelcomeBack not showing - lastEvent is null');
		return null;
	}

	console.log('Rendering WelcomeBack with event:', lastEvent.title);

	return (
		<div className="bg-amber-50 dark:bg-stone-900 border-2 border-amber-700 dark:border-amber-800 rounded-lg shadow-xl max-w-lg w-full p-6">
			<h2 className="text-2xl font-bold text-stone-800 dark:text-amber-100 mb-4">
				Welcome Back!
			</h2>

			<p className="text-stone-700 dark:text-amber-200 mb-6">
				Would you like to continue exploring from your last event or
				start a new search?
			</p>

			{lastEvent && (
				<div className="mb-6 p-3 bg-amber-100 dark:bg-stone-800 rounded-lg">
					<h3 className="font-semibold text-stone-800 dark:text-amber-100">
						Last explored:
					</h3>
					<div className="flex items-center mt-2">
						<span className="text-xs bg-amber-600 dark:bg-amber-700 text-white px-2 py-1 rounded-full mr-2">
							{lastEvent.year}
						</span>
						<p className="text-stone-800 dark:text-amber-100">
							{lastEvent.title}
						</p>
					</div>
				</div>
			)}

			<div className="flex flex-col gap-4">
				<div className="flex flex-col sm:flex-row gap-4">
					<button
						onClick={onContinue}
						className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg transition-colors"
					>
						Continue Exploration
					</button>
				</div>

				<span className="text-center font-bold text-lg text-stone-800 dark:text-amber-100">
					OR
				</span>

				<div className="bg-white dark:bg-stone-800 shadow-lg rounded-lg p-4 text-center">
					<label
						htmlFor="search-input"
						className="block text-lg text-stone-800 dark:text-amber-100 mb-2"
					>
						Search for a new topic:
					</label>
					<div className="flex items-center">
						<input
							type="text"
							placeholder="Search historical events..."
							value={topic}
							onChange={e => setTopic(e.target.value)}
							className="flex-grow px-4 py-2 border border-r-0 rounded-l rounded-r-none focus:outline-none dark:bg-stone-700 dark:border-stone-600 dark:text-white"
							onKeyDown={e => {
								if (e.key === 'Enter') {
									fetchEventsCallback(topic, '');
									onNewSearch();
								}
							}}
						/>
						<button
							onClick={() => {
								fetchEventsCallback(topic, '');
								onNewSearch();
							}}
							className="bg-amber-600 text-white px-4 py-2 rounded-r rounded-l-none border dark:border-stone-600 hover:bg-amber-700 transition"
						>
							Search
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default WelcomeBack;
