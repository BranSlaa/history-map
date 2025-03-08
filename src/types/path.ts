export interface ChosenEvent {
	id: string;
	title?: string;
	chosenAt?: string;
	[key: string]: any;
}

export interface PathData {
	chosenEvents: ChosenEvent[];
	unchosenEvents?: string[];
	lastUpdated?: string;
	startedAt?: string;
	[key: string]: any;
}

export interface UserPath {
	id: string;
	user_id: string;
	path_data: PathData;
	current_event_id?: string;
	created_at: string;
	updated_at: string;
}

export interface PathEvent {
	id: string;
	title: string;
	explored_at: string;
	event_order: number;
}

export interface Path {
	id: string;
	user_id: string;
	search_term: string;
	subject: string;
	title: string;
	started_at: string;
	updated_at: string;
	completed_at?: string;
	events: PathEvent[];
	current_event_id?: string;
	event_count: number;
	max_events: number;
	quiz_id?: string;
	status: 'active' | 'completed' | 'abandoned';
}

export interface PathEventConnection {
	id: string;
	path_id: string;
	source_event_id: string;
	target_event_id: string;
	connection_strength: number;
	created_at: string;
} 