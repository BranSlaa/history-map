'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import {
	FiArrowLeft,
	FiCheckCircle,
	FiXCircle,
	FiHelpCircle,
	FiChevronLeft,
	FiChevronRight,
} from 'react-icons/fi';

interface Question {
	id: string;
	question_text: string;
	explanation: string;
	options: {
		id: string;
		option_text: string;
		is_correct: boolean;
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
	previousAttempt?: {
		id: string;
		score: number;
		completed_at: string;
		answers?: {
			[key: string]: string;
		};
	};
	questions: Question[];
}

const QuizPage: React.FC = () => {
	const router = useRouter();
	const params = useParams();
	const { user, profile } = useAuth();
	const [quiz, setQuiz] = useState<QuizDetails | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [selectedAnswers, setSelectedAnswers] = useState<{
		[key: string]: string;
	}>({});
	const [quizCompleted, setQuizCompleted] = useState(false);
	const [score, setScore] = useState<number>(0);
	const [showAuthPrompt, setShowAuthPrompt] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isRepairing, setIsRepairing] = useState(false);

	useEffect(() => {
		const fetchQuizDetails = async () => {
			if (!params?.id) return;

			const quizId = Array.isArray(params.id) ? params.id[0] : params.id;

			try {
				const response = await fetch(`/api/quizzes/${quizId}`);
				if (!response.ok) {
					const errorData = await response
						.json()
						.catch(() => ({ error: 'Unknown error' }));
					console.error(
						'Failed to fetch quiz details:',
						response.statusText,
						errorData,
					);
					setError(
						`Failed to fetch quiz details: ${response.status} ${response.statusText}`,
					);
					return;
				}

				const data = await response.json();
				console.log('Quiz data received:', data);
				setQuiz(data);

				// If quiz has a previous attempt with answers, use those answers
				if (data.previousAttempt && data.previousAttempt.answers) {
					console.log(
						'Previous attempt found:',
						data.previousAttempt,
					);
					// The answers from previousAttempt might be in different format based on how they were stored
					// If it's a string, we need to parse it
					let previousAnswers = {};
					if (typeof data.previousAttempt.answers === 'string') {
						try {
							console.log(
								'Parsing answers string:',
								data.previousAttempt.answers,
							);
							previousAnswers = JSON.parse(
								data.previousAttempt.answers,
							);
						} catch (e) {
							console.error(
								'Failed to parse previous answers',
								e,
							);
							previousAnswers = {};
						}
					} else {
						console.log(
							'Previous answers as object:',
							data.previousAttempt.answers,
						);
						previousAnswers = data.previousAttempt.answers;
					}

					console.log('Setting previous answers:', previousAnswers);
					setSelectedAnswers(previousAnswers);

					// If we have previous answers, we should mark the quiz as completed
					if (Object.keys(previousAnswers).length > 0) {
						console.log(
							'Found previous answers, marking quiz as completed',
						);
						setQuizCompleted(true);
						setScore(data.previousAttempt.score || 0);
					}
				}
			} catch (error) {
				console.error('Error fetching quiz details:', error);
				setError(
					`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
				);
			} finally {
				setIsLoading(false);
			}
		};

		fetchQuizDetails();
	}, [params]);

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
				option => option.is_correct,
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
				console.log('Quiz attempt would be saved:', {
					user_id: userId,
					quiz_id: quiz.id,
					score: calculatedScore,
				});
			} catch (error) {
				console.error('Error saving quiz attempt:', error);
			}
		}

		setQuizCompleted(true);
		setIsSubmitting(false);
	};

	const handleRepairQuiz = async () => {
		if (!quiz?.id) return;
		setIsRepairing(true);

		try {
			// Get the current auth token
			// Removed direct Supabase auth call

			// Start the repair request
			const response = await fetch(`/api/quizzes/${quiz.id}/repair`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
			});

			if (!response.ok) {
				const errorData = await response
					.json()
					.catch(() => ({ error: 'Unknown error' }));
				console.error(
					'Quiz repair failed:',
					response.statusText,
					errorData,
				);
				throw new Error('Failed to repair quiz');
			}

			// Refresh the page to show the repaired quiz
			router.refresh();
			window.location.reload();
		} catch (error) {
			console.error('Error repairing quiz:', error);
			alert('Failed to repair quiz. Please try again.');
		} finally {
			setIsRepairing(false);
		}
	};

	// Helper function to format date
	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-CA', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	};

	// Check if user has already taken this quiz
	const hasAttemptedQuiz = !!quiz?.previousAttempt;

	// If user has already taken this quiz, show them their previous results
	useEffect(() => {
		if (hasAttemptedQuiz && !quizCompleted && quiz?.previousAttempt) {
			console.log(
				'Showing previous attempt results:',
				quiz.previousAttempt,
			);
			setQuizCompleted(true);
			setScore(quiz.previousAttempt.score || 0);
		}
	}, [hasAttemptedQuiz, quizCompleted, quiz?.previousAttempt]);

	const hasNoQuestions =
		quiz && (!quiz.questions || quiz.questions.length === 0);
	const currentQuestion = quiz?.questions?.[currentQuestionIndex] || {
		id: '',
		question_text: '',
		explanation: '',
		options: [],
	};

	if (isLoading || !quiz) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-amber-500"></div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="px-4 py-6">
				<div className="max-w-xl mx-auto">
					<h1 className="text-3xl font-bold mb-6 text-white">
						Error
					</h1>
					<div className="bg-red-900 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
						<p>{error}</p>
						<div className="mt-4">
							<Link
								href="/quizzes"
								className="text-amber-500 hover:text-amber-300"
							>
								← Back to Quizzes
							</Link>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-900 text-white pt-8 pb-16">
			<div className="max-w-4xl mx-auto px-4">
				{error ? (
					<div className="bg-red-900/50 border border-red-600 text-white p-4 rounded-lg">
						<h2 className="text-xl font-bold mb-2">Error</h2>
						<p>{error}</p>
						<div className="mt-4">
							<Link
								href="/quizzes"
								className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded"
							>
								Back to Quizzes
							</Link>
						</div>
					</div>
				) : (
					<>
						{isLoading ? (
							<div className="flex items-center justify-center h-64">
								<div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-amber-500"></div>
							</div>
						) : (
							<>
								<div className="mb-8">
									<h1 className="text-3xl font-bold mb-2">
										{quiz?.title}
									</h1>
									<div className="flex flex-wrap gap-2 mb-4">
										<span className="bg-gray-800 text-amber-500 text-sm px-3 py-1 rounded-full">
											{quiz?.difficulty
												?.charAt(0)
												.toUpperCase() +
												quiz?.difficulty?.slice(1)}
										</span>
										<span className="bg-gray-800 text-gray-300 text-sm px-3 py-1 rounded-full">
											{quiz?.subject}
										</span>
										<span className="bg-gray-800 text-gray-300 text-sm px-3 py-1 rounded-full">
											{quiz?.topic}
										</span>
									</div>

									<div className="text-gray-400 text-sm mb-4">
										{quiz?.creator?.username && (
											<span>
												Created by{' '}
												<span className="text-amber-500">
													{quiz?.creator?.username}
												</span>{' '}
												on{' '}
												{formatDate(
													quiz?.created_at || '',
												)}
											</span>
										)}
									</div>
									<p className="text-gray-300">
										{quiz?.description}
									</p>
								</div>

								{/* Display notification for previously completed quiz */}
								{hasAttemptedQuiz && (
									<div className="bg-amber-900/30 border border-amber-600 text-white p-4 rounded-lg mb-6">
										<h2 className="text-xl font-bold mb-2">
											You've already taken this quiz
										</h2>
										<p>
											You scored{' '}
											{quiz?.previousAttempt?.score}% on{' '}
											{formatDate(
												quiz?.previousAttempt
													?.completed_at || '',
											)}
										</p>
										<p className="mt-2">
											Below is your previous result with
											correct and incorrect answers
											highlighted.
										</p>
									</div>
								)}

								{(user?.id === quiz?.creator?.id ||
									profile?.id === quiz?.creator?.id) && (
									<div className="mb-8">
										<button
											onClick={handleRepairQuiz}
											disabled={isRepairing}
											className={`py-2 px-4 rounded ${
												isRepairing
													? 'bg-gray-700 text-gray-400 cursor-not-allowed'
													: 'bg-amber-600 hover:bg-amber-700 text-white'
											}`}
										>
											{isRepairing
												? 'Repairing...'
												: 'Repair Quiz'}
										</button>
									</div>
								)}

								{/* Auth prompt for unauthenticated users */}
								{showAuthPrompt && (
									<div className="bg-amber-900/30 border border-amber-600 text-white p-4 rounded-lg mb-6">
										<h2 className="text-xl font-bold mb-2">
											Please Sign In
										</h2>
										<p>
											You need to be signed in to submit
											your quiz results.
										</p>
										<div className="mt-4 flex gap-4">
											<Link
												href="/auth/signin"
												className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded"
											>
												Sign In
											</Link>
											<button
												className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded"
												onClick={() =>
													setShowAuthPrompt(false)
												}
											>
												Continue without Saving
											</button>
										</div>
									</div>
								)}

								{/* Progress bar */}
								{!quizCompleted && !hasNoQuestions && (
									<div className="mb-6">
										<div className="flex justify-between text-sm mb-1 text-gray-300">
											<span>
												Question{' '}
												{currentQuestionIndex + 1} of{' '}
												{quiz?.questions.length}
											</span>
											<span>
												{
													Object.keys(selectedAnswers)
														.length
												}{' '}
												of {quiz?.questions.length}{' '}
												answered
											</span>
										</div>
										<div className="w-full bg-gray-800 rounded-full h-2.5">
											<div
												className="bg-amber-500 h-2.5 rounded-full"
												style={{
													width: `${((currentQuestionIndex + 1) / quiz?.questions.length) * 100}%`,
												}}
											></div>
										</div>
									</div>
								)}

								{/* Current question */}
								{!quizCompleted && !hasAttemptedQuiz && (
									<>
										{hasNoQuestions ? (
											<div className="bg-gray-800 border border-amber-700 rounded-lg p-6 mb-8">
												<h2 className="text-xl font-semibold mb-4 text-amber-500">
													This quiz has no questions
												</h2>
												<p className="mb-4 text-gray-300">
													It looks like this quiz was
													created but no questions
													were generated.
												</p>
												{(user?.id ===
													quiz?.creator?.id ||
													profile?.id ===
														quiz?.creator?.id) && (
													<div>
														<p className="mb-4 text-gray-300">
															As the creator of
															this quiz, you can
															repair it by
															clicking the "Repair
															Quiz" button above.
														</p>
													</div>
												)}
											</div>
										) : (
											<div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700 mb-6">
												<h2 className="text-xl font-bold mb-4 text-white">
													{
														currentQuestion.question_text
													}
												</h2>
												<div className="space-y-3">
													{currentQuestion.options.map(
														option => (
															<div
																key={option.id}
																className={`p-4 rounded-lg border cursor-pointer transition-all ${
																	selectedAnswers[
																		currentQuestion
																			.id
																	] ===
																	option.id
																		? 'bg-amber-800 border-amber-500 text-white'
																		: 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-200'
																}`}
																onClick={() =>
																	selectAnswer(
																		currentQuestion.id,
																		option.id,
																	)
																}
															>
																{
																	option.option_text
																}
															</div>
														),
													)}
												</div>
											</div>
										)}

										{/* Navigation buttons */}
										{!hasNoQuestions && (
											<div className="flex justify-between">
												<button
													onClick={previousQuestion}
													disabled={
														currentQuestionIndex ===
														0
													}
													className={`py-2 px-4 rounded ${
														currentQuestionIndex ===
														0
															? 'bg-gray-700 text-gray-400 cursor-not-allowed'
															: 'bg-gray-700 hover:bg-gray-600 text-white'
													}`}
												>
													Previous
												</button>

												{currentQuestionIndex <
												quiz?.questions.length - 1 ? (
													<button
														onClick={nextQuestion}
														className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded"
													>
														Next
													</button>
												) : (
													<button
														onClick={
															handleSubmitQuiz
														}
														disabled={
															isSubmitting ||
															Object.keys(
																selectedAnswers,
															).length <
																quiz?.questions
																	.length
														}
														className={`py-2 px-4 rounded ${
															isSubmitting ||
															Object.keys(
																selectedAnswers,
															).length <
																quiz?.questions
																	.length
																? 'bg-gray-700 text-gray-400 cursor-not-allowed'
																: 'bg-green-600 hover:bg-green-700 text-white'
														}`}
													>
														{isSubmitting
															? 'Submitting...'
															: 'Submit Quiz'}
													</button>
												)}
											</div>
										)}
									</>
								)}

								{/* Quiz results */}
								{quizCompleted && (
									<div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
										<h2 className="text-2xl font-bold mb-4 text-amber-500">
											Quiz Results
										</h2>
										<div className="mb-6">
											<div className="text-center mb-4">
												<span className="text-5xl font-bold text-amber-500">
													{score}%
												</span>
											</div>
											<div className="w-full bg-gray-700 rounded-full h-4 mb-2">
												<div
													className={`h-4 rounded-full ${
														score >= 70
															? 'bg-green-500'
															: score >= 40
																? 'bg-amber-500'
																: 'bg-red-500'
													}`}
													style={{
														width: `${score}%`,
													}}
												></div>
											</div>
											<p className="text-center text-gray-300">
												You answered{' '}
												{
													Object.entries(
														selectedAnswers,
													).filter(
														([
															questionId,
															answerId,
														]) => {
															const question =
																quiz?.questions.find(
																	q =>
																		q.id ===
																		questionId,
																);
															const correctOption =
																question?.options.find(
																	o =>
																		o.is_correct,
																);
															return (
																correctOption &&
																correctOption.id ===
																	answerId
															);
														},
													).length
												}{' '}
												out of {quiz?.questions.length}{' '}
												questions correctly.
											</p>
										</div>

										{/* Questions review */}
										<div className="space-y-6">
											<h3 className="text-xl font-semibold text-white">
												Review Questions
											</h3>
											{quiz?.questions.map(
												(question, index) => {
													const selectedOption =
														question.options.find(
															option =>
																option.id ===
																selectedAnswers[
																	question.id
																],
														);
													const correctOption =
														question.options.find(
															option =>
																option.is_correct,
														);
													const isCorrect =
														selectedOption?.id ===
														correctOption?.id;

													return (
														<div
															key={question.id}
															className="bg-gray-700 p-4 rounded-lg"
														>
															<div className="flex items-start gap-2">
																<span
																	className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-white text-sm ${
																		isCorrect
																			? 'bg-green-500'
																			: 'bg-red-500'
																	}`}
																>
																	{isCorrect
																		? '✓'
																		: '✗'}
																</span>
																<div className="w-full">
																	<p className="font-medium text-white">
																		{index +
																			1}
																		.{' '}
																		{
																			question.question_text
																		}
																	</p>

																	{/* Show all options with colour coding */}
																	<div className="mt-3 space-y-2">
																		{question.options.map(
																			option => {
																				// Determine the styling for each option
																				const isSelected =
																					option.id ===
																					selectedAnswers[
																						question
																							.id
																					];
																				const isCorrectOption =
																					option.is_correct;

																				let optionClass =
																					'p-3 rounded border ';

																				if (
																					isSelected &&
																					isCorrectOption
																				) {
																					// Selected and correct
																					optionClass +=
																						'bg-green-900/50 border-green-500 text-green-200';
																				} else if (
																					isSelected &&
																					!isCorrectOption
																				) {
																					// Selected but wrong
																					optionClass +=
																						'bg-red-900/50 border-red-500 text-red-200';
																				} else if (
																					!isSelected &&
																					isCorrectOption
																				) {
																					// Not selected but is correct answer
																					optionClass +=
																						'bg-green-900/30 border-green-700 text-green-300';
																				} else {
																					// Not selected, not correct
																					optionClass +=
																						'bg-gray-800 border-gray-700 text-gray-400';
																				}

																				return (
																					<div
																						key={
																							option.id
																						}
																						className={
																							optionClass
																						}
																					>
																						{
																							option.option_text
																						}
																						{isSelected && (
																							<span className="ml-2">
																								{isCorrectOption
																									? '✓'
																									: '✗'}
																							</span>
																						)}
																						{!isSelected &&
																							isCorrectOption && (
																								<span className="ml-2 text-green-300">
																									(Correct
																									Answer)
																								</span>
																							)}
																					</div>
																				);
																			},
																		)}
																	</div>

																	{question.explanation && (
																		<div className="mt-3 p-3 rounded bg-gray-800 text-gray-300">
																			<p className="text-sm font-medium text-amber-400">
																				Explanation:
																			</p>
																			<p className="text-sm">
																				{
																					question.explanation
																				}
																			</p>
																		</div>
																	)}
																</div>
															</div>
														</div>
													);
												},
											)}
										</div>

										<div className="mt-6 flex justify-between">
											<Link
												href="/quizzes"
												className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded"
											>
												Back to Quizzes
											</Link>
											<Link
												href="/profile/quizzes"
												className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded"
											>
												View Your Quizzes
											</Link>
										</div>
									</div>
								)}
							</>
						)}
					</>
				)}
			</div>
		</div>
	);
};

export default QuizPage;
