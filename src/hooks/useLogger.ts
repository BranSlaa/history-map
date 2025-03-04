import { useEffect, useRef } from 'react';
import { Event } from '@/types/event';

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

	// Component lifecycle logger
	useEffect(() => {
		console.log(
			`[${mountId.current}] App component mounted at ${new Date().toLocaleTimeString()}`,
		);

		return () => {
			console.log(
				`[${mountId.current}] App component unmounted at ${new Date().toLocaleTimeString()}`,
			);
		};
	}, [mountId]);

	// Add a new useEffect to run once on component mount to log initial state
	useEffect(() => {
		console.log(
			`[${mountId.current}] Initial state - showWelcomeBack: ${showWelcomeBack}, hasLastEvent: ${!!lastEvent}`,
		);
	}, []); // Empty dependency array ensures it runs only once on mount

	// Add a useEffect to log when the component renders
	useEffect(() => {
		console.log('App component mounted - initial state:');
		console.log('showWelcomeBack:', showWelcomeBack);
		console.log('lastEvent:', lastEvent?.title);
	}, [lastEvent?.title, showWelcomeBack]);

	// Add a dedicated useEffect for lastEvent changes
	useEffect(() => {
		// Debounce log output to reduce noise
		const logTimeout = setTimeout(() => {
			console.log(
				`[${mountId.current}] lastEvent changed:`,
				lastEvent?.title,
			);
		}, 50);

		return () => clearTimeout(logTimeout);
	}, [lastEvent, mountId]);

	// Fix the debounced render log effect
	useEffect(() => {
		renderCountRef.current += 1;

		const logTimeout = setTimeout(() => {
			console.log(
				`[${mountId.current}] Render #${renderCountRef.current}:`,
				{
					showWelcomeBack,
					hasLastEvent: !!lastEvent,
					lastEventTitle: lastEvent?.title,
					isLoading: loading,
					eventsCount: currentEvents.length,
				},
			);
		}, 100);

		return () => clearTimeout(logTimeout);
	}, [showWelcomeBack, lastEvent, loading, currentEvents.length, mountId]);

	// Add this useEffect to debug the events
	useEffect(() => {
		console.log('Main events array updated, length:', events.length);
		if (events.length > 0) {
			console.log('Sample event:', events[0]);
			console.log(
				'Events with subjects:',
				events.filter(e => e.subject).length,
			);
			console.log(
				'Unique subjects:',
				Array.from(
					new Set(events.filter(e => e.subject).map(e => e.subject)),
				),
			);
		}
	}, [events]);

	return { isFirstMount };
}; 