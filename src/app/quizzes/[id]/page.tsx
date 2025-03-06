'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/app/components/Header';
import supabase from '@/lib/supabaseClient';
import Link from 'next/link';

interface Question {
	id: string;
	text: string;
	explanation: string;
	options: {
		id: string;
		text: string;
		isCorrect: boolean;
	}[];
}

interface QuizDetails {
	id: string;
	title: string;
	description: string;
	subject: string;
	topic: string;
	difficulty: string;
	question_count: number;
	created_at: string;
	creator?: {
		id: string;
		username?: string;
		first_name?: string;
		last_name?: string;
	};
	questions: Question[];
}

const QuizPage: React.FC = () => {
	const params = useParams();
	const router = useRouter();
	const quizId = params?.id as string;
	const { user, profile, loading } = useAuth();

	const [quiz, setQuiz] = useState<QuizDetails | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [selectedAnswers, setSelectedAnswers] = useState<
		Record<string, string>
	>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [quizCompleted, setQuizCompleted] = useState(false);
	const [score, setScore] = useState(0);
	const [showAuthPrompt, setShowAuthPrompt] = useState(false);

	useEffect(() => {
		const fetchQuizDetails = async () => {
			if (!quizId) return;

			setIsLoading(true);
			try {
				console.log('Fetching quiz with ID:', quizId);
				const response = await fetch(`/api/quizzes/${quizId}`);

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					console.error(
						'Failed to fetch quiz details:',
						response.status,
						response.statusText,
						errorData,
					);
					return;
				}

				const data = await response.json();
				console.log('Quiz data received:', data);
				setQuiz(data);
			} catch (error) {
				console.error('Error fetching quiz details:', error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchQuizDetails();
	}, [quizId]);

	const selectAnswer = (questionId: string, optionId: string) => {
		setSelectedAnswers({
			...selectedAnswers,
			[questionId]: optionId,
		});
	};

	const nextQuestion = () => {
		if (!quiz) return;

		if (currentQuestionIndex < quiz.questions.length - 1) {
			setCurrentQuestionIndex(currentQuestionIndex + 1);
		}
	};

	const previousQuestion = () => {
		if (currentQuestionIndex > 0) {
			setCurrentQuestionIndex(currentQuestionIndex - 1);
		}
	};

	const handleSubmitQuiz = async () => {
		if (!quiz) return;

		// Check if user is authenticated
		if (!user && !profile) {
			setShowAuthPrompt(true);
			return;
		}

		setIsSubmitting(true);

		// Calculate score
		let correctCount = 0;
		quiz.questions.forEach(question => {
			const userAnswer = selectedAnswers[question.id];
			const correctOption = question.options.find(
				option => option.isCorrect,
			);

			if (
				userAnswer &&
				correctOption &&
				userAnswer === correctOption.id
			) {
				correctCount++;
			}
		});

		const calculatedScore = Math.round(
			(correctCount / quiz.questions.length) * 100,
		);
		setScore(calculatedScore);

		// Save quiz attempt if authenticated
		if (user || profile) {
			const userId = user?.id || profile?.id;

			try {
				const { error } = await supabase.from('quiz_attempts').insert({
					user_id: userId,
					quiz_id: quiz.id,
					score: calculatedScore,
					completed: true,
					started_at: new Date().toISOString(),
					completed_at: new Date().toISOString(),
					answers: selectedAnswers,
				});

				if (error) {
					console.error('Error saving quiz attempt:', error);
				}
			} catch (error) {
				console.error('Error saving quiz attempt:', error);
			}
		}

		setQuizCompleted(true);
		setIsSubmitting(false);
	};

	const loginToContinue = () => {
		router.push('/login');
	};

	if (isLoading) {
		return (
			<div className="container mx-auto p-6">
				<Header />
				<div className="max-w-4xl mx-auto mt-10">
					<h1 className="text-3xl font-bold mb-6">Loading Quiz...</h1>
					<div className="flex justify-center items-center h-64">
						<p className="text-lg">
							Please wait while we load the quiz
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (!quiz) {
		return (
			<div className="container mx-auto p-6">
				<Header />
				<div className="max-w-4xl mx-auto mt-10">
					<h1 className="text-3xl font-bold mb-6">Quiz Not Found</h1>
					<p className="mb-4">
						Sorry, we couldn't find the quiz you're looking for.
					</p>
					<Link
						href="/quizzes"
						className="text-blue-500 hover:text-blue-600"
					>
						Back to Quizzes
					</Link>
				</div>
			</div>
		);
	}

	if (quizCompleted) {
		return (
			<div className="container mx-auto p-6">
				<Header />
				<div className="max-w-4xl mx-auto mt-10">
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
						<h1 className="text-3xl font-bold mb-6">
							Quiz Completed!
						</h1>
						<p className="text-xl mb-4">
							Your score:{' '}
							<span className="font-bold">{score}%</span>
						</p>
						<p className="mb-6">
							Thank you for completing the quiz on {quiz.subject}:{' '}
							{quiz.topic}.
						</p>
						<div className="flex space-x-4">
							<Link
								href="/quizzes"
								className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
							>
								Browse More Quizzes
							</Link>
							<Link
								href="/"
								className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
							>
								Back to Home
							</Link>
						</div>
					</div>
				</div>
			</div>
		);
	}

	const currentQuestion = quiz.questions[currentQuestionIndex];
	const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;
	const isFirstQuestion = currentQuestionIndex === 0;
	const allQuestionsAnswered = quiz.questions.every(
		q => selectedAnswers[q.id],
	);

	return (
		<div className="container mx-auto p-6">
			<Header />
			<div className="max-w-4xl mx-auto mt-10">
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
					<div className="mb-8">
						<h1 className="text-3xl font-bold mb-2">
							{quiz.title}
						</h1>
						<p className="text-gray-600 dark:text-gray-300 mb-4">
							{quiz.description}
						</p>
						<div className="flex flex-wrap gap-2 text-sm">
							<span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded">
								{quiz.subject}
							</span>
							<span className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 rounded">
								{quiz.topic}
							</span>
							<span className="px-2 py-1 bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-100 rounded">
								{quiz.difficulty.charAt(0).toUpperCase() +
									quiz.difficulty.slice(1)}
							</span>
							<span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded">
								{quiz.question_count} questions
							</span>
						</div>
					</div>

					{/* Progress indicator */}
					<div className="mb-6">
						<div className="flex justify-between text-sm mb-1">
							<span>
								Question {currentQuestionIndex + 1} of{' '}
								{quiz.questions.length}
							</span>
							<span>
								{Object.keys(selectedAnswers).length} of{' '}
								{quiz.questions.length} answered
							</span>
						</div>
						<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
							<div
								className="bg-blue-500 h-2.5 rounded-full"
								style={{
									width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%`,
								}}
							></div>
						</div>
					</div>

					{/* Current question */}
					<div className="mb-8">
						<h2 className="text-xl font-semibold mb-4">
							{currentQuestion.text}
						</h2>
						<div className="space-y-3">
							{currentQuestion.options.map(option => (
								<div
									key={option.id}
									className={`p-4 border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
										selectedAnswers[currentQuestion.id] ===
										option.id
											? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
											: 'border-gray-200 dark:border-gray-700'
									}`}
									onClick={() =>
										selectAnswer(
											currentQuestion.id,
											option.id,
										)
									}
								>
									{option.text}
								</div>
							))}
						</div>
					</div>

					{/* Auth prompt overlay */}
					{showAuthPrompt && (
						<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
							<div className="bg-white dark:bg-gray-800 p-8 rounded-lg max-w-md w-full">
								<h2 className="text-xl font-semibold mb-4">
									Sign in to Submit Quiz
								</h2>
								<p className="mb-6">
									You need to be signed in to submit your quiz
									answers and save your progress.
								</p>
								<div className="flex space-x-4">
									<button
										onClick={loginToContinue}
										className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
									>
										Sign In
									</button>
									<button
										onClick={() => setShowAuthPrompt(false)}
										className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
									>
										Continue Browsing
									</button>
								</div>
							</div>
						</div>
					)}

					{/* Navigation */}
					<div className="flex justify-between">
						<button
							onClick={previousQuestion}
							disabled={isFirstQuestion}
							className={`px-4 py-2 rounded ${
								isFirstQuestion
									? 'bg-gray-200 text-gray-400 cursor-not-allowed'
									: 'bg-gray-200 hover:bg-gray-300 text-gray-800'
							}`}
						>
							Previous
						</button>

						{isLastQuestion ? (
							<button
								onClick={handleSubmitQuiz}
								disabled={
									isSubmitting ||
									!selectedAnswers[currentQuestion.id]
								}
								className={`px-4 py-2 rounded ${
									isSubmitting ||
									!selectedAnswers[currentQuestion.id]
										? 'bg-green-300 cursor-not-allowed'
										: 'bg-green-500 hover:bg-green-600 text-white'
								}`}
							>
								{isSubmitting ? 'Submitting...' : 'Submit Quiz'}
							</button>
						) : (
							<button
								onClick={nextQuestion}
								disabled={!selectedAnswers[currentQuestion.id]}
								className={`px-4 py-2 rounded ${
									!selectedAnswers[currentQuestion.id]
										? 'bg-blue-300 cursor-not-allowed'
										: 'bg-blue-500 hover:bg-blue-600 text-white'
								}`}
							>
								Next
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default QuizPage;
