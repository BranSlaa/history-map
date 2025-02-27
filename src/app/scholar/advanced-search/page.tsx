'use client';

import React, { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Event } from '@/types/event';
import { SubscriptionTier } from '@/types/user';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { getToken } from '@/utils/authUtils';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const AdvancedSearch: React.FC = () => {
	const { user, isLoading } = useUser();
	const [searchQuery, setSearchQuery] = useState<string>('');
	const [searchResults, setSearchResults] = useState<Event[]>([]);
	const [isSearching, setIsSearching] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	const handleSearch = async (event: React.FormEvent) => {
		event.preventDefault();
		setIsSearching(true);
		setError(null);

		const token = getToken();
		if (!token) {
			setError('Authentication error. Please sign in again.');
			setIsSearching(false);
			return;
		}

		try {
			const response = await fetch(
				`${API_URL}/scholar/advanced-search?query=${encodeURIComponent(
					searchQuery
				)}`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);

			if (!response.ok) {
				if (response.status === 403) {
					setError(
						'You need at least a Scholar subscription to use advanced search.'
					);
				} else {
					setError(`Search failed: ${response.statusText}`);
				}
				return;
			}

			const data = await response.json();
			setSearchResults(data || []);
		} catch (err) {
			setError('An error occurred while searching.');
			console.error(err);
		} finally {
			setIsSearching(false);
		}
	};

	// Check if user has access to Scholar features
	const hasAccess =
		user &&
		[SubscriptionTier.SCHOLAR, SubscriptionTier.HISTORIAN].includes(
			user.subscription_tier as SubscriptionTier
		);

	return (
		<>
			<SignedIn>
				<div className="container mx-auto p-6">
					<h1 className="text-3xl font-bold mb-6">
						Advanced Historical Search
					</h1>

					{isLoading ? (
						<div>Loading user data...</div>
					) : !hasAccess ? (
						<div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6">
							<p className="font-bold">Subscription Required</p>
							<p>
								You need at least a Scholar subscription tier to
								access advanced search features.
							</p>
							<p className="mt-2">
								<Link
									href="/profile"
									className="text-blue-600 hover:underline"
								>
									Upgrade your subscription
								</Link>
							</p>
						</div>
					) : (
						<>
							<div className="bg-white p-6 rounded-lg shadow-md mb-6">
								<h2 className="text-xl font-semibold mb-4">
									Vector-Based Historical Search
								</h2>
								<p className="mb-4 text-gray-600">
									Use advanced semantic search to find
									historical events, people, and places with
									more accurate and contextually relevant
									results.
								</p>

								<form onSubmit={handleSearch}>
									<div className="flex flex-col md:flex-row gap-4">
										<div className="flex-grow">
											<input
												type="text"
												value={searchQuery}
												onChange={e =>
													setSearchQuery(
														e.target.value
													)
												}
												placeholder="Enter your search query..."
												className="w-full p-2 border rounded-md"
												required
											/>
										</div>
										<button
											type="submit"
											className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
											disabled={isSearching}
										>
											{isSearching
												? 'Searching...'
												: 'Search'}
										</button>
									</div>
								</form>

								{error && (
									<div className="mt-4 text-red-600">
										{error}
									</div>
								)}
							</div>

							{searchResults.length > 0 && (
								<div className="bg-white p-6 rounded-lg shadow-md">
									<h2 className="text-xl font-semibold mb-4">
										Search Results
									</h2>
									<div className="space-y-4">
										{searchResults.map(event => (
											<div
												key={event.id}
												className="border-b pb-4"
											>
												<h3 className="font-semibold text-lg">
													{event.title}
												</h3>
												<div className="text-sm text-gray-500 mb-2">
													Year: {event.year} |
													Subject: {event.subject}
												</div>
												<p>{event.info}</p>
												{event.key_terms &&
													event.key_terms.length >
														0 && (
														<div className="mt-2">
															<span className="text-xs text-gray-500">
																Key terms:{' '}
															</span>
															{event.key_terms.map(
																(
																	term: string,
																	i: number
																) => (
																	<span
																		key={i}
																		className="inline-block bg-gray-100 text-xs px-2 py-1 rounded mr-1 mb-1"
																	>
																		{term}
																	</span>
																)
															)}
														</div>
													)}
											</div>
										))}
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
};

export default AdvancedSearch;
