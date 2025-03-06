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