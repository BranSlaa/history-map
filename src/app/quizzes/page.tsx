'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Quiz } from '@/types/quiz';
import { getNextQuizSuggestions } from '@/utils/adaptiveDifficultyUtils';
import supabase from '@/lib/supabaseClient';

interface QuizWithCreator extends Quiz {
	creator?: {
		id: string;
		username?: string;
		first_name?: string;
		last_name?: string;
	};
}

const PublicQuizzesPage: React.FC = () => {
	const { user, profile } = useAuth();
	const router = useRouter();
	const [quizzes, setQuizzes] = useState<QuizWithCreator[]>([]);
	const [recommendedQuizzes, setRecommendedQuizzes] = useState<
		QuizWithCreator[]
	>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [filter, setFilter] = useState('all'); // all, beginner, intermediate, advanced

	// Fetch public quizzes and recommended quizzes
	useEffect(() => {
		const fetchQuizzes = async () => {
			setIsLoading(true);
			try {
				// Fetch public quizzes
				const response = await fetch('/api/quizzes?limit=50');
				if (response.ok) {
					const data = await response.json();
					setQuizzes(data);

					// If user is logged in, fetch recommended quizzes
					if (user?.id) {
						const { data: attempts } = await supabase
							.from('quiz_attempts')
							.select('*')
							.eq('user_id', user.id)
							.order('completed_at', { ascending: false })
							.limit(1);

						const currentDifficulty = attempts?.[0]?.quiz_id
							? data.find(
									(q: Quiz) => q.id === attempts[0].quiz_id,
								)?.difficulty || 'beginner'
							: 'beginner';

						const suggestions = await getNextQuizSuggestions(
							user.id,
							currentDifficulty,
							supabase,
						);
						setRecommendedQuizzes(suggestions);
					}
				} else {
					const errorData = await response
						.json()
						.catch(() => ({ error: 'Unknown error' }));
					console.error(
						'Failed to fetch public quizzes:',
						response.statusText,
						errorData,
					);
				}
			} catch (error) {
				console.error('Error fetching quizzes:', error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchQuizzes();
	}, [user?.id]);

	// Filter quizzes based on difficulty
	const filteredQuizzes =
		filter === 'all'
			? quizzes
			: quizzes.filter(quiz => quiz.difficulty === filter);

	// Function to get a relative time string (e.g., "2 days ago")
	const getRelativeTimeString = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSecs = Math.floor(diffMs / 1000);
		const diffMins = Math.floor(diffSecs / 60);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffDays > 0) {
			return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
		} else if (diffHours > 0) {
			return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
		} else if (diffMins > 0) {
			return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
		} else {
			return 'Just now';
		}
	};

	// Determine difficulty badge color
	const getDifficultyBadgeClass = (difficulty: string) => {
		switch (difficulty) {
			case 'beginner':
				return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100';
			case 'intermediate':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100';
			case 'advanced':
				return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
		}
	};

	// Handle taking a quiz
	const handleTakeQuiz = (quizId: string) => {
		// Always navigate to the quiz page, regardless of login status
		// Auth will be handled on the quiz page itself as needed
		router.push(`/quizzes/${quizId}`);
	};

	// Helper function to get creator name display
	const getCreatorName = (quiz: QuizWithCreator) => {
		if (!quiz.creator) return 'Anonymous';

		if (quiz.creator.username) {
			return quiz.creator.username;
		}

		if (quiz.creator.first_name || quiz.creator.last_name) {
			return `${quiz.creator.first_name || ''} ${quiz.creator.last_name || ''}`.trim();
		}

		return 'Anonymous';
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-amber-500"></div>
			</div>
		);
	}

	return (
		<div className="px-4 py-6">
			<h1 className="text-3xl font-bold mb-6 text-white text-center">
				Public Quizzes
			</h1>

			<div className="max-w-7xl mx-auto">
				{user && recommendedQuizzes.length > 0 && (
					<div className="mb-8">
						<h2 className="text-2xl font-bold mb-4 text-amber-500">
							Recommended For You
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{recommendedQuizzes.map(quiz => (
								<div
									key={quiz.id}
									className="bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-700"
								>
									<div className="p-5">
										<div className="flex justify-between">
											<h3 className="font-bold text-lg mb-1 truncate text-white">
												{quiz.title}
											</h3>
											<span
												className={`text-xs px-2 py-1 rounded-full ${getDifficultyBadgeClass(
													quiz.difficulty.toLowerCase(),
												)}`}
											>
												{quiz.difficulty}
											</span>
										</div>
										<p className="text-gray-300 text-sm mb-3">
											{quiz.description}
										</p>
										<div className="flex items-center text-sm text-gray-400 mb-2">
											<span className="mr-3">
												{quiz.question_count} questions
											</span>
											<span>
												{getRelativeTimeString(
													quiz.created_at,
												)}
											</span>
										</div>
										{quiz.creator && (
											<div className="flex items-center text-sm text-amber-400 mb-3">
												<span>
													Created by{' '}
													{getCreatorName(quiz)}
												</span>
											</div>
										)}
										<button
											onClick={() =>
												handleTakeQuiz(quiz.id)
											}
											className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded"
										>
											Take Quiz
										</button>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				<div>
					<h2 className="text-2xl font-bold mb-4 text-amber-500">
						All Quizzes
					</h2>
					<div className="mb-6 flex flex-wrap gap-3">
						<button
							onClick={() => setFilter('all')}
							className={`px-4 py-2 rounded-full ${
								filter === 'all'
									? 'bg-amber-600 text-white'
									: 'bg-gray-800 text-gray-300 hover:bg-gray-700'
							}`}
						>
							All
						</button>
						<button
							onClick={() => setFilter('beginner')}
							className={`px-4 py-2 rounded-full ${
								filter === 'beginner'
									? 'bg-amber-600 text-white'
									: 'bg-gray-800 text-gray-300 hover:bg-gray-700'
							}`}
						>
							Beginner
						</button>
						<button
							onClick={() => setFilter('intermediate')}
							className={`px-4 py-2 rounded-full ${
								filter === 'intermediate'
									? 'bg-amber-600 text-white'
									: 'bg-gray-800 text-gray-300 hover:bg-gray-700'
							}`}
						>
							Intermediate
						</button>
						<button
							onClick={() => setFilter('advanced')}
							className={`px-4 py-2 rounded-full ${
								filter === 'advanced'
									? 'bg-amber-600 text-white'
									: 'bg-gray-800 text-gray-300 hover:bg-gray-700'
							}`}
						>
							Advanced
						</button>
					</div>

					{filteredQuizzes.length > 0 ? (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{filteredQuizzes.map(quiz => (
								<div
									key={quiz.id}
									className="bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-700"
								>
									<div className="p-5">
										<div className="flex justify-between">
											<h3 className="font-bold text-lg mb-1 truncate text-white">
												{quiz.title}
											</h3>
											<span
												className={`text-xs px-2 py-1 rounded-full ${getDifficultyBadgeClass(
													quiz.difficulty.toLowerCase(),
												)}`}
											>
												{quiz.difficulty}
											</span>
										</div>
										<p className="text-gray-300 text-sm mb-3">
											{quiz.description}
										</p>
										<div className="flex items-center text-sm text-gray-400 mb-2">
											<span className="mr-3">
												{quiz.question_count} questions
											</span>
											<span>
												{getRelativeTimeString(
													quiz.created_at,
												)}
											</span>
										</div>
										{quiz.creator && (
											<div className="flex items-center text-sm text-amber-400 mb-3">
												<span>
													Created by{' '}
													{getCreatorName(quiz)}
												</span>
											</div>
										)}
										<button
											onClick={() =>
												handleTakeQuiz(quiz.id)
											}
											className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded"
										>
											Take Quiz
										</button>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="bg-gray-800 p-10 rounded-lg text-center border border-gray-700">
							<p className="text-gray-300">
								No quizzes found for the selected filter.
							</p>
							<p className="text-gray-400 text-sm mt-2">
								Try selecting a different difficulty level.
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default PublicQuizzesPage;
