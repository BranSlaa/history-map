'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { SubscriptionTier } from '@/types/user';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { getToken } from '@/utils/authUtils';
import Link from 'next/link';
import {
	BookOpen,
	AlertTriangle,
	Clock,
	Award,
	ArrowRight,
	Loader2,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface Quiz {
	id: string;
	title: string;
	description: string;
	difficulty: string;
	created_at: string;
}

const QuizDashboard: React.FC = () => {
	const { user, isLoading } = useUser();
	const [error, setError] = useState<string | null>(null);
	const [quizzes, setQuizzes] = useState<Quiz[]>([]);
	const [loadingQuizzes, setLoadingQuizzes] = useState(false);

	useEffect(() => {
		const fetchQuizzes = async () => {
			if (!user) return;

			const token = getToken();
			if (!token) {
				setError('Authentication error. Please sign in again.');
				return;
			}

			setLoadingQuizzes(true);
			try {
				const response = await fetch(`${API_URL}/quizzes`, {
					headers: {
						Authorization: `Bearer ${token}`,
					},
					credentials: 'include',
				});

				if (!response.ok) {
					throw new Error(
						`Failed to fetch quizzes: ${response.statusText}`,
					);
				}

				const data = await response.json();
				setQuizzes(data);
			} catch (err) {
				console.error('Error fetching quizzes:', err);
				setError('Failed to load quizzes. Please try again later.');
			} finally {
				setLoadingQuizzes(false);
			}
		};

		if (user && hasAccess) {
			fetchQuizzes();
		}
	}, [user]);

	// Check if user has access to Scholar features
	const hasAccess =
		user &&
		[SubscriptionTier.SCHOLAR, SubscriptionTier.HISTORIAN].includes(
			user.subscription_tier as SubscriptionTier,
		);

	// Helper function to get difficulty badge color
	const getDifficultyColor = (difficulty: string) => {
		switch (difficulty.toLowerCase()) {
			case 'easy':
				return 'bg-emerald-100 text-emerald-800';
			case 'medium':
				return 'bg-amber-100 text-amber-800';
			case 'hard':
				return 'bg-rose-100 text-rose-800';
			default:
				return 'bg-blue-100 text-blue-800';
		}
	};

	return (
		<>
			<SignedIn>
				<div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
					{/* Hero section with background */}
					<div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-12 px-6 shadow-md">
						<div className="container mx-auto max-w-6xl">
							<h1 className="text-4xl font-bold mb-2">
								Quiz Dashboard
							</h1>
							<p className="text-indigo-100 max-w-2xl">
								Test your knowledge with our interactive history
								quizzes and track your progress over time.
								Challenge yourself with various difficulty
								levels!
							</p>
						</div>
					</div>

					<div className="container mx-auto max-w-6xl px-6 py-8">
						{isLoading ? (
							<div className="flex items-center justify-center p-12">
								<Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
								<span className="ml-2 text-lg text-slate-700">
									Loading user data...
								</span>
							</div>
						) : !hasAccess ? (
							<div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-500 rounded-lg shadow-md p-6 mb-6">
								<div className="flex items-start">
									<AlertTriangle className="h-6 w-6 text-amber-500 mr-3 mt-1 flex-shrink-0" />
									<div>
										<p className="font-bold text-amber-800 text-lg">
											Subscription Required
										</p>
										<p className="text-amber-700 mt-1">
											You need at least a Scholar
											subscription tier to access quizzes.
											Upgrade your plan to unlock this
											feature.
										</p>
										<Link href="/profile">
											<button className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center">
												Upgrade Now
												<ArrowRight className="h-4 w-4 ml-2" />
											</button>
										</Link>
									</div>
								</div>
							</div>
						) : (
							<>
								{error && (
									<div className="bg-gradient-to-r from-rose-50 to-red-50 border-l-4 border-red-500 rounded-lg shadow-md p-6 mb-6">
										<div className="flex items-start">
											<AlertTriangle className="h-6 w-6 text-red-500 mr-3 mt-1 flex-shrink-0" />
											<div>
												<p className="font-bold text-red-800">
													Error
												</p>
												<p className="text-red-700 mt-1">
													{error}
												</p>
												<button
													onClick={() =>
														window.location.reload()
													}
													className="mt-3 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm transition-colors duration-200"
												>
													Try Again
												</button>
											</div>
										</div>
									</div>
								)}

								<div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
									<div className="border-b border-slate-100 bg-slate-50 p-6">
										<div className="flex justify-between items-center">
											<div className="flex items-center">
												<BookOpen className="h-6 w-6 text-indigo-600 mr-2" />
												<h2 className="text-2xl font-semibold text-slate-800">
													Available Quizzes
												</h2>
											</div>
											{loadingQuizzes && (
												<div className="flex items-center text-slate-500">
													<Loader2 className="h-4 w-4 animate-spin mr-2" />
													<span>Refreshing...</span>
												</div>
											)}
										</div>
									</div>

									<div className="p-6">
										{loadingQuizzes &&
										quizzes.length === 0 ? (
											<div className="flex flex-col items-center justify-center py-12">
												<Loader2 className="h-12 w-12 text-indigo-500 animate-spin mb-4" />
												<p className="text-slate-600 text-lg">
													Loading quizzes...
												</p>
											</div>
										) : quizzes.length === 0 ? (
											<div className="flex flex-col items-center justify-center py-16 text-center">
												<div className="bg-slate-100 p-4 rounded-full mb-4">
													<BookOpen className="h-10 w-10 text-slate-400" />
												</div>
												<h3 className="text-xl font-medium text-slate-700 mb-2">
													No quizzes available
												</h3>
												<p className="text-slate-500 max-w-md">
													There are no quizzes
													available at the moment.
													Please check back later.
												</p>
											</div>
										) : (
											<div className="grid md:grid-cols-2 gap-6">
												{quizzes.map(quiz => (
													<div
														key={quiz.id}
														className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
													>
														<div className="p-6">
															<h3 className="text-xl font-semibold text-slate-800 mb-2">
																{quiz.title}
															</h3>
															<p className="text-slate-600 mb-4 line-clamp-2">
																{
																	quiz.description
																}
															</p>
															<div className="flex items-center justify-between mt-4">
																<div className="flex items-center space-x-3">
																	<span
																		className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(
																			quiz.difficulty,
																		)}`}
																	>
																		<Award className="h-3 w-3 mr-1" />
																		{
																			quiz.difficulty
																		}
																	</span>
																	<span className="text-xs text-slate-500 flex items-center">
																		<Clock className="h-3 w-3 mr-1" />
																		{new Date(
																			quiz.created_at,
																		).toLocaleDateString(
																			'en-CA',
																		)}
																	</span>
																</div>
																<Link
																	href={`/quiz/${quiz.id}`}
																>
																	<button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center text-sm">
																		Start
																		Quiz
																		<ArrowRight className="h-4 w-4 ml-1" />
																	</button>
																</Link>
															</div>
														</div>
													</div>
												))}
											</div>
										)}
									</div>
								</div>
							</>
						)}
					</div>
				</div>
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
};

export default QuizDashboard;
