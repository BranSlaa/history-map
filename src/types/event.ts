export interface Event {
	id: string;
	title: string;
	year: number;
	lat: number;
	lon: number;
	subject: string;
	info: string;
	key_terms?: string[];
	embedding?: number[];
	interacted?: boolean;
}

// Add interfaces for path tracking
export interface PathData {
	chosenEvents: string[];
	unchosenEvents: string[];
}

export interface UserPath {
	id?: number;
	user_id: string;
	path_data: PathData;
	current_event_id?: string | null;
	created_at?: string;
	updated_at?: string;
}

export interface UserEventInteraction {
	id?: number;
	user_id: string;
	event_id: string;
	previous_event_id?: string | null;
	next_event_id?: string | null;
	interaction_type: 'fetch_more';
	created_at?: string;
}

export interface UserEventConnection {
	id?: number;
	user_id: string;
	source_event_id: string;
	target_event_id: string;
	connection_strength: number;
	created_at?: string;
}
