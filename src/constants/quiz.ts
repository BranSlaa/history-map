export const QUIZ_DIFFICULTIES = {
    BEGINNER: 'beginner',
    INTERMEDIATE: 'intermediate',
    ADVANCED: 'advanced'
} as const;

export const DEFAULT_QUIZ_TOPIC = 'General';

export const DEFAULT_QUIZ_VALUES = {
    MAX_QUESTIONS: 20,
    MIN_QUESTIONS: 3,
    DEFAULT_POINT_VALUE: 1
} as const;

export const QUIZ_QUESTION_DISTRIBUTIONS = {
    BEGINNER_RATIO: 0.5,    // 50% beginner questions
    INTERMEDIATE_RATIO: 0.3, // 30% intermediate questions
    ADVANCED_RATIO: 0.2     // 20% advanced questions
} as const;

export type QuizDifficulty = typeof QUIZ_DIFFICULTIES[keyof typeof QUIZ_DIFFICULTIES]; 