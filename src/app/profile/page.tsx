'use client';

import React, { useState, useEffect } from 'react';
import { SubscriptionTier } from '@/types/user';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import supabase from '@/lib/supabaseClient';
import { Header } from '@/app/components/Header';
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
		pathsCreated: 0,
	});
	const [subscription, setSubscription] = useState<any>(null);
	const [isUpdating, setIsUpdating] = useState(false);

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

				// Fetch historical paths
				let pathsCreated = 0;
				try {
					const pathResult = await supabase
						.from('historical_paths')
						.select('count')
						.eq('user_id', userId)
						.single();

					pathsCreated = pathResult.data?.count || 0;

					// If count returns null (single row with count), try fetching all paths and counting them
					if (pathsCreated === 0) {
						const allPathsResult = await supabase
							.from('historical_paths')
							.select('id')
							.eq('user_id', userId);

						pathsCreated = allPathsResult.data?.length || 0;
					}
				} catch (err) {
					console.log('Historical paths error:', err);
					// Table might not exist yet
					pathsCreated = 0;
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
					pathsCreated,
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
			<div className="col-span-12 flex items-center justify-center">
				<div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-amber-500"></div>
			</div>
		);
	}

	return (
		<div className="px-4 py-6">
			<h1 className="text-3xl font-bold mb-6 text-white text-center">
				User Profile
			</h1>

			{/* Main content */}
			<div className="col-span-12 px-4 pb-8">
				<div className="grid grid-cols-12 gap-4 max-w-7xl mx-auto">
					{/* User Info Card */}
					<div className="col-span-12 lg:col-span-4">
						<div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
							<h2 className="text-xl font-semibold mb-4 text-amber-500">
								User Information
							</h2>

							{/* Avatar Upload */}
							<div className="flex items-center mb-6 space-x-4">
								<div className="relative w-20 h-20 overflow-hidden rounded-full bg-gray-700">
									{avatarUrl ? (
										<Image
											src={avatarUrl}
											alt="User avatar"
											fill
											className="object-cover"
										/>
									) : (
										<div className="flex items-center justify-center h-full text-2xl text-amber-500">
											{profile?.username
												?.charAt(0)
												.toUpperCase() ||
												(user?.email &&
													user.email
														.charAt(0)
														.toUpperCase()) ||
												'?'}
										</div>
									)}
								</div>
								<div>
									<label
										htmlFor="avatar-upload"
										className="bg-amber-600 hover:bg-amber-700 text-white text-sm py-2 px-4 rounded cursor-pointer"
									>
										Change Avatar
										<input
											id="avatar-upload"
											type="file"
											accept="image/*"
											onChange={handleAvatarUpload}
											className="hidden"
										/>
									</label>
								</div>
							</div>

							{/* User Details Form */}
							<form onSubmit={handleSubmit} className="space-y-4">
								<div>
									<label
										htmlFor="username"
										className="block text-sm font-medium mb-1 text-gray-300"
									>
										Username
									</label>
									<input
										type="text"
										id="username"
										value={username}
										onChange={e =>
											setUsername(e.target.value)
										}
										className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
									/>
								</div>

								<div>
									<label
										htmlFor="email"
										className="block text-sm font-medium mb-1 text-gray-300"
									>
										Email
									</label>
									<input
										type="email"
										id="email"
										value={user?.email || ''}
										disabled
										className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white cursor-not-allowed opacity-70"
									/>
								</div>

								<div>
									<label
										htmlFor="tier"
										className="block text-sm font-medium mb-1 text-gray-300"
									>
										Account Tier
									</label>
									<select
										id="tier"
										value={selectedTier || ''}
										onChange={handleTierChange}
										className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
									>
										<option
											value={SubscriptionTier.STUDENT}
										>
											Student
										</option>
										<option
											value={SubscriptionTier.SCHOLAR}
										>
											Scholar
										</option>
										<option
											value={SubscriptionTier.HISTORIAN}
										>
											Historian
										</option>
									</select>
								</div>

								<button
									type="submit"
									className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded"
									disabled={isUpdating}
								>
									{isUpdating
										? 'Updating...'
										: 'Update Profile'}
								</button>
							</form>
						</div>
					</div>

					{/* User Stats Card */}
					<div className="col-span-12 lg:col-span-8">
						<div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
							<h2 className="text-xl font-semibold mb-4 text-amber-500">
								Learning Statistics
							</h2>

							{stats ? (
								<div className="space-y-6">
									<div className="grid grid-cols-2 gap-4">
										<div className="p-4 bg-gray-700 rounded-lg">
											<p className="text-sm text-gray-300">
												Historical Events Explored
											</p>
											<p className="text-2xl font-bold text-amber-500">
												{stats.eventsExplored}
											</p>
										</div>
										<div className="p-4 bg-gray-700 rounded-lg">
											<p className="text-sm text-gray-300">
												Quizzes Completed
											</p>
											<p className="text-2xl font-bold text-amber-500">
												{stats.totalQuizzes}
											</p>
										</div>
										<div className="p-4 bg-gray-700 rounded-lg">
											<p className="text-sm text-gray-300">
												Average Quiz Score
											</p>
											<p className="text-2xl font-bold text-amber-500">
												{stats.averageScore.toFixed(1)}%
											</p>
										</div>
										<div className="p-4 bg-gray-700 rounded-lg">
											<p className="text-sm text-gray-300">
												Historical Paths Created
											</p>
											<p className="text-2xl font-bold text-amber-500">
												{stats.pathsCreated}
											</p>
										</div>
									</div>

									<div>
										<h3 className="text-lg font-medium mb-2 text-white">
											Quick Links
										</h3>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
											<Link
												href="/profile/quizzes"
												className="flex items-center justify-center py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded"
											>
												Your Quizzes
											</Link>
											<Link
												href="/map"
												className="flex items-center justify-center py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded"
											>
												Explore Map
											</Link>
										</div>
									</div>
								</div>
							) : (
								<div className="flex items-center justify-center h-64">
									<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Profile;
