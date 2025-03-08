import { calculatePerformanceMetrics, getRecommendedDifficulty } from '../adaptiveDifficultyUtils';
import { Quiz, QuizAttempt } from '@/types/quiz';

describe('adaptiveDifficultyUtils', () => {
    describe('calculatePerformanceMetrics', () => {
        const mockQuizzes: Quiz[] = [
            {
                id: '1',
                title: 'Quiz 1',
                description: 'Test Quiz',
                difficulty: 'beginner',
                created_at: '2024-03-06',
                subject: 'History',
                topic: 'World War II',
                question_count: 10,
                user_id: 'user1',
                related_event_ids: []
            },
            {
                id: '2',
                title: 'Quiz 2',
                description: 'Test Quiz',
                difficulty: 'intermediate',
                created_at: '2024-03-06',
                subject: 'History',
                topic: 'World War II',
                question_count: 10,
                user_id: 'user1',
                related_event_ids: []
            }
        ];

        const mockAttempts: QuizAttempt[] = [
            {
                id: 'a1',
                user_id: 'user1',
                quiz_id: '1',
                score: 80,
                completed: true,
                started_at: '2024-03-05',
                completed_at: '2024-03-05'
            },
            {
                id: 'a2',
                user_id: 'user1',
                quiz_id: '2',
                score: 70,
                completed: true,
                started_at: '2024-03-06',
                completed_at: '2024-03-06'
            }
        ];

        it('should calculate metrics correctly', () => {
            const metrics = calculatePerformanceMetrics(mockAttempts, mockQuizzes);
            
            expect(metrics.averageScore).toBe(75); // (80 + 70) / 2
            expect(metrics.recentScore).toBe(70); // Most recent attempt score
            expect(metrics.completedQuizzes).toBe(2);
            expect(metrics.difficultyScores.beginner).toBe(80);
            expect(metrics.difficultyScores.intermediate).toBe(70);
            expect(metrics.difficultyScores.advanced).toBe(0);
        });

        it('should handle empty attempts', () => {
            const metrics = calculatePerformanceMetrics([], mockQuizzes);
            
            expect(metrics.averageScore).toBe(0);
            expect(metrics.recentScore).toBe(0);
            expect(metrics.completedQuizzes).toBe(0);
            expect(metrics.difficultyScores.beginner).toBe(0);
            expect(metrics.difficultyScores.intermediate).toBe(0);
            expect(metrics.difficultyScores.advanced).toBe(0);
        });
    });

    describe('getRecommendedDifficulty', () => {
        const mockMetrics = {
            averageScore: 0,
            recentScore: 0,
            difficultyScores: {
                beginner: 0,
                intermediate: 0,
                advanced: 0
            },
            completedQuizzes: 0
        };

        it('should recommend beginner for new users', () => {
            const difficulty = getRecommendedDifficulty(mockMetrics, 'beginner');
            expect(difficulty).toBe('beginner');
        });

        it('should progress from beginner to intermediate', () => {
            const metrics = {
                ...mockMetrics,
                averageScore: 80,
                recentScore: 85,
                difficultyScores: { ...mockMetrics.difficultyScores, beginner: 82 },
                completedQuizzes: 5
            };
            
            const difficulty = getRecommendedDifficulty(metrics, 'beginner');
            expect(difficulty).toBe('intermediate');
        });

        it('should progress from intermediate to advanced', () => {
            const metrics = {
                ...mockMetrics,
                averageScore: 85,
                recentScore: 90,
                difficultyScores: { ...mockMetrics.difficultyScores, intermediate: 88 },
                completedQuizzes: 8
            };
            
            const difficulty = getRecommendedDifficulty(metrics, 'intermediate');
            expect(difficulty).toBe('advanced');
        });

        it('should regress from intermediate to beginner', () => {
            const metrics = {
                ...mockMetrics,
                averageScore: 35,
                recentScore: 30,
                difficultyScores: { ...mockMetrics.difficultyScores, intermediate: 32 },
                completedQuizzes: 3
            };
            
            const difficulty = getRecommendedDifficulty(metrics, 'intermediate');
            expect(difficulty).toBe('beginner');
        });

        it('should regress from advanced to intermediate', () => {
            const metrics = {
                ...mockMetrics,
                averageScore: 35,
                recentScore: 30,
                difficultyScores: { ...mockMetrics.difficultyScores, advanced: 32 },
                completedQuizzes: 3
            };
            
            const difficulty = getRecommendedDifficulty(metrics, 'advanced');
            expect(difficulty).toBe('intermediate');
        });
    });
}); 