'use client';

import React, { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { SubscriptionTier } from '@/types/user';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { getToken } from '@/utils/authUtils';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface AnalysisResult {
	message: string;
	[key: string]: any; // For any additional data in the results
}

const DataAnalysis: React.FC = () => {
	const { user, isLoading } = useUser();
	const [selectedDataset, setSelectedDataset] = useState<string>('');
	const [analysisResults, setAnalysisResults] =
		useState<AnalysisResult | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	const datasets = [
		{ id: 'historical-events', name: 'Historical Events (All Periods)' },
		{ id: 'trade-routes', name: 'Historical Trade Routes' },
		{ id: 'ancient-civilizations', name: 'Ancient Civilizations' },
		{ id: 'medieval-europe', name: 'Medieval Europe' },
		{ id: 'renaissance', name: 'Renaissance Period' },
		{ id: 'industrial-revolution', name: 'Industrial Revolution' },
		{ id: 'world-wars', name: 'World Wars' },
		{ id: 'modern-history', name: 'Modern History (Post-1950)' },
	];

	const handleAnalysis = async (event: React.FormEvent) => {
		event.preventDefault();
		setIsAnalyzing(true);
		setError(null);

		const token = getToken();
		if (!token) {
			setError('Authentication error. Please sign in again.');
			setIsAnalyzing(false);
			return;
		}

		try {
			const response = await fetch(
				`${API_URL}/historian/data-analysis?dataset=${encodeURIComponent(
					selectedDataset
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
						'You need a Historian subscription to use data analysis features.'
					);
				} else {
					setError(`Analysis failed: ${response.statusText}`);
				}
				return;
			}

			const data = await response.json();
			setAnalysisResults(data);
		} catch (err) {
			setError('An error occurred during analysis.');
			console.error(err);
		} finally {
			setIsAnalyzing(false);
		}
	};

	// Check if user has access to Historian features
	const hasAccess =
		user && user.subscription_tier === SubscriptionTier.HISTORIAN;

	return (
		<>
			<SignedIn>
				<div className="container mx-auto p-6">
					<h1 className="text-3xl font-bold mb-6">
						Historical Data Analysis
					</h1>

					{isLoading ? (
						<div>Loading user data...</div>
					) : !hasAccess ? (
						<div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6">
							<p className="font-bold">Subscription Required</p>
							<p>
								You need a Historian subscription tier to access
								data analysis features.
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
									Advanced Historical Data Analysis
								</h2>
								<p className="mb-4 text-gray-600">
									Explore historical trends, connections, and
									patterns across different time periods and
									geographical regions with our powerful data
									analysis tools.
								</p>

								<form onSubmit={handleAnalysis}>
									<div className="mb-4">
										<label
											htmlFor="dataset"
											className="block text-gray-600 mb-2"
										>
											Select Dataset to Analyze
										</label>
										<select
											id="dataset"
											value={selectedDataset}
											onChange={e =>
												setSelectedDataset(
													e.target.value
												)
											}
											className="w-full p-2 border rounded-md"
											required
										>
											<option value="">
												-- Select a dataset --
											</option>
											{datasets.map(dataset => (
												<option
													key={dataset.id}
													value={dataset.id}
												>
													{dataset.name}
												</option>
											))}
										</select>
									</div>

									<button
										type="submit"
										className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
										disabled={
											!selectedDataset || isAnalyzing
										}
									>
										{isAnalyzing
											? 'Analyzing...'
											: 'Analyze Data'}
									</button>
								</form>

								{error && (
									<div className="mt-4 text-red-600">
										{error}
									</div>
								)}
							</div>

							{analysisResults && (
								<div className="bg-white p-6 rounded-lg shadow-md">
									<h2 className="text-xl font-semibold mb-4">
										Analysis Results
									</h2>
									<div className="p-4 bg-gray-50 rounded-md">
										<p className="mb-4">
											{analysisResults.message}
										</p>

										{/* This would be replaced with actual visualizations, charts, etc. */}
										<div className="text-center p-8 border border-dashed border-gray-300 rounded-md">
											<p className="text-gray-500">
												[Visualization of analysis
												results would appear here]
											</p>
										</div>
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

export default DataAnalysis;
