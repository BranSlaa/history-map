import { NextResponse } from 'next/server';

const BASE_URL = 'http://localhost:8000/api/v1';
export async function GET(request: Request) {
	const url = new URL(request.url);
	const topic = url.searchParams.get('topic');
	const year_start = url.searchParams.get('year_start');
	const year_end = url.searchParams.get('year_end');
	const limit = url.searchParams.get('limit');

	let api_url = `${BASE_URL}/events/`;
	if (topic) {
		api_url += `?topic=${topic}`;
	}
	if (year_start) {
		api_url += `&year_start=${year_start}`;
	}
	if (year_end) {
		api_url += `&year_end=${year_end}`;
	}
	if (limit) {
		api_url += `&limit=${limit}`;
	}
	const response = await fetch(api_url);
	const data = await response.json();
	return NextResponse.json(data);
}
