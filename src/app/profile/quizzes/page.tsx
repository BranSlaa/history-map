'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import supabase from '@/lib/supabaseClient';
import { Header } from '../../components/Header';
import { Quiz, QuizAttempt } from '@/types/quiz';
import { PathData } from '@/types/path';
import Link from 'next/link';

const ProfileQuizzes: React.FC = () => {
	const { user, profile, loading } = useAuth();
	const router = useRouter();
	const [quizzes, setQuizzes] = useState<Quiz[]>([]);
	const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [canGenerateQuiz, setCanGenerateQuiz] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [eventCount, setEventCount] = useState(0);
	const [diagnosticData, setDiagnosticData] = useState<any>(null);
	const [showDiagnostics, setShowDiagnostics] = useState(false);

	// Function to handle quiz generation
	const handleGenerateQuiz = async () => {
		try {
			const userId = user?.id || profile?.id;
			if (!userId) {
				setErrorMessage('You must be logged in to generate a quiz');
				setCanGenerateQuiz(false);
				return;
			}

			setIsLoading(true);
			const response = await fetch('/api/quizzes/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userid: userId,
				}),
			});

			if (response.status === 401) {
				setErrorMessage('You must be logged in to generate a quiz');
				setCanGenerateQuiz(false);
				return;
			}

			if (response.status === 400) {
				const errorData = await response.json();
				setErrorMessage(
					errorData.message ||
						'You need to explore more historical events before generating a quiz!',
				);
				setCanGenerateQuiz(false);
				return;
			}

			if (response.ok) {
				const result = await response.json();
				alert(
					`Quiz generated: "${result.title || 'New Quiz'}"! Refreshing page...`,
				);
				window.location.reload();
			} else {
				// Attempt to get error details from response
				let errorMessage = 'Unknown error occurred';
				let errorDetails = {};

				try {
					const errorData = await response.json();
					console.log(
						'Error response:',
						response.status,
						response.statusText,
						errorData,
					);

					if (errorData && typeof errorData === 'object') {
						errorDetails = errorData;
						errorMessage =
							errorData.error ||
							errorData.message ||
							response.statusText ||
							'Unknown error';
					}
				} catch (parseError) {
					console.error('Error parsing error response:', parseError);
					errorMessage =
						response.statusText || `HTTP error ${response.status}`;
				}

				setErrorMessage(`Failed to generate quiz: ${errorMessage}`);
				setCanGenerateQuiz(false);
				console.error('Quiz generation error:', {
					status: response.status,
					statusText: response.statusText,
					details: errorDetails,
				});
			}
		} catch (error) {
			console.error('Error generating quiz:', error);
			setErrorMessage(
				'Failed to generate quiz. See console for details.',
			);
			setCanGenerateQuiz(false);
		} finally {
			setIsLoading(false);
		}
	};

	// Add function to fetch diagnostic data
	const fetchDiagnosticData = async () => {
		if (!user && !profile) return;

		const userId = user?.id || profile?.id;
		if (!userId) return;

		try {
			// Fetch path data
			const pathResponse = await supabase
				.from('user_paths')
				.select('path_data, created_at, updated_at')
				.eq('user_id', userId)
				.order('updated_at', { ascending: false })
				.limit(1);

			// Fetch interactions
			const interactionsResponse = await supabase
				.from('user_event_interactions')
				.select('event_id, created_at')
				.eq('user_id', userId)
				.order('created_at', { ascending: false })
				.limit(10);

			// Set diagnostic data
			setDiagnosticData({
				userId,
				paths: {
					data: pathResponse.data,
					error: pathResponse.error,
					count: pathResponse.data?.length || 0,
					chosenEvents:
						pathResponse.data?.[0]?.path_data?.chosenEvents || [],
				},
				interactions: {
					data: interactionsResponse.data,
					error: interactionsResponse.error,
					count: interactionsResponse.data?.length || 0,
				},
				timestamp: new Date().toISOString(),
			});

			setShowDiagnostics(true);
		} catch (error) {
			console.error('Error fetching diagnostic data:', error);
			setDiagnosticData({ error: 'Failed to fetch diagnostic data' });
		}
	};

	useEffect(() => {
		const fetchUserQuizzes = async () => {
			if (!user && !profile) return;

			const userId = user?.id || profile?.id;
			if (!userId) return;

			setIsLoading(true);
			try {
				console.log('Fetching quizzes with user ID:', userId);
				// Query quizzes with their questions
				const { data: quizzesData, error: quizzesError } =
					await supabase
						.from('quizzes')
						.select(
							`
						*,
						quiz_questions:quiz_questions(*)
					`,
						)
						.order('created_at', { ascending: false });

				if (quizzesError) {
					console.error('Specific quizzes error:', quizzesError);
					setQuizzes([]);
				} else {
					console.log('Successfully fetched quizzes:', quizzesData);
					setQuizzes(quizzesData || []);
				}

				// Fetch quiz attempts for this user
				const { data: attemptsData, error: attemptsError } =
					await supabase
						.from('quiz_attempts')
						.select('*')
						.eq('user_id', userId);

				if (attemptsError) {
					console.error('Specific attempts error:', attemptsError);
					setAttempts([]);
				} else {
					console.log('Successfully fetched attempts:', attemptsData);
					setAttempts(attemptsData || []);
				}

				// Check if user has explored any events
				try {
					// First, try to check user paths
					type PathDataResult = { path_data: PathData }[];

					const { data, error: pathsError } = await supabase
						.from('user_paths')
						.select('path_data')
						.eq('user_id', userId)
						.order('updated_at', { ascending: false })
						.limit(1);

					// Explicitly type the data to avoid TS errors
					const userPaths = data as PathDataResult;

					if (pathsError) {
						console.error('Error fetching user paths:', pathsError);

						// If table doesn't exist (code 42P01) or other error, try fallback to interactions
						if (
							pathsError.code === '42P01' ||
							!userPaths ||
							userPaths.length === 0
						) {
							console.log(
								'Falling back to user_event_interactions',
							);
							checkUserInteractions();
						} else {
							// Some other error occurred
							setCanGenerateQuiz(true); // Allow quiz generation by default
							setErrorMessage(null);
						}
					} else if (
						userPaths &&
						userPaths.length > 0 &&
						userPaths[0].path_data?.chosenEvents
					) {
						// User has path data with chosen events
						const pathData = userPaths[0].path_data;
						const chosenEvents = pathData.chosenEvents || [];

						// Check that chosenEvents is an array and has entries
						if (
							Array.isArray(chosenEvents) &&
							chosenEvents.length > 0
						) {
							setEventCount(chosenEvents.length);
							setCanGenerateQuiz(true);
							setErrorMessage(null);
						} else {
							checkUserInteractions();
						}
					} else {
						// No path data found
						checkUserInteractions();
					}
				} catch (error) {
					console.error('Error in event checking:', error);
					// Allow quiz generation despite the error
					setCanGenerateQuiz(true);
					setErrorMessage(null);
				}

				// Helper function to check user interactions as fallback
				async function checkUserInteractions() {
					try {
						const { data: interactions, error: interactionsError } =
							await supabase
								.from('user_event_interactions')
								.select('id')
								.eq('user_id', userId);

						if (interactionsError) {
							console.error(
								'Error fetching user interactions:',
								interactionsError,
							);
							// Default to allow quiz generation
							setCanGenerateQuiz(true);
							setErrorMessage(null);
						} else {
							const interactionCount = interactions?.length || 0;
							setEventCount(interactionCount);

							if (interactionCount === 0) {
								setCanGenerateQuiz(false);
								setErrorMessage(
									'You need to explore historical events before generating a quiz!',
								);
							} else {
								setCanGenerateQuiz(true);
								setErrorMessage(null);
							}
						}
					} catch (error) {
						console.error('Error in interactions fallback:', error);
						// Default to allow quiz generation
						setCanGenerateQuiz(true);
						setErrorMessage(null);
					}
				}
			} catch (error) {
				console.error('Error fetching user quizzes:', error);
				setQuizzes([]);
				setAttempts([]);
			} finally {
				setIsLoading(false);
			}
		};

		fetchUserQuizzes();
	}, [user, profile]);

	// Function to get the associated attempt for a quiz
	const getQuizAttempt = (quizId: string) => {
		return attempts.find(attempt => attempt.quiz_id === quizId);
	};

	if (loading || isLoading) {
		return (
			<div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
				<div className="text-lg">Loading your quizzes...</div>
			</div>
		);
	}

	if (!user && !profile) {
		return (
			<div className="container mx-auto p-6">
				<Header />
				<div className="max-w-4xl mx-auto mt-10 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
					<h1 className="text-3xl font-bold mb-6">
						You need to sign in to view your quizzes
					</h1>
					<button
						onClick={() => router.push('/login')}
						className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
					>
						Sign In
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto p-6">
			<Header />
			<div className="max-w-4xl mx-auto mt-10">
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-3xl font-bold">My Quizzes</h1>

					<div className="flex items-center gap-4">
						<button
							onClick={fetchDiagnosticData}
							className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
						>
							{showDiagnostics
								? 'Refresh Diagnostics'
								: 'Show Diagnostics'}
						</button>

						<Link
							href="/profile"
							className="text-blue-500 hover:text-blue-600"
						>
							Back to Profile
						</Link>
					</div>
				</div>

				{/* Diagnostic panel */}
				{showDiagnostics && diagnosticData && (
					<div className="mb-6 bg-stone-700 p-4 rounded-lg text-sm overflow-auto max-h-96">
						<h3 className="font-bold text-lg mb-2">
							Diagnostic Data
						</h3>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<h4 className="font-semibold">
									User Path Data:
								</h4>
								{diagnosticData.paths.count > 0 ? (
									<div>
										<p>
											Path Count:{' '}
											{diagnosticData.paths.count}
										</p>
										<p>
											Chosen Events:{' '}
											{
												diagnosticData.paths
													.chosenEvents.length
											}
										</p>
										<div className="mt-2">
											<strong>Chosen Events:</strong>
											<pre className="bg-stone-800 p-2 rounded mt-1 text-xs overflow-auto max-h-36">
												{JSON.stringify(
													diagnosticData.paths
														.chosenEvents,
													null,
													2,
												)}
											</pre>
										</div>
									</div>
								) : (
									<p className="text-red-500">
										No path data found
									</p>
								)}
								{diagnosticData.paths.error && (
									<p className="text-red-500">
										Error:{' '}
										{JSON.stringify(
											diagnosticData.paths.error,
										)}
									</p>
								)}
							</div>

							<div>
								<h4 className="font-semibold">
									Event Interactions:
								</h4>
								{diagnosticData.interactions.count > 0 ? (
									<div>
										<p>
											Interaction Count:{' '}
											{diagnosticData.interactions.count}
										</p>
										<div className="mt-2">
											<strong>
												Recent Interactions:
											</strong>
											<pre className="bg-stone-800 p-2 rounded mt-1 text-xs overflow-auto max-h-36">
												{JSON.stringify(
													diagnosticData.interactions
														.data,
													null,
													2,
												)}
											</pre>
										</div>
									</div>
								) : (
									<p className="text-red-500">
										No interactions found
									</p>
								)}
								{diagnosticData.interactions.error && (
									<p className="text-red-500">
										Error:{' '}
										{JSON.stringify(
											diagnosticData.interactions.error,
										)}
									</p>
								)}
							</div>
						</div>

						{/* Raw path data display */}
						<div className="mt-4">
							<button
								onClick={() => setShowDiagnostics(false)}
								className="text-xs text-blue-500 hover:text-blue-700"
							>
								Hide Diagnostics
							</button>
						</div>
					</div>
				)}

				{quizzes.length === 0 ? (
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
						<h2 className="text-xl mb-4">No quizzes yet</h2>
						<p className="mb-4">
							Continue exploring history to unlock quizzes!
						</p>
						<p className="text-sm text-gray-500 mb-4">
							Quizzes are generated after you interact with
							historical events.
						</p>
						<div className="flex flex-col sm:flex-row justify-center gap-4">
							<button
								onClick={() => router.push('/')}
								className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
							>
								Explore History
							</button>

							{canGenerateQuiz && (
								<button
									onClick={handleGenerateQuiz}
									className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
								>
									Generate Quiz
								</button>
							)}
						</div>
					</div>
				) : (
					<div>
						<div className="mb-6 flex justify-between items-center">
							<h2 className="text-xl font-semibold">
								Your Quiz History
							</h2>
							{canGenerateQuiz && (
								<button
									onClick={handleGenerateQuiz}
									className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
								>
									Generate New Quiz
								</button>
							)}
						</div>
						<div className="grid grid-cols-1 gap-6">
							{quizzes.map(quiz => {
								const attempt = getQuizAttempt(quiz.id);
								return (
									<div
										key={quiz.id}
										className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
									>
										<div className="flex justify-between items-start">
											<div>
												<h2 className="text-xl font-semibold mb-2">
													{quiz.title}
												</h2>
												<p className="text-gray-600 dark:text-gray-300 mb-4">
													{quiz.description}
												</p>
												<div className="flex space-x-4 text-sm">
													<span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
														{quiz.difficulty}
													</span>
													<span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
														Created:{' '}
														{new Date(
															quiz.created_at,
														).toLocaleDateString()}
													</span>
												</div>
											</div>

											<div className="text-right">
												{attempt ? (
													<div>
														<span className="font-semibold">
															Score:{' '}
															{attempt.score}%
														</span>
														<p className="text-sm text-gray-500">
															Completed:{' '}
															{new Date(
																attempt.completed_at ||
																	'',
															).toLocaleDateString()}
														</p>
													</div>
												) : (
													<button
														className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
														onClick={() =>
															router.push(
																`/quizzes/${quiz.id}`,
															)
														}
													>
														Take Quiz
													</button>
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default ProfileQuizzes;
