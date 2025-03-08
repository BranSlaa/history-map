export interface Event {
	id: string;
	title: string;
	year: number;
	lat: number;
	lon: number;
	subject: string;
	description: string;
	key_terms?: string[];
	embedding?: number[];
	path_ids?: string[];
	quiz_ids?: string[];
	interacted?: boolean;
}

export interface UserEventInteraction {
	id?: string;
	user_id: string;
	event_id: string;
	path_id: string;
	interaction_type: 'explore' | 'quiz_answer' | 'favorite';
	created_at?: string;
	metadata?: Record<string, any>;
}
