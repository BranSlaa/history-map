import { calculateQuizScore, isQuizCompleted, getQuizDifficulty, validateQuizAttempt } from '../quizUtils';
import { Quiz, Question, QuizAnswer, QuizAttempt } from '@/types/quiz';

describe('quizUtils', () => {
    describe('calculateQuizScore', () => {
        const mockQuestions: Question[] = [
            {
                id: '1',
                quiz_id: 'quiz1',
                text: 'Question 1',
                options: [],
                correct_answer_id: 'opt1',
                points: 10
            },
            {
                id: '2',
                quiz_id: 'quiz1',
                text: 'Question 2',
                options: [],
                correct_answer_id: 'opt2',
                points: 20
            }
        ];

        it('should calculate score correctly', () => {
            const answers: QuizAnswer[] = [
                {
                    id: 'a1',
                    attempt_id: 'attempt1',
                    question_id: '1',
                    selected_option_id: 'opt1',
                    is_correct: true,
                    points_earned: 10
                },
                {
                    id: 'a2',
                    attempt_id: 'attempt1',
                    question_id: '2',
                    selected_option_id: 'opt2',
                    is_correct: false,
                    points_earned: 0
                }
            ];

            const score = calculateQuizScore(answers, mockQuestions);
            expect(score).toBe(33); // (10 / 30) * 100 = 33.33... rounded to 33
        });

        it('should return 0 for empty answers or questions', () => {
            expect(calculateQuizScore([], mockQuestions)).toBe(0);
            expect(calculateQuizScore([], [])).toBe(0);
        });
    });

    describe('isQuizCompleted', () => {
        const mockQuiz: Quiz = {
            id: 'quiz1',
            title: 'Test Quiz',
            description: 'Test Description',
            difficulty: 'intermediate',
            created_at: '2024-03-06',
            subject: 'History',
            topic: 'World War II',
            question_count: 2,
            user_id: 'user1',
            related_event_ids: []
        };

        it('should return true when all questions are answered', () => {
            const attempt: QuizAttempt = {
                id: 'attempt1',
                user_id: 'user1',
                quiz_id: 'quiz1',
                score: 50,
                completed: true,
                started_at: '2024-03-06',
                answers: [
                    { id: 'a1', attempt_id: 'attempt1', question_id: '1', selected_option_id: 'opt1', is_correct: true, points_earned: 10 },
                    { id: 'a2', attempt_id: 'attempt1', question_id: '2', selected_option_id: 'opt2', is_correct: false, points_earned: 0 }
                ]
            };

            expect(isQuizCompleted(attempt, mockQuiz)).toBe(true);
        });

        it('should return false when not all questions are answered', () => {
            const attempt: QuizAttempt = {
                id: 'attempt1',
                user_id: 'user1',
                quiz_id: 'quiz1',
                score: 50,
                completed: false,
                started_at: '2024-03-06',
                answers: [
                    { id: 'a1', attempt_id: 'attempt1', question_id: '1', selected_option_id: 'opt1', is_correct: true, points_earned: 10 }
                ]
            };

            expect(isQuizCompleted(attempt, mockQuiz)).toBe(false);
        });
    });

    describe('getQuizDifficulty', () => {
        it('should return beginner for low scores', () => {
            expect(getQuizDifficulty(0)).toBe('beginner');
            expect(getQuizDifficulty(39)).toBe('beginner');
        });

        it('should return intermediate for medium scores', () => {
            expect(getQuizDifficulty(40)).toBe('intermediate');
            expect(getQuizDifficulty(74)).toBe('intermediate');
        });

        it('should return advanced for high scores', () => {
            expect(getQuizDifficulty(75)).toBe('advanced');
            expect(getQuizDifficulty(100)).toBe('advanced');
        });
    });

    describe('validateQuizAttempt', () => {
        const mockQuiz: Quiz = {
            id: 'quiz1',
            title: 'Test Quiz',
            description: 'Test Description',
            difficulty: 'intermediate',
            created_at: '2024-03-06',
            subject: 'History',
            topic: 'World War II',
            question_count: 1,
            user_id: 'user1',
            related_event_ids: [],
            questions: [
                {
                    id: 'q1',
                    quiz_id: 'quiz1',
                    text: 'Test Question',
                    options: [
                        { id: 'opt1', quiz_question_id: 'q1', text: 'Correct', is_correct: true },
                        { id: 'opt2', quiz_question_id: 'q1', text: 'Wrong', is_correct: false }
                    ],
                    correct_answer_id: 'opt1',
                    points: 10
                }
            ]
        };

        it('should validate a correct attempt', () => {
            const attempt: QuizAttempt = {
                id: 'attempt1',
                user_id: 'user1',
                quiz_id: 'quiz1',
                score: 100,
                completed: true,
                started_at: '2024-03-06',
                answers: [
                    {
                        id: 'a1',
                        attempt_id: 'attempt1',
                        question_id: 'q1',
                        selected_option_id: 'opt1',
                        is_correct: true,
                        points_earned: 10
                    }
                ]
            };

            expect(validateQuizAttempt(attempt, mockQuiz)).toBe(true);
        });

        it('should reject invalid attempts', () => {
            const invalidAttempt: QuizAttempt = {
                id: 'attempt1',
                user_id: 'user1',
                quiz_id: 'quiz1',
                score: -1, // Invalid score
                completed: true,
                started_at: '2024-03-06',
                answers: []
            };

            expect(validateQuizAttempt(invalidAttempt, mockQuiz)).toBe(false);
        });

        it('should reject attempts with incorrect answer validation', () => {
            const attemptWithWrongValidation: QuizAttempt = {
                id: 'attempt1',
                user_id: 'user1',
                quiz_id: 'quiz1',
                score: 100,
                completed: true,
                started_at: '2024-03-06',
                answers: [
                    {
                        id: 'a1',
                        attempt_id: 'attempt1',
                        question_id: 'q1',
                        selected_option_id: 'opt2',
                        is_correct: true, // Wrong validation - selected wrong answer but marked as correct
                        points_earned: 10
                    }
                ]
            };

            expect(validateQuizAttempt(attemptWithWrongValidation, mockQuiz)).toBe(false);
        });
    });
}); 