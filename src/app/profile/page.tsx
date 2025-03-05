'use client';

import React, { useState, useEffect } from 'react';
import { SubscriptionTier } from '@/types/user';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import supabase from '@/lib/supabaseClient';
import { Header } from '../components/Header';
import Image from 'next/image';
import Link from 'next/link';

const Profile: React.FC = () => {
	const { user, profile, loading, error, signOut, updateProfile } = useAuth();
	const router = useRouter();
	const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(
		profile?.subscription_tier || null,
	);
	const [username, setUsername] = useState<string>(profile?.username || '');
	const [fullName, setFullName] = useState<string>(
		profile?.full_name || user?.full_name || '',
	);
	const [avatarUrl, setAvatarUrl] = useState<string>(
		profile?.avatar_url || user?.avatar_url || '',
	);
	const [website, setWebsite] = useState<string>(profile?.website || '');
	const [stats, setStats] = useState({
		totalQuizzes: 0,
		averageScore: 0,
		eventsExplored: 0,
		connectionsCreated: 0,
	});
	const [subscription, setSubscription] = useState<any>(null);

	// Update form values when profile or user changes
	useEffect(() => {
		if (profile) {
			setUsername(profile.username || '');
			setFullName(profile.full_name || '');
			setAvatarUrl(profile.avatar_url || '');
			setWebsite(profile.website || '');
			setSelectedTier(profile.subscription_tier);
		} else if (user) {
			setFullName(user.full_name || '');
			setAvatarUrl(user.avatar_url || '');
		}
	}, [profile, user]);

	useEffect(() => {
		const fetchUserStats = async () => {
			if (!user && !profile) return;

			const userId = user?.id || profile?.id;
			if (!userId) return;

			try {
				console.log('Fetching stats for user:', userId);

				let quizError = null;
				let quizAttempts: { score: number }[] = [];
				let eventError = null;
				let eventInteractions: { event_id: string }[] = [];
				let connError = null;
				let connections: { id: string | number }[] = [];

				try {
					// Fetch subscription data if the table exists
					const { data: subscriptionData, error: subError } =
						await supabase
							.from('subscriptions')
							.select('*, price:prices(*, product:products(*))')
							.eq('user_id', userId)
							.order('created', { ascending: false })
							.limit(1)
							.single();

					if (subscriptionData) {
						console.log('Subscription found:', subscriptionData);
						setSubscription(subscriptionData);
					}
				} catch (subErr) {
					console.log(
						'Subscription table may not exist yet:',
						subErr,
					);
					// Silently handle this error as the table might not exist
				}

				try {
					// Fetch quiz attempts if the table exists
					const quizResult = await supabase
						.from('quiz_attempts')
						.select('score')
						.eq('user_id', userId);

					quizAttempts = quizResult.data || [];
					quizError = quizResult.error;
				} catch (err) {
					console.log('Quiz attempts table may not exist yet:', err);
					// Table likely doesn't exist, set empty results
					quizAttempts = [];
				}

				try {
					// Fetch event interactions
					const eventResult = await supabase
						.from('user_event_interactions')
						.select('event_id')
						.eq('user_id', userId);

					eventInteractions = eventResult.data || [];
					eventError = eventResult.error;
				} catch (err) {
					console.log('Event interactions error:', err);
					eventInteractions = [];
				}

				try {
					// Fetch event connections
					const connResult = await supabase
						.from('event_connections')
						.select('id')
						.eq('user_id', userId);

					connections = connResult.data || [];
					connError = connResult.error;
				} catch (err) {
					console.log('Event connections error:', err);
					connections = [];
				}

				// Log non-404 errors
				if (
					(quizError && quizError.code !== '404') ||
					(eventError && eventError.code !== '404') ||
					(connError && connError.code !== '404')
				) {
					console.error('Error fetching stats:', {
						quizError,
						eventError,
						connError,
					});
				}

				const totalQuizzes = quizAttempts?.length || 0;
				const averageScore =
					totalQuizzes > 0
						? quizAttempts.reduce(
								(acc, curr) => acc + curr.score,
								0,
							) / totalQuizzes
						: 0;
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
	}, [user, profile]);

	const handleAvatarUpload = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		try {
			if (!event.target.files || event.target.files.length === 0) {
				return;
			}

			const userId = user?.id || profile?.id;
			if (!userId) return;

			const file = event.target.files[0];
			const fileExt = file.name.split('.').pop();
			const fileName = `${userId}.${fileExt}`;
			const filePath = `${fileName}`;

			// Upload to storage
			const { error: uploadError } = await supabase.storage
				.from('avatars')
				.upload(filePath, file, { upsert: true });

			if (uploadError) throw uploadError;

			// Get public URL
			const { data } = supabase.storage
				.from('avatars')
				.getPublicUrl(filePath);

			// Update profile
			await updateProfile({
				avatar_url: data.publicUrl,
			});

			setAvatarUrl(data.publicUrl);
		} catch (error) {
			console.error('Error uploading avatar:', error);
		}
	};

	const handleTierChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		setSelectedTier(parseInt(event.target.value) as SubscriptionTier);
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		try {
			if (!profile) return;

			await updateProfile({
				username,
				full_name: fullName,
				website,
				subscription_tier: selectedTier || SubscriptionTier.STUDENT,
			});

			alert('Profile updated successfully!');
		} catch (error) {
			console.error('Error updating profile:', error);
			alert('Failed to update profile.');
		}
	};

	if (loading) {
		return (
			<div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
				<div className="text-lg">Loading your profile...</div>
			</div>
		);
	}

	if (!user && !profile) {
		return (
			<div className="container mx-auto p-6">
				<Header />
				<div className="max-w-4xl mx-auto mt-10 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
					<h1 className="text-3xl font-bold mb-6">
						Welcome to History Map
					</h1>
					<div className="bg-amber-50 dark:bg-amber-900/30 p-4 rounded-md mb-6">
						<p className="mb-4">
							You're not currently logged in. Sign in to access
							your profile, track your progress, and unlock
							personalized features.
						</p>
						<button
							onClick={() => router.push('/login')}
							className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md"
						>
							Sign In
						</button>
					</div>
					<div className="mt-8">
						<h2 className="text-xl font-semibold mb-4">
							What you can do with a profile:
						</h2>
						<ul className="list-disc pl-6 space-y-2">
							<li>Track your history learning progress</li>
							<li>
								Save favorite historical events and create
								connections
							</li>
							<li>
								Take quizzes and compare your score with others
							</li>
							<li>Customize your learning experience</li>
						</ul>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto p-6">
			<Header />
			<div className="max-w-4xl mx-auto">
				<div className="flex justify-between items-center mb-6">
					<h1 className="text-3xl font-bold">User Profile</h1>
				</div>

				{error && <div className="text-red-500 mb-4">{error}</div>}

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* User Info Card */}
					<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
						<h2 className="text-xl font-semibold mb-4">
							User Information
						</h2>

						{/* Avatar Upload */}
						<div className="flex items-center mb-6 space-x-4">
							<div className="relative w-20 h-20 overflow-hidden rounded-full bg-gray-100">
								{avatarUrl ? (
									<Image
										src={avatarUrl}
										alt="Avatar"
										width={80}
										height={80}
										className="object-cover"
									/>
								) : (
									<div className="flex items-center justify-center h-full text-gray-400">
										No Image
									</div>
								)}
							</div>
							<label className="cursor-pointer bg-accent hover:bg-accent-dark text-white font-bold py-2 px-4 rounded">
								Upload Avatar
								<input
									type="file"
									accept="image/*"
									onChange={handleAvatarUpload}
									className="hidden"
								/>
							</label>
						</div>

						<form onSubmit={handleSubmit} className="space-y-4">
							<div>
								<label
									htmlFor="username"
									className="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>
									Username
								</label>
								<input
									id="username"
									type="text"
									value={username}
									onChange={e => setUsername(e.target.value)}
									className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent dark:bg-gray-700 dark:border-gray-600"
									minLength={3}
									required
								/>
							</div>

							<div>
								<label
									htmlFor="fullName"
									className="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>
									Full Name
								</label>
								<input
									id="fullName"
									type="text"
									value={fullName}
									onChange={e => setFullName(e.target.value)}
									className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent dark:bg-gray-700 dark:border-gray-600"
								/>
							</div>

							<div>
								<label
									htmlFor="website"
									className="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>
									Website
								</label>
								<input
									id="website"
									type="url"
									value={website}
									onChange={e => setWebsite(e.target.value)}
									className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent dark:bg-gray-700 dark:border-gray-600"
								/>
							</div>

							<div>
								<label
									htmlFor="tier"
									className="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>
									Subscription Tier
								</label>
								<select
									id="tier"
									value={selectedTier || undefined}
									onChange={handleTierChange}
									className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent dark:bg-gray-700 dark:border-gray-600"
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

							{subscription && (
								<div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-md">
									<h3 className="font-semibold text-blue-800 dark:text-blue-200">
										Active Subscription
									</h3>
									<p className="text-sm text-blue-700 dark:text-blue-300">
										{subscription.price?.product?.name} -{' '}
										{subscription.status}
									</p>
									<p className="text-xs text-blue-600 dark:text-blue-400">
										Renews on{' '}
										{new Date(
											subscription.current_period_end,
										).toLocaleDateString()}
									</p>
								</div>
							)}

							<button
								type="submit"
								className="w-full bg-accent hover:bg-accent-dark text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
							>
								Update Profile
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
						<div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
							<Link
								href="/profile/quizzes"
								className="text-blue-500 hover:text-blue-600 flex items-center"
							>
								<span>View All Quizzes</span>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-4 w-4 ml-1"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 5l7 7-7 7"
									/>
								</svg>
							</Link>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Profile;
