'use client';

import React, { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { SubscriptionTier } from '@/types/user';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';

const Profile: React.FC = () => {
	const { user, isLoading, error, updateTier } = useUser();
	const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(
		user?.subscription_tier || null
	);

	const handleTierChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		setSelectedTier(event.target.value as SubscriptionTier);
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (selectedTier) {
			await updateTier(selectedTier);
		}
	};

	return (
		<>
			<SignedIn>
				<div className="container mx-auto p-6">
					<h1 className="text-3xl font-bold mb-6">User Profile</h1>

					{isLoading ? (
						<div>Loading user data...</div>
					) : error ? (
						<div className="text-red-600">{error}</div>
					) : !user ? (
						<div>User not found. Please sign in again.</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
							<div className="bg-white p-6 rounded-lg shadow-md">
								<h2 className="text-xl font-semibold mb-4">
									Account Information
								</h2>
								<div className="mb-4">
									<p className="text-gray-600">Username</p>
									<p className="font-medium">
										{user.username}
									</p>
								</div>
								<div className="mb-4">
									<p className="text-gray-600">Email</p>
									<p className="font-medium">{user.email}</p>
								</div>
								<div className="mb-4">
									<p className="text-gray-600">
										Current Subscription
									</p>
									<p className="font-medium capitalize">
										{user.subscription_tier}
									</p>
								</div>
								<div className="mb-4">
									<p className="text-gray-600">
										Member Since
									</p>
									<p className="font-medium">
										{new Date(
											user.created_at || ''
										).toLocaleDateString()}
									</p>
								</div>
							</div>

							<div className="bg-white p-6 rounded-lg shadow-md">
								<h2 className="text-xl font-semibold mb-4">
									Update Subscription
								</h2>
								<form onSubmit={handleSubmit}>
									<div className="mb-4">
										<label
											htmlFor="tier"
											className="block text-gray-600 mb-2"
										>
											Subscription Tier
										</label>
										<select
											id="tier"
											value={
												selectedTier ||
												user.subscription_tier
											}
											onChange={handleTierChange}
											className="w-full p-2 border rounded-md"
										>
											<option
												value={SubscriptionTier.STUDENT}
											>
												Student - Basic access
											</option>
											<option
												value={SubscriptionTier.SCHOLAR}
											>
												Scholar - Intermediate access
												with advanced search
											</option>
											<option
												value={
													SubscriptionTier.HISTORIAN
												}
											>
												Historian - Full access with
												data analysis
											</option>
										</select>
									</div>

									<button
										type="submit"
										className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
										disabled={
											selectedTier ===
											user.subscription_tier
										}
									>
										Update Subscription
									</button>
								</form>

								<div className="mt-6">
									<h3 className="font-medium mb-2">
										Subscription Benefits
									</h3>
									<ul className="list-disc list-inside space-y-1 text-sm">
										<li>
											<strong>Student:</strong> Basic
											event search and map viewing
										</li>
										<li>
											<strong>Scholar:</strong> Advanced
											search features with more results
											and AI generation
										</li>
										<li>
											<strong>Historian:</strong> Full
											data analysis features and maximum
											search results
										</li>
									</ul>
								</div>
							</div>
						</div>
					)}
				</div>
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
};

export default Profile;
