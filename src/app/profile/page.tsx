'use client';

import React, { useState, useEffect } from 'react';
import { SubscriptionTier } from '@/types/user';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import supabase from '@/lib/supabaseClient';
import { Header } from '../components/Header';

const Profile: React.FC = () => {
	const { user, loading, error, signOut, updateTier } = useAuth();
	const router = useRouter();
	const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(
		user?.subscription_tier || null,
	);
	const [stats, setStats] = useState({
		totalQuizzes: 0,
		averageScore: 0,
		eventsExplored: 0,
		connectionsCreated: 0,
	});

	useEffect(() => {
		const fetchUserStats = async () => {
			if (!user) return;

			try {
				// Fetch quiz attempts
				const { data: quizAttempts, error: quizError } = await supabase
					.from('quiz_attempts')
					.select('score')
					.eq('user_id', user.id);

				// Fetch event interactions
				const { data: eventInteractions, error: eventError } =
					await supabase
						.from('user_event_interactions')
						.select('event_id')
						.eq('user_id', user.id);

				// Fetch event connections
				const { data: connections, error: connError } = await supabase
					.from('event_connections')
					.select('id')
					.eq('user_id', user.id);

				if (quizError || eventError || connError) {
					console.error('Error fetching stats:', {
						quizError,
						eventError,
						connError,
					});
					return;
				}

				const totalQuizzes = quizAttempts?.length || 0;
				const averageScore =
					quizAttempts?.reduce((acc, curr) => acc + curr.score, 0) /
						totalQuizzes || 0;
				const eventsExplored =
					new Set(eventInteractions?.map(ei => ei.event_id)).size ||
					0;
				const connectionsCreated = connections?.length || 0;

				setStats({
					totalQuizzes,
					averageScore,
					eventsExplored,
					connectionsCreated,
				});
			} catch (err) {
				console.error('Error fetching user stats:', err);
			}
		};

		fetchUserStats();
	}, [user]);

	const handleTierChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		setSelectedTier(event.target.value as unknown as SubscriptionTier);
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (selectedTier) {
			await updateTier(selectedTier);
		}
	};

	const handleSignOut = async () => {
		await supabase.auth.signOut();
		router.push('/login');
	};

	if (loading) {
		return (
			<div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
				<div className="text-lg">Loading your profile...</div>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
				<div className="text-lg">Redirecting to login...</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto p-6">
			<Header />
			<div className="max-w-4xl mx-auto">
				<div className="flex justify-between items-center mb-6">
					<h1 className="text-3xl font-bold">User Profile</h1>
					<button
						onClick={handleSignOut}
						className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md"
					>
						Sign Out
					</button>
				</div>

				{error && <div className="text-red-500 mb-4">{error}</div>}

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* User Info Card */}
					<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
						<h2 className="text-xl font-semibold mb-4">
							User Information
						</h2>
						<div className="space-y-3">
							<p className="text-lg">
								<strong>Username:</strong> {user.username}
							</p>
							<p className="text-lg">
								<strong>Email:</strong> {user.email}
							</p>
							<p className="text-lg">
								<strong>Member Since:</strong>{' '}
								{new Date(
									user.created_at || '',
								).toLocaleDateString()}
							</p>
							<p className="text-lg">
								<strong>Current Subscription:</strong>{' '}
								{SubscriptionTier[user.subscription_tier]}
							</p>
						</div>

						<form onSubmit={handleSubmit} className="mt-6">
							<div className="mb-4">
								<label
									htmlFor="tier"
									className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
								>
									Change Subscription Tier
								</label>
								<select
									id="tier"
									value={selectedTier || undefined}
									onChange={handleTierChange}
									className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent dark:bg-gray-700 dark:border-gray-600"
								>
									<option value={SubscriptionTier.STUDENT}>
										Student
									</option>
									<option value={SubscriptionTier.SCHOLAR}>
										Scholar
									</option>
									<option value={SubscriptionTier.HISTORIAN}>
										Historian
									</option>
								</select>
							</div>
							<button
								type="submit"
								className="w-full bg-accent hover:bg-accent-dark text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
							>
								Update Subscription
							</button>
						</form>
					</div>

					{/* Stats Card */}
					<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
						<h2 className="text-xl font-semibold mb-4">
							Your Statistics
						</h2>
						<div className="grid grid-cols-2 gap-4">
							<div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
								<p className="text-sm text-gray-600 dark:text-gray-400">
									Quizzes Taken
								</p>
								<p className="text-2xl font-bold">
									{stats.totalQuizzes}
								</p>
							</div>
							<div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
								<p className="text-sm text-gray-600 dark:text-gray-400">
									Average Score
								</p>
								<p className="text-2xl font-bold">
									{stats.averageScore.toFixed(1)}%
								</p>
							</div>
							<div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
								<p className="text-sm text-gray-600 dark:text-gray-400">
									Events Explored
								</p>
								<p className="text-2xl font-bold">
									{stats.eventsExplored}
								</p>
							</div>
							<div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
								<p className="text-sm text-gray-600 dark:text-gray-400">
									Connections Made
								</p>
								<p className="text-2xl font-bold">
									{stats.connectionsCreated}
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Profile;
