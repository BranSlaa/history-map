'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import supabase from '@/lib/supabaseClient';
import { Quiz, QuizAttempt } from '@/types/quiz';
import { PathData } from '@/types/path';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { FiArrowLeft, FiMap } from 'react-icons/fi';

const ProfileQuizzes: React.FC = () => {
	const router = useRouter();
	const { user, profile } = useAuth();
	const [quizzes, setQuizzes] = useState<Quiz[]>([]);
	const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [canGenerateQuiz, setCanGenerateQuiz] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [eventCount, setEventCount] = useState(0);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);
	const [generationProgress, setGenerationProgress] = useState<{
		step: number;
		message: string;
		isComplete: boolean;
	}>({
		step: 0,
		message: '',
		isComplete: false,
	});
	const [userPaths, setUserPaths] = useState<any[]>([]);

	// Function to handle quiz generation
	const handleGenerateQuiz = async () => {
		// We're already in a protected route, so we know we have a user
		setIsLoading(true);
		setErrorMessage(null);
		setSuccessMessage(null);
		setGenerationProgress({
			step: 1,
			message: 'Starting quiz generation...',
			isComplete: false,
		});

		try {
			// Get the current auth token before making request
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session) {
				throw new Error('You need to be logged in to generate quizzes');
			}

			setGenerationProgress({
				step: 2,
				message:
					'Authenticating and analyzing your previous quiz performance...',
				isComplete: false,
			});

			// Start the fetch request
			const response = await fetch('/api/quizzes/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${session.access_token}`,
				},
				credentials: 'include',
			});

			// Show generating questions progress
			setGenerationProgress({
				step: 3,
				message:
					'Creating personalized quiz questions based on your historical events (this may take up to a minute)...',
				isComplete: false,
			});

			console.log('Quiz generation response:', response);

			const data = await response.json();

			if (!response.ok) {
				console.error('Quiz generation failed:', {
					status: response.status,
					statusText: response.statusText,
					error: data.error,
					message: data.message,
				});

				setGenerationProgress({
					step: 0,
					message: 'Error generating quiz',
					isComplete: true,
				});

				if (response.status === 401) {
					setErrorMessage(
						'Authentication error: Please log out and log back in.',
					);
				} else {
					setErrorMessage(
						data.message ||
							'Failed to generate quiz. Please try again.',
					);
				}

				setIsLoading(false);
				return;
			}

			if (data && data.events && data.events.length === 0) {
				setGenerationProgress({
					step: 0,
					message: '',
					isComplete: true,
				});
				setErrorMessage(
					'You need to explore some historical events before generating a quiz. Please visit the map and interact with some events first.',
				);
				setIsLoading(false);
				return;
			}

			// If quiz generation is successful
			if (data.success && data.quizId) {
				// Update progress with difficulty information
				const difficulty = data.difficulty || 'Beginner';

				setGenerationProgress({
					step: 4,
					message:
						data.message ||
						`${difficulty} quiz successfully generated!`,
					isComplete: true,
				});

				setSuccessMessage(
					`${difficulty} quiz successfully generated! Each question corresponds to a historical event you've explored, tailored to your skill level.`,
				);

				// Refresh the quiz list
				setRefreshKey(prevKey => prevKey + 1);

				// Give user a moment to see the success message before redirecting
				setTimeout(() => {
					// Navigate to the new quiz
					router.push(`/quizzes/${data.quizId}`);
				}, 1500);
			} else {
				setGenerationProgress({
					step: 0,
					message: 'Something went wrong',
					isComplete: true,
				});

				setErrorMessage(
					'Quiz was created but something went wrong. Please check your quizzes.',
				);
			}
		} catch (error) {
			console.error('Error generating quiz:', error);
			setErrorMessage('An unexpected error occurred. Please try again.');
			setGenerationProgress({
				step: 0,
				message: 'Error encountered',
				isComplete: true,
			});
		} finally {
			setIsLoading(false);
		}
	};

	// Function to fetch user paths
	const fetchUserPaths = useCallback(async () => {
		if (!user?.id) return;

		try {
			const { data: pathsData, error } = await supabase
				.from('user_paths')
				.select('*')
				.eq('user_id', user.id)
				.order('updated_at', { ascending: false });

			if (error) {
				console.error('Error fetching user paths:', error);
				return;
			}

			setUserPaths(pathsData || []);
		} catch (error) {
			console.error('Failed to fetch user paths:', error);
		}
	}, [user, supabase]);

	// Add to the useEffect where you fetch quizzes
	useEffect(() => {
		if (!user?.id) {
			setIsLoading(false);
			return;
		}

		setIsLoading(true);

		// Fetch quizzes
		const fetchUserQuizzes = async () => {
			try {
				console.log('Fetching quizzes with user ID:', user.id);

				// Also fetch event count
				try {
					const { data: interactions, error } = await supabase
						.from('user_event_interactions')
						.select('event_id');

					if (!error && interactions) {
						// Count unique events
						const uniqueEvents = new Set(
							interactions.map(i => i.event_id),
						);
						setEventCount(uniqueEvents.size);
					}
				} catch (err) {
					console.error('Error fetching event count:', err);
				}

				// Fetch quizzes
				const { data: quizzesData, error: quizzesError } =
					await supabase
						.from('quizzes')
						.select('*')
						.eq('user_id', user.id)
						.order('created_at', { ascending: false });

				if (quizzesError) {
					console.error('Error fetching quizzes:', quizzesError);
					setIsLoading(false);
					return;
				}

				console.log('Successfully fetched quizzes:', quizzesData);
				setQuizzes(quizzesData || []);

				// Fetch attempts
				const { data: attemptsData, error: attemptsError } =
					await supabase
						.from('quiz_attempts')
						.select('*')
						.eq('user_id', user.id);

				if (attemptsError) {
					console.error('Error fetching attempts:', attemptsError);
				} else {
					console.log('Successfully fetched attempts:', attemptsData);
					setAttempts(attemptsData || []);
				}

				// Also fetch user paths
				fetchUserPaths();

				setIsLoading(false);
			} catch (error) {
				console.error('Error fetching quizzes:', error);
				setIsLoading(false);
			}
		};

		fetchUserQuizzes();
	}, [user?.id, refreshKey, fetchUserPaths]);

	// Function to generate quiz based on path
	const handleGenerateQuizFromPath = async (
		pathId: string,
		pathName: string,
	) => {
		// We're already in a protected route, so we know we have a user
		setIsLoading(true);
		setErrorMessage(null);
		setSuccessMessage(null);
		setGenerationProgress({
			step: 1,
			message: `Starting generation of quiz for path "${pathName}"...`,
			isComplete: false,
		});

		try {
			// Get the current auth token before making request
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session) {
				throw new Error('You need to be logged in to generate quizzes');
			}

			setGenerationProgress({
				step: 2,
				message:
					'Authenticating and analyzing your previous quiz performance...',
				isComplete: false,
			});

			// Start the fetch request
			const response = await fetch('/api/quizzes/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${session.access_token}`,
				},
				body: JSON.stringify({
					path_id: pathId,
					search_term: pathName,
				}),
				credentials: 'include',
			});

			// Show generating questions progress
			setGenerationProgress({
				step: 3,
				message:
					'Creating personalized quiz questions based on your historical path (this may take up to a minute)...',
				isComplete: false,
			});

			console.log('Quiz generation response:', response);

			const data = await response.json();

			if (!response.ok) {
				console.error('Quiz generation failed:', {
					status: response.status,
					statusText: response.statusText,
					error: data.error,
					message: data.message,
				});

				setGenerationProgress({
					step: 0,
					message: 'Error generating quiz',
					isComplete: true,
				});

				if (response.status === 401) {
					setErrorMessage(
						'Authentication error: Please log out and log back in.',
					);
				} else {
					setErrorMessage(
						data.message ||
							'Failed to generate quiz. Please try again.',
					);
				}

				setIsLoading(false);
				return;
			}

			if (data && data.events && data.events.length === 0) {
				setGenerationProgress({
					step: 0,
					message: '',
					isComplete: true,
				});
				setErrorMessage(
					'You need to explore some historical events before generating a quiz. Please visit the map and interact with some events first.',
				);
				setIsLoading(false);
				return;
			}

			// If quiz generation is successful
			if (data.success && data.quizId) {
				// Update progress with difficulty information
				const difficulty = data.difficulty || 'Beginner';

				setGenerationProgress({
					step: 4,
					message:
						data.message ||
						`${difficulty} quiz for path "${pathName}" successfully generated!`,
					isComplete: true,
				});

				setSuccessMessage(
					`${difficulty} quiz successfully generated for path "${pathName}"! Each question corresponds to a historical event from your journey.`,
				);

				// Refresh the quiz list
				setRefreshKey(prevKey => prevKey + 1);

				// Give user a moment to see the success message before redirecting
				setTimeout(() => {
					// Navigate to the new quiz
					router.push(`/quizzes/${data.quizId}`);
				}, 1500);
			} else {
				setGenerationProgress({
					step: 0,
					message: 'Something went wrong',
					isComplete: true,
				});

				setErrorMessage(
					'Quiz was created but something went wrong. Please check your quizzes.',
				);
			}
		} catch (error) {
			console.error('Error generating quiz:', error);
			setErrorMessage('An unexpected error occurred. Please try again.');
			setGenerationProgress({
				step: 0,
				message: 'Error encountered',
				isComplete: true,
			});
		} finally {
			setIsLoading(false);
		}
	};

	// Function to repair a quiz
	const handleRepairQuiz = async (quizId: string) => {
		setIsLoading(true);
		setErrorMessage(null);
		setSuccessMessage(null);

		try {
			// Get the current auth token
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session) {
				throw new Error('You need to be logged in to repair quizzes');
			}

			// Start the repair request
			const response = await fetch(`/api/quizzes/${quizId}/repair`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${session.access_token}`,
				},
				credentials: 'include',
			});

			const data = await response.json();

			if (!response.ok) {
				console.error('Quiz repair failed:', {
					status: response.status,
					statusText: response.statusText,
					error: data.error,
					message: data.message,
				});

				setErrorMessage(
					data.message || 'Failed to repair quiz. Please try again.',
				);
				setIsLoading(false);
				return;
			}

			// If repair is successful
			setSuccessMessage('Quiz repaired successfully!');

			// Refresh the quiz list
			setRefreshKey(prevKey => prevKey + 1);
		} catch (error) {
			console.error('Error repairing quiz:', error);
			setErrorMessage('An unexpected error occurred. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	// Function to get the associated attempt for a quiz
	const getQuizAttempt = (quizId: string) => {
		return attempts.find(attempt => attempt.quiz_id === quizId);
	};

	// Create a progress indicator component
	const QuizGenerationProgress = () => {
		if (generationProgress.step === 0) return null;

		return (
			<div className="my-4 p-6 bg-gray-800 border border-amber-700 rounded-lg shadow-md">
				<h3 className="font-bold text-lg text-amber-500 mb-3">
					Quiz Generation Progress
				</h3>
				<div className="w-full bg-gray-700 rounded-full h-3 my-4">
					<div
						className="bg-amber-500 h-3 rounded-full transition-all duration-500"
						style={{
							width: `${Math.min(100, (generationProgress.step / 4) * 100)}%`,
						}}
					></div>
				</div>
				<p className="text-sm text-amber-100 mb-2">
					{generationProgress.message}
				</p>
				{generationProgress.isComplete && (
					<p className="text-sm mt-2 text-green-400 font-medium">
						{generationProgress.step > 0
							? 'Completed successfully!'
							: 'Generation stopped.'}
					</p>
				)}
			</div>
		);
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-900 text-white p-6">
				<Link
					href="/profile"
					className="flex items-center text-amber-500 mb-6 hover:text-amber-400"
				>
					<FiArrowLeft className="mr-2" /> Back to Profile
				</Link>

				{isLoading && (
					<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
						<div className="bg-gray-800 p-6 rounded-lg max-w-md w-full shadow-xl">
							<div className="flex flex-col items-center">
								<div className="w-16 h-16 border-t-4 border-b-4 border-amber-500 rounded-full animate-spin mb-4"></div>
								{generationProgress && (
									<div className="text-center">
										<div className="mb-2 font-semibold">
											{generationProgress.step > 0
												? `Step ${generationProgress.step}`
												: ''}
										</div>
										<p className="text-gray-300">
											{generationProgress.message}
										</p>
										{generationProgress.step === 3 && (
											<div className="w-full bg-gray-700 h-2 mt-4 rounded-full overflow-hidden">
												<div className="bg-amber-500 h-full rounded-full animate-pulse"></div>
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				<h1 className="text-3xl font-bold mb-6">Your Quizzes</h1>

				{errorMessage && (
					<div className="bg-red-900/50 border border-red-500 text-white p-4 rounded-lg mb-6">
						<p className="font-medium">{errorMessage}</p>
						{errorMessage.includes(
							'explore some historical events',
						) && (
							<div className="mt-4">
								<Link
									href="/map"
									className="inline-flex items-center bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg"
								>
									<FiMap className="mr-2" /> Explore Map
								</Link>
							</div>
						)}
					</div>
				)}

				{successMessage && (
					<div className="bg-green-900/50 border border-green-500 text-white p-4 rounded-lg mb-6">
						<p>{successMessage}</p>
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
					{/* Sidebar with Quiz Generation Options */}
					<div className="bg-gray-800 p-6 rounded-lg lg:col-span-1 h-max">
						<h2 className="text-xl font-semibold mb-4">
							Generate Quiz
						</h2>

						{/* Generate from recent events */}
						<div className="mb-6">
							<h3 className="text-lg font-medium mb-2 text-amber-500">
								From Recent Events
							</h3>
							<p className="mb-4 text-gray-300 text-sm">
								Create a quiz based on historical events you've
								recently interacted with on the map.
							</p>
							<button
								onClick={handleGenerateQuiz}
								disabled={isLoading}
								className={`w-full py-2 px-4 rounded-lg ${
									isLoading
										? 'bg-gray-700 text-gray-400 cursor-not-allowed'
										: 'bg-amber-600 hover:bg-amber-700 text-white'
								}`}
							>
								{isLoading ? 'Generating...' : 'Generate Quiz'}
							</button>
						</div>

						{/* Divider */}
						<div className="border-t border-gray-700 my-6"></div>

						{/* Generate from paths */}
						<div>
							<h3 className="text-lg font-medium mb-2 text-amber-500">
								From Your Paths
							</h3>
							{userPaths && userPaths.length > 0 ? (
								<>
									<p className="mb-4 text-gray-300 text-sm">
										Create a quiz based on a specific
										historical path you've explored.
									</p>
									<div className="space-y-3">
										{userPaths.map(path => (
											<div
												key={path.id}
												className="bg-gray-700 p-3 rounded-lg hover:bg-gray-600 transition-colors"
											>
												<h4 className="font-medium">
													{path.name}
												</h4>
												<p className="text-xs text-gray-400 mb-2">
													Created{' '}
													{new Date(
														path.created_at,
													).toLocaleDateString()}
												</p>
												<button
													onClick={() =>
														handleGenerateQuizFromPath(
															path.id,
															path.name,
														)
													}
													disabled={isLoading}
													className={`w-full mt-2 py-1.5 px-3 rounded ${
														isLoading
															? 'bg-gray-800 text-gray-500 cursor-not-allowed'
															: 'bg-amber-600 hover:bg-amber-700 text-white text-sm'
													}`}
												>
													Generate Quiz
												</button>
											</div>
										))}
									</div>
								</>
							) : (
								<div className="bg-gray-700 p-4 rounded-lg">
									<p className="text-gray-300 mb-3">
										You haven't created any historical paths
										yet.
									</p>
									<Link
										href="/map"
										className="inline-flex items-center bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-sm"
									>
										<FiMap className="mr-2" /> Explore Map
									</Link>
								</div>
							)}
						</div>
					</div>

					{/* Quizzes List */}
					<div className="bg-gray-800 p-6 rounded-lg lg:col-span-3">
						<h2 className="text-xl font-semibold mb-4">
							Your Quiz History
						</h2>

						{quizzes.length > 0 ? (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{quizzes.map(quiz => {
									const attempt = getQuizAttempt(quiz.id);
									const quizStatus = attempt
										? 'completed'
										: 'not-taken';

									return (
										<div
											key={quiz.id}
											className={`bg-gray-700 rounded-lg shadow overflow-hidden border-l-4 ${
												quizStatus === 'completed'
													? 'border-green-500'
													: 'border-amber-500'
											}`}
										>
											<div className="p-5">
												<div className="flex justify-between">
													<h3 className="font-bold text-lg mb-1 truncate text-white">
														{quiz.title}
													</h3>
													<span className="text-xs bg-gray-600 text-amber-300 px-2 py-1 rounded">
														{quiz.difficulty}
													</span>
												</div>

												<p className="text-gray-300 text-sm mb-3 line-clamp-2">
													{quiz.description}
												</p>

												<div className="flex items-center text-sm text-gray-400 mb-3">
													<span className="mr-3">
														{quiz.question_count}{' '}
														questions
													</span>
													<span>
														Created{' '}
														{new Date(
															quiz.created_at,
														).toLocaleDateString()}
													</span>
												</div>

												<div className="flex flex-wrap gap-2">
													<Link
														href={`/quizzes/${quiz.id}`}
														className="bg-amber-600 hover:bg-amber-700 text-white text-sm py-1 px-3 rounded"
													>
														{quizStatus ===
														'completed'
															? 'Review'
															: 'Take Quiz'}
													</Link>

													{/* Repair option */}
													{quiz.question_count ===
														0 && (
														<button
															onClick={() =>
																handleRepairQuiz(
																	quiz.id,
																)
															}
															className="bg-gray-600 hover:bg-gray-700 text-white text-sm py-1 px-3 rounded"
														>
															Repair Quiz
														</button>
													)}

													{quizStatus ===
														'completed' && (
														<div className="ml-auto text-sm text-amber-400">
															Score:{' '}
															{Math.round(
																(attempt?.score ||
																	0) * 100,
															)}
															%
														</div>
													)}
												</div>
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<div className="text-center p-6">
								<p className="text-gray-300">
									You haven't created any quizzes yet.
								</p>
								<p className="text-gray-400 text-sm mt-2">
									Generate your first quiz to get started!
								</p>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="px-4 py-6">
			<h1 className="text-3xl font-bold mb-4 text-white text-center">
				Your Quizzes
			</h1>

			{/* Error message display */}
			{errorMessage && (
				<div className="bg-red-900 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4 max-w-3xl mx-auto">
					<span className="block sm:inline">{errorMessage}</span>
				</div>
			)}

			{/* Success message display */}
			{successMessage && (
				<div className="bg-green-900 border border-green-500 text-green-200 px-4 py-3 rounded-lg mb-4 max-w-3xl mx-auto">
					<span className="block sm:inline">{successMessage}</span>
				</div>
			)}

			{/* Quiz generation progress */}
			{generationProgress.step > 0 && (
				<div className="max-w-3xl mx-auto mb-4">
					<QuizGenerationProgress />
				</div>
			)}

			{/* Main content */}
			<div className="grid grid-cols-12 gap-4 max-w-7xl mx-auto">
				{/* Left panel - Generate options */}
				<div className="col-span-12 lg:col-span-4">
					<div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
						<h2 className="text-xl font-semibold mb-4 text-amber-500">
							Create New Quiz
						</h2>

						{/* Generic quiz generation button */}
						<div className="mb-8">
							<h3 className="text-lg font-medium mb-2 text-white">
								From Recent Events
							</h3>
							<p className="text-sm text-gray-300 mb-3">
								Generate a quiz based on all {eventCount}{' '}
								historical events you've explored.
							</p>
							<button
								onClick={handleGenerateQuiz}
								disabled={isLoading}
								className={`bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded ${
									isLoading
										? 'opacity-50 cursor-not-allowed'
										: ''
								}`}
							>
								{isLoading ? 'Generating...' : 'Generate Quiz'}
							</button>
						</div>

						{/* Path-based quiz options */}
						{userPaths.length > 0 && (
							<div>
								<h3 className="text-lg font-medium mb-2 text-white">
									From Your Paths
								</h3>
								<p className="text-sm text-gray-300 mb-3">
									Generate quizzes based on specific
									historical paths you've taken
								</p>
								<div className="space-y-3">
									{userPaths.map(path => (
										<div
											key={path.id}
											className="border border-gray-600 p-3 rounded bg-gray-700"
										>
											<h4 className="font-medium text-amber-400">
												{path.search_term ||
													path.name ||
													'Historical Path'}
											</h4>
											<p className="text-xs text-gray-400 mb-2">
												Created{' '}
												{new Date(
													path.created_at,
												).toLocaleDateString()}
											</p>
											<button
												onClick={() =>
													handleGenerateQuizFromPath(
														path.id,
														path.search_term ||
															path.name ||
															'Historical Path',
													)
												}
												disabled={isLoading}
												className="bg-amber-600 hover:bg-amber-700 text-white text-sm py-1 px-3 rounded mr-2"
											>
												Generate Quiz
											</button>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Right panel - Existing quizzes */}
				<div className="col-span-12 lg:col-span-8">
					<div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-700">
						<h2 className="text-xl font-semibold mb-4 text-amber-500">
							Your Existing Quizzes
						</h2>

						{quizzes.length === 0 ? (
							<div className="text-center p-6">
								<p className="text-gray-300">
									You haven't created any quizzes yet.
								</p>
								<p className="text-gray-400 text-sm mt-2">
									Generate your first quiz to get started!
								</p>
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{quizzes.map(quiz => {
									const attempt = getQuizAttempt(quiz.id);
									const quizStatus = attempt
										? 'completed'
										: 'not-taken';

									return (
										<div
											key={quiz.id}
											className={`bg-gray-700 rounded-lg shadow overflow-hidden border-l-4 ${
												quizStatus === 'completed'
													? 'border-green-500'
													: 'border-amber-500'
											}`}
										>
											<div className="p-5">
												<div className="flex justify-between">
													<h3 className="font-bold text-lg mb-1 truncate text-white">
														{quiz.title}
													</h3>
													<span className="text-xs bg-gray-600 text-amber-300 px-2 py-1 rounded">
														{quiz.difficulty}
													</span>
												</div>

												<p className="text-gray-300 text-sm mb-3 line-clamp-2">
													{quiz.description}
												</p>

												<div className="flex items-center text-sm text-gray-400 mb-3">
													<span className="mr-3">
														{quiz.question_count}{' '}
														questions
													</span>
													<span>
														Created{' '}
														{new Date(
															quiz.created_at,
														).toLocaleDateString()}
													</span>
												</div>

												<div className="flex flex-wrap gap-2">
													<Link
														href={`/quizzes/${quiz.id}`}
														className="bg-amber-600 hover:bg-amber-700 text-white text-sm py-1 px-3 rounded"
													>
														{quizStatus ===
														'completed'
															? 'Review'
															: 'Take Quiz'}
													</Link>

													{/* Repair option */}
													{quiz.question_count ===
														0 && (
														<button
															onClick={() =>
																handleRepairQuiz(
																	quiz.id,
																)
															}
															className="bg-gray-600 hover:bg-gray-700 text-white text-sm py-1 px-3 rounded"
														>
															Repair Quiz
														</button>
													)}

													{quizStatus ===
														'completed' && (
														<div className="ml-auto text-sm text-amber-400">
															Score:{' '}
															{Math.round(
																(attempt?.score ||
																	0) * 100,
															)}
															%
														</div>
													)}
												</div>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default ProfileQuizzes;
