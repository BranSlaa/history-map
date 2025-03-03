'use client';

import React, { useState } from 'react';
import { SubscriptionTier } from '@/types/user';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const Profile: React.FC = () => {
	const { user, authUser, loading, error, updateTier } = useAuth();
	const router = useRouter();
	const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(
		user?.subscription_tier || null,
	);

	const handleTierChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		setSelectedTier(event.target.value as unknown as SubscriptionTier);
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (selectedTier) {
			await updateTier(selectedTier);
		}
	};

	// If user is not authenticated, redirect to login
	React.useEffect(() => {
		if (!authUser && !loading) {
			router.push('/login');
		}
	}, [authUser, loading, router]);

	if (loading) {
		return <div className="container mx-auto p-6">Loading...</div>;
	}

	if (!user) {
		return <div className="container mx-auto p-6">Not logged in</div>;
	}

	return (
		<div className="container mx-auto p-6">
			<h1 className="text-3xl font-bold mb-6">User Profile</h1>
			{error && <div className="text-red-500 mb-4">{error}</div>}
			<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
				<div className="mb-4">
					<p className="text-lg">
						<strong>Username:</strong> {user.username}
					</p>
					<p className="text-lg">
						<strong>Email:</strong> {user.email}
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
							className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent"
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
		</div>
	);
};

export default Profile;
