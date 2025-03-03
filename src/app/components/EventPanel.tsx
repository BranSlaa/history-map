import React, { useState, useEffect } from 'react';
import { Event } from '@/types/event';

const EventPanel: React.FC<{
	events: Event[];
	onSelectEvent: (event: Event) => void;
	pathOptions?: Event[]; // Array of events representing path options
	selectedEvent?: Event | null; // Add selectedEvent prop
}> = ({ events, onSelectEvent, pathOptions = [], selectedEvent }) => {
	// We can use the passed selectedEvent instead of maintaining our own state
	// Keeping this for backward compatibility but will prefer the prop
	const [localSelectedEvent, setLocalSelectedEvent] = useState<Event | null>(
		null,
	);

	// Reset selected event when events change significantly
	useEffect(() => {
		if (events.length === 0) {
			setLocalSelectedEvent(null);
		}
	}, [events]);

	// Use the prop if available, otherwise fall back to local state
	const effectiveSelectedEvent = selectedEvent || localSelectedEvent;

	// Group events by type: path options vs. regular events
	const regularEvents = events.filter(
		event => !pathOptions.some(option => option.id === event.id),
	);

	return (
		<div className="bg-amber-50 dark:bg-stone-900 border-2 border-amber-700 dark:border-amber-800 rounded-lg shadow-md mb-4 h-auto overflow-hidden flex flex-col">
			<div className="flex justify-between items-center border-b border-amber-700 dark:border-amber-800 pb-2 px-4 pt-3">
				<h2 className="text-lg font-semibold text-stone-800 dark:text-amber-100">
					Your Path Through History
				</h2>
				{events.length > 0 && (
					<span className="text-xs text-stone-600 dark:text-amber-300">
						{events.length} events
					</span>
				)}
			</div>

			{events.length === 0 ? (
				<div className="text-center p-4 text-sm italic text-stone-600 dark:text-amber-200">
					Search for a topic to discover historical events
				</div>
			) : (
				<div className="flex flex-col h-full">
					{/* Path Options Section - Highlighted with a distinct style */}
					{pathOptions.length > 0 && (
						<div className="border-b-2 border-amber-600 dark:border-amber-700 p-2 bg-amber-100 dark:bg-stone-950">
							<h3 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-2 px-2 flex items-center">
								<span className="mr-2">🔍</span>
								Choose Your Next Step:
							</h3>
							<div className="grid grid-cols-1 gap-2 px-2 pb-1">
								{pathOptions.map(event => (
									<button
										key={`option-${event.id}`}
										id={`event-${event.id}`}
										onClick={() => {
											setLocalSelectedEvent(event);
											onSelectEvent(event);
										}}
										className={`flex flex-col p-3 border-2 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors cursor-pointer shadow-md ${
											effectiveSelectedEvent?.id ===
											event.id
												? 'bg-amber-200 dark:bg-amber-800 border-amber-600 dark:border-amber-700'
												: event.interacted
													? 'bg-emerald-50/90 dark:bg-emerald-950/90 border-emerald-600 dark:border-emerald-700'
													: 'bg-amber-50/80 dark:bg-stone-900/80 border-amber-600 dark:border-amber-700'
										}`}
									>
										<div className="flex justify-between items-center">
											<span className="font-semibold text-stone-800 dark:text-amber-100">
												{event.title}
												{event.interacted && (
													<span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
														(Explored)
													</span>
												)}
											</span>
											<span className="text-xs bg-amber-600 dark:bg-amber-700 text-white px-2 py-1 rounded-full">
												{event.year}
											</span>
										</div>
										<div className="text-xs mt-1 text-stone-600 dark:text-amber-300">
											{event.subject
												.split('-')
												.map(
													word =>
														word
															.charAt(0)
															.toUpperCase() +
														word.slice(1),
												)
												.join(' ')}
										</div>
									</button>
								))}
							</div>
						</div>
					)}

					{/* Current Path Section - Shows events in chronological order */}
					<div className="flex-grow overflow-y-auto max-h-[calc(60vh-10rem)]">
						<h3 className="text-sm font-bold text-stone-700 dark:text-amber-400 px-4 pt-2 flex items-center">
							<span className="mr-2">📜</span>
							Your Path:
						</h3>
						<ul className="list-none p-3">
							{regularEvents.map((event, index) => (
								<li
									key={`${event.id}-sidebar-${index}`}
									id={`event-${event.id}`}
									onClick={() => {
										setLocalSelectedEvent(event);
										onSelectEvent(event);
									}}
									className={`cursor-pointer p-2 mb-2 border-b border-amber-700 border-opacity-30 hover:bg-amber-100 dark:hover:bg-amber-900 dark:hover:bg-opacity-30 transition-colors ${
										effectiveSelectedEvent?.id === event.id
											? 'bg-amber-100 dark:bg-amber-900 dark:bg-opacity-40 font-semibold'
											: event.interacted
												? 'bg-emerald-50/60 dark:bg-emerald-950/60'
												: ''
									}`}
									role="button"
									tabIndex={0}
								>
									<div className="flex justify-between items-center">
										<span className="text-stone-800 dark:text-amber-100">
											{event.title}
											{event.interacted && (
												<span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
													(Explored)
												</span>
											)}
										</span>
										<span className="text-xs text-stone-600 dark:text-amber-300">
											{event.year}
										</span>
									</div>
									<div className="text-xs mt-1 text-stone-600 dark:text-amber-300 opacity-70">
										{event.subject
											.split('-')
											.map(
												word =>
													word
														.charAt(0)
														.toUpperCase() +
													word.slice(1),
											)
											.join(' ')}
									</div>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}
		</div>
	);
};

export default EventPanel;
