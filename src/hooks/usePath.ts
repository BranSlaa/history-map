import { useState, useEffect, useCallback } from 'react';
import { Path, PathEvent } from '@/types/path';
import { useRouter } from 'next/navigation';
import { getToken } from '@/utils/authUtils';

interface UsePathOptions {
	userId: string;
	maxEvents?: number;
}

interface UsePathReturn {
	currentPath: Path | null;
	loading: boolean;
	error: Error | null;
	createPath: (searchTerm: string, title?: string) => Promise<Path | null>;
	addEventToPath: (eventId: string, eventTitle: string) => Promise<boolean>;
	completePath: () => Promise<boolean>;
	abandonPath: () => Promise<boolean>;
}

export function usePath({
	userId,
	maxEvents = 10,
}: UsePathOptions): UsePathReturn {
	const [currentPath, setCurrentPath] = useState<Path | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<Error | null>(null);
	const router = useRouter();

	// Fetch the user's active path
	const fetchActivePath = useCallback(async () => {
		if (!userId) return;

		try {
			setLoading(true);

			const response = await fetch(
				`/api/user-paths/active?userId=${userId}`,
				{
					headers: {
						Authorization: `Bearer ${getToken()}`,
					},
				},
			);

			if (!response.ok) {
				if (response.status === 404) {
					// No active path found, this is normal
					setCurrentPath(null);
					return;
				}
				throw new Error(
					`Error fetching active path: ${response.statusText}`,
				);
			}

			const data = await response.json();
			setCurrentPath(data);
		} catch (error) {
			console.error('Error fetching active path:', error);
			setError(error instanceof Error ? error : new Error(String(error)));
		} finally {
			setLoading(false);
		}
	}, [userId]);

	// Create a new path
	const createPath = async (
		searchTerm: string,
		title?: string,
	): Promise<Path | null> => {
		if (!userId) return null;

		try {
			setLoading(true);

			const pathTitle = title || `Path: ${searchTerm}`;

			const response = await fetch('/api/user-paths', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${getToken()}`,
				},
				body: JSON.stringify({
					search_term: searchTerm,
					name: pathTitle,
				}),
			});

			if (!response.ok) {
				throw new Error(
					`Failed to create path: ${response.statusText}`,
				);
			}

			const newPath = await response.json();
			setCurrentPath(newPath);
			return newPath;
		} catch (error) {
			console.error('Error creating path:', error);
			setError(error instanceof Error ? error : new Error(String(error)));
			return null;
		} finally {
			setLoading(false);
		}
	};

	// Add an event to the current path
	const addEventToPath = async (
		eventId: string,
		eventTitle: string,
	): Promise<boolean> => {
		if (!userId || !currentPath) return false;

		try {
			setLoading(true);

			const response = await fetch(
				`/api/user-paths/${currentPath.id}/events`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${getToken()}`,
					},
					body: JSON.stringify({
						event_id: eventId,
						title: eventTitle,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(
					`Failed to add event to path: ${response.statusText}`,
				);
			}

			// Refresh the path to get updated events
			await fetchActivePath();
			return true;
		} catch (error) {
			console.error('Error adding event to path:', error);
			setError(error instanceof Error ? error : new Error(String(error)));
			return false;
		} finally {
			setLoading(false);
		}
	};

	// Complete the current path
	const completePath = async (): Promise<boolean> => {
		if (!userId || !currentPath) return false;

		try {
			setLoading(true);

			const response = await fetch(
				`/api/user-paths/${currentPath.id}/complete`,
				{
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${getToken()}`,
					},
				},
			);

			if (!response.ok) {
				throw new Error(
					`Failed to complete path: ${response.statusText}`,
				);
			}

			setCurrentPath(null);
			router.push('/profile'); // Redirect to profile page after completion
			return true;
		} catch (error) {
			console.error('Error completing path:', error);
			setError(error instanceof Error ? error : new Error(String(error)));
			return false;
		} finally {
			setLoading(false);
		}
	};

	// Abandon the current path
	const abandonPath = async (): Promise<boolean> => {
		if (!userId || !currentPath) return false;

		try {
			setLoading(true);

			const response = await fetch(`/api/user-paths/${currentPath.id}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${getToken()}`,
				},
			});

			if (!response.ok) {
				throw new Error(
					`Failed to abandon path: ${response.statusText}`,
				);
			}

			setCurrentPath(null);
			return true;
		} catch (error) {
			console.error('Error abandoning path:', error);
			setError(error instanceof Error ? error : new Error(String(error)));
			return false;
		} finally {
			setLoading(false);
		}
	};

	// Initial fetch of active path
	useEffect(() => {
		fetchActivePath();
	}, [fetchActivePath, userId]);

	return {
		currentPath,
		loading,
		error,
		createPath,
		addEventToPath,
		completePath,
		abandonPath,
	};
}
