export interface Event {
	id: string;
	title: string;
	year: number;
	lat: number;
	lon: number;
	subject: string;
	info: string;
	key_terms?: string[];
}
