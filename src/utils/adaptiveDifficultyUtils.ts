import { Quiz, QuizAttempt } from '@/types/quiz';

interface PerformanceMetrics {
    averageScore: number;
    recentScore: number;
    difficultyScores: {
        beginner: number;
        intermediate: number;
        advanced: number;
    };
    completedQuizzes: number;
}

const DIFFICULTY_WEIGHTS = {
    RECENT_PERFORMANCE: 0.4,
    AVERAGE_PERFORMANCE: 0.3,
    DIFFICULTY_SPECIFIC: 0.3
};

const PROGRESSION_THRESHOLDS = {
    BEGINNER_TO_INTERMEDIATE: 75, // Need 75% average to progress from beginner
    INTERMEDIATE_TO_ADVANCED: 80,  // Need 80% average to progress to advanced
    REGRESSION_THRESHOLD: 40      // Below 40% might suggest moving back a level
};

export const calculatePerformanceMetrics = (attempts: QuizAttempt[], quizzes: Quiz[]): PerformanceMetrics => {
    if (!attempts || attempts.length === 0) {
        return {
            averageScore: 0,
            recentScore: 0,
            difficultyScores: { beginner: 0, intermediate: 0, advanced: 0 },
            completedQuizzes: 0
        };
    }

    // Sort attempts by date
    const sortedAttempts = [...attempts].sort(
        (a, b) => new Date(b.completed_at || '').getTime() - new Date(a.completed_at || '').getTime()
    );

    // Get the most recent score
    const recentScore = sortedAttempts[0].score;

    // Calculate average score
    const totalScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
    const averageScore = totalScore / attempts.length;

    // Calculate scores by difficulty
    const difficultyAttempts = attempts.reduce((acc, attempt) => {
        const quiz = quizzes.find(q => q.id === attempt.quiz_id);
        if (quiz) {
            if (!acc[quiz.difficulty]) {
                acc[quiz.difficulty] = { total: 0, count: 0 };
            }
            acc[quiz.difficulty].total += attempt.score;
            acc[quiz.difficulty].count++;
        }
        return acc;
    }, {} as Record<string, { total: number; count: number }>);

    const difficultyScores = {
        beginner: (difficultyAttempts.beginner?.total || 0) / (difficultyAttempts.beginner?.count || 1),
        intermediate: (difficultyAttempts.intermediate?.total || 0) / (difficultyAttempts.intermediate?.count || 1),
        advanced: (difficultyAttempts.advanced?.total || 0) / (difficultyAttempts.advanced?.count || 1)
    };

    return {
        averageScore,
        recentScore,
        difficultyScores,
        completedQuizzes: attempts.length
    };
};

export const getRecommendedDifficulty = (
    metrics: PerformanceMetrics,
    currentDifficulty: Quiz['difficulty']
): Quiz['difficulty'] => {
    if (metrics.completedQuizzes === 0) {
        return 'beginner';
    }

    // Calculate weighted score
    const weightedScore = 
        metrics.recentScore * DIFFICULTY_WEIGHTS.RECENT_PERFORMANCE +
        metrics.averageScore * DIFFICULTY_WEIGHTS.AVERAGE_PERFORMANCE +
        metrics.difficultyScores[currentDifficulty] * DIFFICULTY_WEIGHTS.DIFFICULTY_SPECIFIC;

    // Progression logic
    switch (currentDifficulty) {
        case 'beginner':
            if (weightedScore >= PROGRESSION_THRESHOLDS.BEGINNER_TO_INTERMEDIATE) {
                return 'intermediate';
            }
            break;
        case 'intermediate':
            if (weightedScore >= PROGRESSION_THRESHOLDS.INTERMEDIATE_TO_ADVANCED) {
                return 'advanced';
            } else if (weightedScore < PROGRESSION_THRESHOLDS.REGRESSION_THRESHOLD) {
                return 'beginner';
            }
            break;
        case 'advanced':
            if (weightedScore < PROGRESSION_THRESHOLDS.REGRESSION_THRESHOLD) {
                return 'intermediate';
            }
            break;
    }

    return currentDifficulty;
};

export const getNextQuizSuggestions = async (
    userId: string,
    currentDifficulty: Quiz['difficulty'],
    supabase: any
): Promise<Quiz[]> => {
    try {
        // Fetch user's quiz attempts
        const { data: attempts } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false });

        // Fetch quizzes related to these attempts
        const quizIds = [...new Set(attempts?.map(a => a.quiz_id) || [])];
        const { data: attemptedQuizzes } = await supabase
            .from('quizzes')
            .select('*')
            .in('id', quizIds);

        // Calculate metrics
        const metrics = calculatePerformanceMetrics(attempts || [], attemptedQuizzes || []);
        const recommendedDifficulty = getRecommendedDifficulty(metrics, currentDifficulty);

        // Fetch quiz suggestions based on recommended difficulty
        const { data: suggestedQuizzes } = await supabase
            .from('quizzes')
            .select('*')
            .eq('difficulty', recommendedDifficulty)
            .not('id', 'in', `(${quizIds.join(',')})`)
            .limit(3);

        return suggestedQuizzes || [];
    } catch (error) {
        console.error('Error getting quiz suggestions:', error);
        return [];
    }
}; 