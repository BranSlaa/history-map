import React from 'react';
import { Event } from '@/types/event';

interface InformationPanelProps {
	event: Event | null;
	onFetchMore?: () => void;
}

const InformationPanel: React.FC<InformationPanelProps> = ({
	event,
	onFetchMore,
}) => {
	if (!event) {
		return (
			<div className="bg-amber-50 dark:bg-stone-900 border-2 border-amber-700 dark:border-amber-800 rounded-lg shadow-md p-4 h-auto">
				<p className="text-stone-600 dark:text-amber-200 italic text-center">
					Select an event to view details
				</p>
			</div>
		);
	}

	return (
		<div className="bg-amber-50 dark:bg-stone-900 border-2 shadow-md p-4 h-auto flex flex-col">
			<h2 className="text-xl font-bold mb-2 text-stone-800 dark:text-amber-100">
				{event.title}
			</h2>
			<div className="flex flex-col gap-1 text-stone-700 dark:text-amber-200 mb-2">
				<span className="inline-flex items-center">
					<span className="font-medium mr-2">Year:</span>
					<span className="bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded text-amber-800 dark:text-amber-200">
						{event.year}
					</span>
				</span>
				<span>
					<span className="font-medium mr-2">Subject:</span>
					<span className="text-sm">
						{event.subject
							.split('-')
							.map(
								word =>
									word.charAt(0).toUpperCase() +
									word.slice(1),
							)
							.join(' ')}
					</span>
				</span>
			</div>

			<div className="mb-3 pr-2">
				<h3 className="font-medium text-stone-800 dark:text-amber-100 mb-1">
					Description:
				</h3>
				<p className="text-stone-700 dark:text-amber-200 text-[18px]">
					{event.description}
				</p>
			</div>

			<button
				onClick={onFetchMore}
				className="mt-auto py-2 px-4 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-lg transition-colors self-start"
			>
				Explore Related Events
			</button>
		</div>
	);
};

export default InformationPanel;
