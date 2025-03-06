'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface QuizCreator {
	id: string;
	username?: string;
	first_name?: string;
	last_name?: string;
}

interface FeaturedQuiz {
	id: string;
	title: string;
	description: string;
	difficulty: string;
	subject: string;
	topic: string;
	question_count: number;
	created_at: string;
	creator?: QuizCreator;
}

const FeaturedQuizzes: React.FC = () => {
	const [quizzes, setQuizzes] = useState<FeaturedQuiz[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const router = useRouter();
	const { user, profile } = useAuth();

	useEffect(() => {
		const fetchFeaturedQuizzes = async () => {
			setIsLoading(true);
			try {
				const response = await fetch(
					'/api/quizzes?featured=true&limit=3',
				);
				if (response.ok) {
					const data = await response.json();
					setQuizzes(data);
				} else {
					console.error(
						'Failed to fetch featured quizzes:',
						response.statusText,
					);
				}
			} catch (error) {
				console.error('Error fetching featured quizzes:', error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchFeaturedQuizzes();
	}, []);

	const handleTakeQuiz = (quizId: string) => {
		// Always navigate to the quiz page, regardless of login status
		// Auth will be handled on the quiz page itself as needed
		router.push(`/quizzes/${quizId}`);
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

	if (isLoading) {
		return (
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<h2 className="text-2xl font-bold mb-6">Featured Quizzes</h2>
				<div className="h-40 flex items-center justify-center">
					<p className="text-gray-500">Loading featured quizzes...</p>
				</div>
			</div>
		);
	}

	if (quizzes.length === 0) {
		return null; // Don't show the section if there are no featured quizzes
	}

	return (
		<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
			<div className="flex justify-between items-center mb-6">
				<h2 className="text-2xl font-bold">Featured Quizzes</h2>
				<Link
					href="/quizzes"
					className="text-blue-500 hover:text-blue-600 transition-colors"
				>
					View all quizzes →
				</Link>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{quizzes.map(quiz => (
					<div
						key={quiz.id}
						className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200"
					>
						<div className="p-6">
							<div className="flex justify-between items-start mb-2">
								<h3 className="text-xl font-semibold mb-2 flex-1">
									{quiz.title}
								</h3>
								<span
									className={`text-xs px-2 py-1 rounded-full ${getDifficultyBadgeClass(
										quiz.difficulty,
									)}`}
								>
									{quiz.difficulty.charAt(0).toUpperCase() +
										quiz.difficulty.slice(1)}
								</span>
							</div>
							<p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
								{quiz.description}
							</p>

							<div className="flex justify-between items-center text-sm text-gray-500 mb-4">
								<span>{quiz.question_count} questions</span>
								<span>{quiz.topic}</span>
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
		</div>
	);
};

export default FeaturedQuizzes;
