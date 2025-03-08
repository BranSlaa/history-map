import { Quiz, QuizAttempt, Question, QuizAnswer } from '@/types/quiz';

export const calculateQuizScore = (
    answers: QuizAnswer[],
    questions: Question[]
): number => {
    if (!answers || !questions || answers.length === 0 || questions.length === 0) {
        return 0;
    }

    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const earnedPoints = answers.reduce((sum, a) => sum + a.points_earned, 0);

    return Math.round((earnedPoints / totalPoints) * 100);
};

export const isQuizCompleted = (attempt: QuizAttempt, quiz: Quiz): boolean => {
    if (!attempt || !quiz) return false;
    return attempt.answers?.length === quiz.question_count;
};

export const getQuizDifficulty = (score: number): Quiz['difficulty'] => {
    if (score < 40) return 'beginner';
    if (score < 75) return 'intermediate';
    return 'advanced';
};

export const validateQuizAttempt = (attempt: QuizAttempt, quiz: Quiz): boolean => {
    if (!attempt || !quiz) return false;
    
    // Check if all required fields are present
    if (!attempt.user_id || !attempt.quiz_id || attempt.score < 0 || attempt.score > 100) {
        return false;
    }

    // Check if the attempt belongs to the correct quiz
    if (attempt.quiz_id !== quiz.id) {
        return false;
    }

    // Validate answers if present
    if (attempt.answers) {
        const validAnswers = attempt.answers.every(answer => {
            const question = quiz.questions?.find(q => q.id === answer.question_id);
            if (!question) return false;

            const option = question.options.find(o => o.id === answer.selected_option_id);
            if (!option) return false;

            // Verify if is_correct matches the selected option
            return answer.is_correct === option.is_correct;
        });

        if (!validAnswers) return false;
    }

    return true;
}; 