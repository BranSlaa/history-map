'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import supabase from '@/lib/supabaseClient';
import { Header } from '../../components/Header';
import { Quiz, QuizAttempt } from '@/types/quiz';
import Link from 'next/link';

const ProfileQuizzes: React.FC = () => {
	const { user, profile, loading } = useAuth();
	const router = useRouter();
	const [quizzes, setQuizzes] = useState<Quiz[]>([]);
	const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
	const [isLoading, setIsLoading] = useState(true);

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
					<Link
						href="/profile"
						className="text-blue-500 hover:text-blue-600"
					>
						Back to Profile
					</Link>
				</div>

				{quizzes.length === 0 ? (
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
						<h2 className="text-xl mb-4">No quizzes yet</h2>
						<p className="mb-4">
							Continue exploring history to unlock quizzes!
						</p>
						<p className="text-sm text-gray-500 mb-4">
							Quizzes are generated after every 3 interactions
							(searches or connections).
						</p>
						<div className="flex flex-col sm:flex-row justify-center gap-4">
							<button
								onClick={() => router.push('/')}
								className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
							>
								Explore History
							</button>
							<button
								onClick={async () => {
									try {
										const userId = user?.id || profile?.id;
										if (!userId) {
											alert(
												'You must be logged in to generate a quiz',
											);
											return;
										}

										setIsLoading(true);
										const response = await fetch(
											'/api/quizzes/generate',
											{
												method: 'POST',
												headers: {
													'Content-Type':
														'application/json',
												},
												body: JSON.stringify({
													forceGenerate: true,
													userId,
												}),
											},
										);

										if (response.ok) {
											const result =
												await response.json();
											alert(
												`Test quiz generated: "${result.title || 'New Quiz'}"! Refreshing page...`,
											);
											window.location.reload();
										} else {
											const errorData = await response
												.json()
												.catch(() => ({
													error: 'Unknown error',
												}));
											alert(
												`Failed to generate quiz: ${errorData.error || response.statusText || 'Unknown error'}`,
											);
											console.error(
												'Quiz generation error:',
												errorData,
											);
										}
									} catch (error) {
										console.error(
											'Error generating test quiz:',
											error,
										);
										alert(
											'Failed to generate test quiz. See console for details.',
										);
									} finally {
										setIsLoading(false);
									}
								}}
								className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
							>
								Generate Test Quiz
							</button>
						</div>
					</div>
				) : (
					<div className="space-y-4">
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
														Score: {attempt.score}%
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
				)}
			</div>
		</div>
	);
};

export default ProfileQuizzes;
