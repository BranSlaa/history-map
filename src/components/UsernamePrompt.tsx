'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { generateUsername } from '@/utils/usernameGenerator';

export default function UsernamePrompt(): React.ReactElement | null {
	const { user, profile, updateProfile } = useAuth();
	const [username, setUsername] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Don't show the prompt if we have no user or if the user already has a username
	if (
		!user ||
		!profile ||
		(profile.username && profile.username.trim() !== '')
	) {
		return null;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			if (!username || username.trim() === '') {
				throw new Error('Username cannot be empty');
			}

			await updateProfile({
				username: username.trim(),
			});

			// Success - the component will not render on next cycle since username is set
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Failed to update username. Please try again.',
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleRandomUsername = () => {
		setUsername(generateUsername());
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
			<div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full">
				<h2 className="text-2xl font-bold mb-4 dark:text-white">
					Choose a Username
				</h2>
				<p className="mb-6 dark:text-gray-300">
					Welcome! Please choose a username to continue.
				</p>

				{error && (
					<div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
						{error}
					</div>
				)}

				<form onSubmit={handleSubmit}>
					<div className="mb-4">
						<label
							htmlFor="username"
							className="block text-sm font-medium mb-2 dark:text-gray-300"
						>
							Username
						</label>
						<input
							type="text"
							id="username"
							className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
							value={username}
							onChange={e => setUsername(e.target.value)}
							placeholder="Enter a username"
							disabled={isSubmitting}
						/>
					</div>

					<div className="flex flex-col sm:flex-row gap-3">
						<button
							type="button"
							onClick={handleRandomUsername}
							className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors dark:text-white"
							disabled={isSubmitting}
						>
							Generate Random
						</button>
						<button
							type="submit"
							className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
							disabled={isSubmitting}
						>
							{isSubmitting ? 'Saving...' : 'Save Username'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
