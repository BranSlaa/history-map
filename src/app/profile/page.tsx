'use client';

import React, { useState, useEffect } from 'react';
import { SubscriptionTier } from '@/types/user';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import Link from 'next/link';

const Profile: React.FC = () => {
	const { user, profile, loading, error, signOut, updateProfile } = useAuth();
	const router = useRouter();
	const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(
		profile?.subscription_tier || null,
	);
	const [username, setUsername] = useState<string>(profile?.username || '');
	const [avatarUrl, setAvatarUrl] = useState<string>(
		profile?.avatar_url || user?.avatar_url || '',
	);
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
			setAvatarUrl(profile.avatar_url || '');
			setSelectedTier(profile.subscription_tier);
		} else if (user) {
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

				let quizAttempts: { score: number }[] = [];
				let eventCount = 0;
				let connectionsCount = 0;
				let pathsCreated = 0;

				// Fetch quiz attempts
				try {
					// Removed direct Supabase reference
					quizAttempts = [];
				} catch (err) {
					console.log('Quiz attempts table may not exist yet:', err);
					quizAttempts = [];
				}

				// Fetch paths (replaces historical_paths)
				try {
					// Removed direct Supabase reference
					pathsCreated = 0;
				} catch (err) {
					console.log('Paths error:', err);
					pathsCreated = 0;
				}

				// Fetch path events for event exploration count
				try {
					// Removed direct Supabase reference
					eventCount = 0;
				} catch (err) {
					console.log('Path events error:', err);
					eventCount = 0;
				}

				// Calculate statistics
				const totalQuizzes = quizAttempts.length;
				const averageScore =
					totalQuizzes > 0
						? quizAttempts.reduce(
								(sum, attempt) => sum + (attempt.score || 0),
								0,
							) / totalQuizzes
						: 0;

				setStats({
					totalQuizzes,
					averageScore,
					eventsExplored: eventCount,
					connectionsCreated: connectionsCount,
					pathsCreated: pathsCreated,
				});
			} catch (error) {
				console.error('Error fetching user stats:', error);
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
			try {
				// Removed direct Supabase storage reference

				// Get public URL
				// Removed direct Supabase storage reference

				// Update profile with placeholder
				const newAvatarUrl = '';
				setAvatarUrl(newAvatarUrl);
				await updateProfile({ avatar_url: newAvatarUrl });

				alert('Avatar updated!');
			} catch (error) {
				console.error('Error uploading avatar:', error);
				alert('Error uploading avatar.');
			} finally {
				setIsUpdating(false);
			}
		} catch (error) {
			console.error('Error uploading avatar:', error);
			alert('Error uploading avatar.');
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
								User Information:
							</h2>

							{/* Avatar Upload */}
							<div className="flex items-center mb-6 space-x-4">
								<div className="relative w-20 h-20 overflow-hidden rounded-full bg-gray-700">
									{avatarUrl ? (
										<Image
											src={avatarUrl}
											alt="User avatar"
											fill
											sizes="5rem"
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
								</div>
							</form>
						</div>
					</div>

					{/* User Stats Card */}
					<div className="col-span-12 lg:col-span-8">
						<div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
							<div className="flex items-center justify-between gap-4 mb-4">
								<h2 className="text-xl font-semibold mb-4 text-amber-500">
									Learning Statistics:
								</h2>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									<Link
										href="/profile/quizzes"
										className="flex items-center justify-center py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded"
									>
										View Quizzes
									</Link>
									<Link
										href="/map"
										className="flex items-center justify-center py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded"
									>
										Explore Map
									</Link>
								</div>
							</div>

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
