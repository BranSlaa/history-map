export interface Quiz {
	id: string;
	title: string;
	description: string;
	difficulty: 'beginner' | 'intermediate' | 'advanced';
	created_at: string;
	updated_at?: string;
	questions?: Question[];
	// Add fields for our public quizzes display
	subject?: string;
	topic?: string;
	question_count?: number;
	user_id?: string;
	creator?: {
		id: string;
		username?: string;
		first_name?: string;
		last_name?: string;
	};
}

export interface Question {
	id: string;
	quiz_id: string;
	text: string;
	options: QuestionOption[];
	correct_answer_id: string;
	explanation?: string;
	points: number;
}

export interface QuestionOption {
	id: string;
	question_id: string;
	text: string;
	is_correct: boolean;
}

export interface QuizAttempt {
	id: string;
	user_id: string;
	quiz_id: string;
	score: number;
	completed: boolean;
	started_at: string;
	completed_at?: string;
	answers?: QuizAnswer[];
}

export interface QuizAnswer {
	id: string;
	attempt_id: string;
	question_id: string;
	selected_option_id: string;
	is_correct: boolean;
	points_earned: number;
}
