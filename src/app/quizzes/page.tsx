'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Header } from '../components/Header';
import { Quiz } from '@/types/quiz';

const PublicQuizzesPage: React.FC = () => {
	const { user, profile } = useAuth();
	const router = useRouter();
	const [quizzes, setQuizzes] = useState<Quiz[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [filter, setFilter] = useState('all'); // all, beginner, intermediate, advanced

	// Fetch public quizzes
	useEffect(() => {
		const fetchPublicQuizzes = async () => {
			setIsLoading(true);
			try {
				const response = await fetch('/api/quizzes?limit=50');
				if (response.ok) {
					const data = await response.json();
					setQuizzes(data);
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

		fetchPublicQuizzes();
	}, []);

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
				return 'bg-green-100 text-green-800';
			case 'intermediate':
				return 'bg-blue-100 text-blue-800';
			case 'advanced':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	};

	// Handle taking a quiz
	const handleTakeQuiz = (quizId: string) => {
		// Always navigate to the quiz page, regardless of login status
		// Auth will be handled on the quiz page itself as needed
		router.push(`/quizzes/${quizId}`);
	};

	if (isLoading) {
		return (
			<div className="container mx-auto p-6">
				<Header />
				<div className="max-w-6xl mx-auto mt-10">
					<h1 className="text-3xl font-bold mb-6">Public Quizzes</h1>
					<div className="flex justify-center items-center h-64">
						<p className="text-lg">Loading quizzes...</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto p-6">
			<Header />
			<div className="max-w-6xl mx-auto mt-10">
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-3xl font-bold">Public Quizzes</h1>
					<div className="flex space-x-2">
						<button
							onClick={() => setFilter('all')}
							className={`px-4 py-2 rounded ${
								filter === 'all'
									? 'bg-blue-500 text-white'
									: 'bg-gray-200 text-gray-700 hover:bg-gray-300'
							}`}
						>
							All
						</button>
						<button
							onClick={() => setFilter('beginner')}
							className={`px-4 py-2 rounded ${
								filter === 'beginner'
									? 'bg-green-500 text-white'
									: 'bg-gray-200 text-gray-700 hover:bg-gray-300'
							}`}
						>
							Beginner
						</button>
						<button
							onClick={() => setFilter('intermediate')}
							className={`px-4 py-2 rounded ${
								filter === 'intermediate'
									? 'bg-blue-500 text-white'
									: 'bg-gray-200 text-gray-700 hover:bg-gray-300'
							}`}
						>
							Intermediate
						</button>
						<button
							onClick={() => setFilter('advanced')}
							className={`px-4 py-2 rounded ${
								filter === 'advanced'
									? 'bg-red-500 text-white'
									: 'bg-gray-200 text-gray-700 hover:bg-gray-300'
							}`}
						>
							Advanced
						</button>
					</div>
				</div>

				{filteredQuizzes.length === 0 ? (
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
						<h2 className="text-xl mb-4">No quizzes found</h2>
						<p className="mb-4">
							{filter === 'all'
								? 'There are no quizzes available at the moment.'
								: `There are no ${filter} quizzes available at the moment.`}
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{filteredQuizzes.map(quiz => (
							<div
								key={quiz.id}
								className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200"
							>
								<div className="p-6">
									<div className="flex justify-between items-start mb-2">
										<h2 className="text-xl font-semibold mb-2 flex-1">
											{quiz.title}
										</h2>
										<span
											className={`text-xs px-2 py-1 rounded-full ${getDifficultyBadgeClass(
												quiz.difficulty,
											)}`}
										>
											{quiz.difficulty
												.charAt(0)
												.toUpperCase() +
												quiz.difficulty.slice(1)}
										</span>
									</div>
									<p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
										{quiz.description}
									</p>

									<div className="text-sm text-gray-500 mb-4">
										<p>
											{quiz.question_count || 0} questions
										</p>
										<p>
											Created{' '}
											{quiz.created_at &&
												getRelativeTimeString(
													quiz.created_at,
												)}
										</p>
										{quiz.creator && (
											<p>
												By:{' '}
												{quiz.creator.username ||
													quiz.creator.first_name ||
													'Anonymous'}
											</p>
										)}
									</div>

									<button
										onClick={() => handleTakeQuiz(quiz.id)}
										className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded transition-colors duration-200"
									>
										Take Quiz
									</button>
								</div>
							</div>
						))}
					</div>
				)}

				<div className="mt-8 text-center">
					<Link
						href="/"
						className="text-blue-500 hover:text-blue-600"
					>
						Back to Home
					</Link>
				</div>
			</div>
		</div>
	);
};

export default PublicQuizzesPage;
