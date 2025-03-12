'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Quiz, QuizAttempt } from '@/types/quiz';
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
		setIsLoading(true);
		setErrorMessage(null);
		setSuccessMessage(null);
		setGenerationProgress({
			step: 1,
			message: 'Starting quiz generation...',
			isComplete: false,
		});

		try {
			setGenerationProgress({
				step: 2,
				message:
					'Authenticating and analyzing your previous quiz performance...',
				isComplete: false,
			});

			const response = await fetch('/api/quizzes/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
			});

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
		setIsLoading(false);
	}, [user]);

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
				setIsLoading(false);
			} catch (error) {
				console.error('Error fetching quizzes:', error);
				setIsLoading(false);
			}
		};

		fetchUserQuizzes();
	}, [user, refreshKey, fetchUserPaths]);

	// Function to handle quiz generation from path
	const handleGenerateQuizFromPath = async (
		pathId: string,
		pathName: string,
	) => {
		setIsLoading(true);
		setErrorMessage(null);
		setSuccessMessage(null);
		setGenerationProgress({
			step: 1,
			message: `Starting generation of quiz for path "${pathName}"...`,
			isComplete: false,
		});

		try {
			setGenerationProgress({
				step: 2,
				message:
					'Authenticating and analyzing your previous quiz performance...',
				isComplete: false,
			});

			const response = await fetch('/api/quizzes/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					path_id: pathId,
					search_term: pathName,
				}),
				credentials: 'include',
			});

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
			const response = await fetch(`/api/quizzes/${quizId}/repair`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
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
			<div className="mb-6">
				<div className="bg-gray-100 p-4 rounded-lg">
					<div className="flex items-center mb-2">
						<div className="relative w-full bg-gray-200 rounded-full h-2.5">
							<div
								className="bg-blue-600 h-2.5 rounded-full"
								style={{
									width: `${(generationProgress.step / 4) * 100}%`,
								}}
							></div>
						</div>
						<span className="text-sm font-medium text-blue-700 ml-3">
							{generationProgress.step}/4
						</span>
					</div>
					<p className="text-sm text-gray-600">
						{generationProgress.message}
					</p>
				</div>
			</div>
		);
	};

	return (
		<div className="container mx-auto px-4 py-8 max-w-4xl">
			<div className="flex justify-between items-center mb-6">
				<div className="flex items-center gap-2">
					<Link
						href="/profile"
						className="text-gray-600 hover:text-blue-500"
					>
						<FiArrowLeft size={20} />
					</Link>
					<h1 className="text-2xl font-bold">Your Quizzes</h1>
				</div>
				<div className="flex gap-2">
					<Link
						href="/"
						className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
					>
						<FiMap className="mr-2" /> Back to Map
					</Link>
				</div>
			</div>

			{errorMessage && (
				<div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
					<p>{errorMessage}</p>
				</div>
			)}

			{successMessage && (
				<div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6">
					<p>{successMessage}</p>
				</div>
			)}

			<QuizGenerationProgress />

			<div className="bg-white rounded-lg shadow-md p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">
					Generate a New Quiz
				</h2>
				<p className="text-gray-600 mb-4">
					Create a personalized quiz based on your exploration
					history. The quiz will include questions about historical
					events you have discovered on your journey.
				</p>
				<button
					onClick={handleGenerateQuiz}
					disabled={isLoading || !canGenerateQuiz}
					className={`px-4 py-2 rounded-md text-white font-medium ${
						isLoading || !canGenerateQuiz
							? 'bg-gray-400 cursor-not-allowed'
							: 'bg-blue-600 hover:bg-blue-700'
					}`}
				>
					{isLoading ? 'Generating...' : 'Generate Quiz'}
				</button>
			</div>

			{userPaths.length > 0 && (
				<div className="bg-white rounded-lg shadow-md p-6 mb-6">
					<h2 className="text-xl font-semibold mb-4">
						Generate Quiz from Your Paths
					</h2>
					<p className="text-gray-600 mb-4">
						Create a quiz based on a specific exploration path.
					</p>
					<div className="space-y-4">
						{userPaths.map((path: any) => (
							<div
								key={path.id}
								className="border rounded-lg p-4 hover:bg-gray-50"
							>
								<div className="flex justify-between items-center">
									<div>
										<h3 className="font-medium">
											{path.name || 'Unnamed Path'}
										</h3>
										<p className="text-sm text-gray-500">
											Created:{' '}
											{new Date(
												path.created_at,
											).toLocaleDateString()}
										</p>
									</div>
									<button
										onClick={() =>
											handleGenerateQuizFromPath(
												path.id,
												path.name || 'Unnamed Path',
											)
										}
										disabled={isLoading}
										className={`px-3 py-1 rounded-md text-white text-sm font-medium ${
											isLoading
												? 'bg-gray-400 cursor-not-allowed'
												: 'bg-blue-600 hover:bg-blue-700'
										}`}
									>
										Generate Quiz
									</button>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			<div className="bg-white rounded-lg shadow-md p-6">
				<h2 className="text-xl font-semibold mb-4">Your Quizzes</h2>
				{isLoading ? (
					<p>Loading your quizzes...</p>
				) : quizzes.length === 0 ? (
					<p className="text-gray-600">
						You haven't created any quizzes yet. Generate a quiz to
						test your historical knowledge!
					</p>
				) : (
					<div className="space-y-4">
						{quizzes.map(quiz => {
							const attempt = getQuizAttempt(quiz.id);
							const hasAttempted = !!attempt;
							const score = hasAttempted ? attempt.score : null;

							return (
								<div
									key={quiz.id}
									className="border rounded-lg p-4 hover:bg-gray-50"
								>
									<div className="flex flex-col md:flex-row md:justify-between md:items-center">
										<div className="mb-4 md:mb-0">
											<h3 className="font-medium">
												{quiz.title}
											</h3>
											<p className="text-sm text-gray-500">
												{quiz.description ||
													'No description'}
											</p>
											<div className="flex flex-wrap gap-2 mt-2">
												<span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
													{quiz.difficulty}
												</span>
												<span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
													{quiz.subject}
												</span>
												<span className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
													{quiz.question_count}{' '}
													questions
												</span>
												{hasAttempted && (
													<span
														className={`inline-block text-white text-xs px-2 py-1 rounded ${
															score && score >= 70
																? 'bg-green-500'
																: score &&
																	  score >=
																			40
																	? 'bg-yellow-500'
																	: 'bg-red-500'
														}`}
													>
														Score: {score}%
													</span>
												)}
											</div>
										</div>
										<div className="flex flex-col sm:flex-row gap-2">
											<Link
												href={`/quizzes/${quiz.id}`}
												className="inline-block px-3 py-1 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 text-center"
											>
												{hasAttempted
													? 'Retake Quiz'
													: 'Start Quiz'}
											</Link>
											<button
												onClick={() =>
													handleRepairQuiz(quiz.id)
												}
												className="inline-block px-3 py-1 rounded-md bg-yellow-500 text-white text-sm font-medium hover:bg-yellow-600 text-center"
											>
												Repair Quiz
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
};

export default ProfileQuizzes;
