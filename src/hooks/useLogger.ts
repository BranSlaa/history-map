import { useEffect, useRef } from 'react';
import { Event } from '@/types/event';

// Helper to conditionally log only in development mode
const devLog = (...args: any[]): void => {
	if (process.env.NODE_ENV === 'development') {
		console.log(...args);
	}
};

export const useLogger = (
	mountId: React.MutableRefObject<string>,
	showWelcomeBack: boolean,
	lastEvent: Event | null,
	loading: boolean,
	currentEvents: Event[],
	events: Event[]
) => {
	const renderCountRef = useRef(0);
	const isFirstMount = useRef(true);
	const prevEventsLengthRef = useRef(events.length);
	
	// Component lifecycle logger - only run in development
	useEffect(() => {
		devLog(
			`[${mountId.current}] App component mounted at ${new Date().toLocaleTimeString()}`,
		);

		return () => {
			devLog(
				`[${mountId.current}] App component unmounted at ${new Date().toLocaleTimeString()}`,
			);
		};
	}, [mountId]);

	// Only log initial state once
	useEffect(() => {
		if (isFirstMount.current) {
			devLog(
				`[${mountId.current}] Initial state - showWelcomeBack: ${showWelcomeBack}, hasLastEvent: ${!!lastEvent}`,
			);
		}
	}, []); 

	// Consolidated logging for important state changes
	useEffect(() => {
		// Only log if lastEvent title changed
		if (lastEvent) {
			devLog(`[${mountId.current}] lastEvent changed:`, lastEvent.title);
		}
	}, [lastEvent?.title, mountId]);

	// Reduced and throttled render logging
	useEffect(() => {
		// Increment render count
		renderCountRef.current += 1;
		
		// But only log on significant state changes
		const shouldLog = 
			renderCountRef.current <= 3 || // Always log the first few renders
			prevEventsLengthRef.current !== events.length; // Log when events change
			
		if (shouldLog) {
			devLog(`[${mountId.current}] Render #${renderCountRef.current}:`, {
				showWelcomeBack,
				hasLastEvent: !!lastEvent,
				lastEventTitle: lastEvent?.title,
				isLoading: loading,
				eventsCount: currentEvents.length,
			});
		}
		
		// Update prev length ref
		prevEventsLengthRef.current = events.length;
	}, [showWelcomeBack, lastEvent, loading, currentEvents.length, mountId, events.length]);

	// Simplified events logging
	useEffect(() => {
		// Only log if events length actually changed
		if (events.length !== prevEventsLengthRef.current) {
			devLog('Main events array updated, length:', events.length);
			
			// Only log detailed info if there are events and we're in development
			if (events.length > 0 && process.env.NODE_ENV === 'development') {
				// Count subjects without logging the details
				const subjectsCount = events.filter(e => e.subject).length;
				devLog('Events with subjects:', subjectsCount);
			}
			
			prevEventsLengthRef.current = events.length;
		}
	}, [events]);

	return { isFirstMount };
}; 