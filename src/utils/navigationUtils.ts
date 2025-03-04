import { Event } from '@/types/event';

export const handleContinueExploration = (
	lastEvent: Event | null,
	currentEvents: Event[],
	setCurrentEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	setSelectedEvent: React.Dispatch<React.SetStateAction<Event | null>>,
	setChosenEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	setShowWelcomeBack: React.Dispatch<React.SetStateAction<boolean>>,
	fetchEventsCallback: (
		topic: string,
		title: string,
		year?: number,
		onEventsFetched?: (newEvents: Event[]) => void,
		isAdditionalEvent?: boolean,
	) => void,
	addEventToList: (event: Event, events: Event[]) => Event[],
) => {
	if (lastEvent) {
		console.log('Continuing exploration with event:', lastEvent.title);

		// If we don't have any current events, set the last event as the current event
		if (currentEvents.length === 0) {
			console.log('Setting last event as current event');
			setCurrentEvents([lastEvent]);
		}

		// Set the selected event
		setSelectedEvent(lastEvent);

		// Add to chosen events using our utility
		setChosenEvents(prev => addEventToList(lastEvent, prev));

		// Fetch one additional new event related to the last event
		// Important: Set isAdditionalEvent to true
		fetchEventsCallback(
			`related to ${lastEvent.title}`,
			lastEvent.title,
			lastEvent.year,
			newEvents => {
				console.log(
					`Found ${newEvents.length} additional events to display with ${lastEvent.title}`,
				);
				if (newEvents.length === 0) {
					// If no related events found, try a more general search
					console.log(
						'No related events found, trying a more general search',
					);
					fetchEventsCallback(
						lastEvent.subject,
						'',
						undefined,
						generalEvents => {
							console.log(
								`Found ${generalEvents.length} general events for subject ${lastEvent.subject}`,
							);
						},
						true,
					);
				}
			},
			true, // This is an additional event fetch
		);
	} else {
		console.warn('Cannot continue: No last event available');
	}

	// Hide the welcome back dialog
	setShowWelcomeBack(false);
};

export const handleNewSearch = (
	setCurrentEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	setChosenEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	setUnchosenEvents: React.Dispatch<React.SetStateAction<Event[]>>,
	setSelectedEvent: React.Dispatch<React.SetStateAction<Event | null>>,
	setShowWelcomeBack: React.Dispatch<React.SetStateAction<boolean>>,
) => {
	// Reset everything
	setCurrentEvents([]);
	setChosenEvents([]);
	setUnchosenEvents([]);
	setSelectedEvent(null);

	// Hide the welcome back dialog
	setShowWelcomeBack(false);
}; 