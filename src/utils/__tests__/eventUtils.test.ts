import { markInteractedEvents, addEventToList, shouldShowWelcomeBack } from '../eventUtils';
import { Event } from '@/types/event';

describe('eventUtils', () => {
    describe('markInteractedEvents', () => {
        const mockEvents: Event[] = [
            {
                id: '1',
                title: 'Event 1',
                year: 2024,
                lat: 0,
                lon: 0,
                subject: 'History',
                info: 'Test info'
            },
            {
                id: '2',
                title: 'Event 2',
                year: 2024,
                lat: 0,
                lon: 0,
                subject: 'History',
                info: 'Test info'
            }
        ];

        it('should mark events as interacted correctly', () => {
            const interactedEventIds = new Set(['1']);
            const result = markInteractedEvents(mockEvents, interactedEventIds);
            
            expect(result[0]).toEqual({ ...mockEvents[0], interacted: true });
            expect(result[1]).toEqual({ ...mockEvents[1], interacted: false });
        });

        it('should return original events if no interacted IDs', () => {
            const result = markInteractedEvents(mockEvents, new Set());
            expect(result).toEqual(mockEvents);
        });

        it('should handle empty events array', () => {
            const result = markInteractedEvents([], new Set(['1']));
            expect(result).toEqual([]);
        });
    });

    describe('addEventToList', () => {
        const existingEvents: Event[] = [
            {
                id: '1',
                title: 'Event 1',
                year: 2024,
                lat: 0,
                lon: 0,
                subject: 'History',
                info: 'Test info'
            }
        ];

        it('should add a new event to the list', () => {
            const newEvent: Event = {
                id: '2',
                title: 'Event 2',
                year: 2024,
                lat: 0,
                lon: 0,
                subject: 'History',
                info: 'Test info'
            };

            const result = addEventToList(newEvent, existingEvents);
            expect(result).toHaveLength(2);
            expect(result).toContainEqual(newEvent);
        });

        it('should not add duplicate events', () => {
            const duplicateEvent = { ...existingEvents[0] };
            const result = addEventToList(duplicateEvent, existingEvents);
            expect(result).toHaveLength(1);
            expect(result).toEqual(existingEvents);
        });
    });

    describe('shouldShowWelcomeBack', () => {
        const currentEvents: Event[] = [
            {
                id: '1',
                title: 'Event 1',
                year: 2024,
                lat: 0,
                lon: 0,
                subject: 'History',
                info: 'Test info'
            }
        ];

        it('should return false when no last event exists', () => {
            const result = shouldShowWelcomeBack(null, currentEvents, true);
            expect(result).toBe(false);
        });

        it('should return false when welcome back flag is false', () => {
            const lastEvent = { ...currentEvents[0] };
            const result = shouldShowWelcomeBack(lastEvent, currentEvents, false);
            expect(result).toBe(false);
        });

        it('should return true when conditions are met', () => {
            const lastEvent = { ...currentEvents[0] };
            const result = shouldShowWelcomeBack(lastEvent, currentEvents, true);
            expect(result).toBe(true);
        });
    });
}); 