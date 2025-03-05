import React, { useState, useEffect } from 'react';
import { Event } from '@/types/event';

const EventPanel: React.FC<{
	events: Event[];
	onSelectEvent: (event: Event) => void;
	selectedEvent?: Event | null; // Add selectedEvent prop
	chosenEvents?: Event[];
}> = ({ events, onSelectEvent, selectedEvent, chosenEvents = [] }) => {
	const [localSelectedEvent, setLocalSelectedEvent] = useState<Event | null>(
		null,
	);
	const [relatedOptions, setRelatedOptions] = useState<Event[]>([]);

	// Use the prop if available, otherwise fall back to local state
	const effectiveSelectedEvent = selectedEvent || localSelectedEvent;

	// This effect generates related event options based on the current events and selectedEvent
	useEffect(() => {
		const findRelatedEvents = (): Event[] => {
			if (!effectiveSelectedEvent || events.length <= 1) {
				return [];
			}

			// Find events from the same subject or time period
			const selectedSubject = effectiveSelectedEvent.subject;
			const selectedYear = effectiveSelectedEvent.year;

			// Filter for events that are not the selected event
			const otherEvents = events.filter(
				e => e.id !== effectiveSelectedEvent.id,
			);

			// First, try to find events with the same subject
			let options = otherEvents.filter(
				e => e.subject === selectedSubject,
			);

			// If we don't have enough, add events from similar time periods
			if (options.length < 2) {
				const timeRelatedEvents = otherEvents
					.filter(e => e.subject !== selectedSubject) // Exclude events we already have
					.sort((a, b) => {
						return (
							Math.abs(a.year - selectedYear) -
							Math.abs(b.year - selectedYear)
						);
					})
					.slice(0, 2 - options.length);

				options = [...options, ...timeRelatedEvents];
			}

			// If we still don't have 2 options, just use the first 2 other events
			if (options.length < 2 && otherEvents.length > 0) {
				const remainingNeeded = 2 - options.length;
				const additionalEvents = otherEvents
					.filter(e => !options.includes(e))
					.slice(0, remainingNeeded);
				options = [...options, ...additionalEvents];
			}

			return options.slice(0, 2);
		};

		// Find related events when the selected event changes
		if (effectiveSelectedEvent) {
			// Clear related options first
			setRelatedOptions([]);

			// Then find new related events
			const related = findRelatedEvents();
			setRelatedOptions(related);
		}
	}, [effectiveSelectedEvent, events]);

	// Reset selected event when events change significantly
	useEffect(() => {
		if (events.length === 0) {
			setLocalSelectedEvent(null);
		}
	}, [events]);

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
					<div className="flex-grow overflow-y-auto max-h-[calc(60vh-10rem)]">
						{/* Chosen Events Section */}
						{chosenEvents.length > 0 && (
							<>
								<h3 className="text-sm font-bold text-stone-700 dark:text-amber-400 px-4 pt-2 flex items-center">
									<span className="mr-2">📚</span>
									Chosen Events:
								</h3>
								<ul className="list-none p-3">
									{chosenEvents.map((event, index) => (
										<li
											key={`${event.id}-chosen-${index}`}
											onClick={() => {
												setLocalSelectedEvent(event);
												onSelectEvent(event);
											}}
											className={`cursor-pointer p-2 mb-2 bg-green-50 dark:bg-green-900/30 border-b border-amber-700 border-opacity-30 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors rounded ${
												effectiveSelectedEvent?.id ===
												event.id
													? 'bg-amber-100 dark:bg-amber-900 font-semibold'
													: ''
											}`}
											role="button"
											tabIndex={0}
										>
											<div className="flex justify-between items-center">
												<span className="text-stone-800 dark:text-amber-100">
													{event.title}
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
								<div className="border-t border-amber-700/30 my-2"></div>
							</>
						)}

						{/* Search Results/Available Events Section */}
						<h3 className="text-sm font-bold text-stone-700 dark:text-amber-400 px-4 pt-2 flex items-center">
							<span className="mr-2">🔍</span>
							Available Events:
						</h3>
						<ul className="list-none p-3">
							{/* Filter out events that are already in chosen events list */}
							{events
								.filter(
									event =>
										!chosenEvents.some(
											chosen => chosen.id === event.id,
										),
								)
								.map((event, index) => (
									<li
										key={`${event.id}-option-${index}`}
										onClick={() => {
											setLocalSelectedEvent(event);
											onSelectEvent(event);
										}}
										className={`cursor-pointer p-2 mb-2 border-b border-amber-700 border-opacity-30 hover:bg-amber-100 dark:hover:bg-amber-900 dark:hover:bg-opacity-30 transition-colors ${
											effectiveSelectedEvent?.id ===
											event.id
												? 'bg-amber-100 dark:bg-amber-900 font-semibold'
												: ''
										}`}
										role="button"
										tabIndex={0}
									>
										<div className="flex justify-between items-center">
											<span className="text-stone-800 dark:text-amber-100">
												{event.title}
												{effectiveSelectedEvent?.id ===
													event.id && (
													<span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
														(Selected)
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
