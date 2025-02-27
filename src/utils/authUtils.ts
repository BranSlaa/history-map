import { useAuth } from '@clerk/clerk-react';
import { SubscriptionTier, User } from '@/types/user';

// Define API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Store JWT token in localStorage
export const storeToken = (token: string) => {
	localStorage.setItem('jwt_token', token);
};

// Get JWT token from localStorage
export const getToken = (): string | null => {
	if (typeof window !== 'undefined') {
		return localStorage.getItem('jwt_token');
	}
	return null;
};

// Remove JWT token from localStorage
export const removeToken = () => {
	localStorage.removeItem('jwt_token');
};

// Check if user is authenticated (has a valid token)
export const isAuthenticated = (): boolean => {
	return getToken() !== null;
};

// Get JWT token from backend
export const fetchToken = async (
	clerkId: string,
	clerkToken?: string
): Promise<string | null> => {
	try {
		if (typeof window === 'undefined') {
			return null;
		}

		const response = await fetch(`${API_URL}/auth/token`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(clerkToken && { Authorization: `Bearer ${clerkToken}` }),
			},
			credentials: 'include',
			body: JSON.stringify({ clerk_id: clerkId }),
		});

		if (!response.ok) {
			console.error(
				'Token fetch failed:',
				response.status,
				response.statusText
			);
			return null;
		}

		const data = await response.json();
		storeToken(data.access_token);
		return data.access_token;
	} catch (error) {
		console.error('Error fetching token:', error);
		return null;
	}
};

// Get current user from backend
export const fetchCurrentUser = async (): Promise<User | null> => {
	const token = getToken();
	if (!token) return null;

	try {
		console.log(
			'Fetching current user with token:',
			token.substring(0, 15) + '...'
		);
		const response = await fetch(`${API_URL}/users/me`, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/json',
			},
			credentials: 'include',
		});

		if (!response.ok) {
			console.error(
				'User fetch failed:',
				response.status,
				response.statusText
			);
			if (response.status === 401) {
				console.log('Removing invalid token');
				removeToken();
			}
			return null;
		}

		return await response.json();
	} catch (error) {
		console.error('Error fetching user:', error);
		return null;
	}
};

// Update user subscription tier
export const updateUserTier = async (
	tier: SubscriptionTier
): Promise<User | null> => {
	const token = getToken();
	if (!token) return null;

	try {
		console.log('Updating user tier to:', tier);
		const response = await fetch(`${API_URL}/users/me/tier`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			credentials: 'include',
			body: JSON.stringify(tier),
		});

		if (!response.ok) {
			console.error(
				'Tier update failed:',
				response.status,
				response.statusText
			);
			return null;
		}

		return await response.json();
	} catch (error) {
		console.error('Error updating user tier:', error);
		return null;
	}
};

// Create a new user
export const createUser = async (
	clerkId: string,
	username: string,
	email: string,
	tier: SubscriptionTier = SubscriptionTier.STUDENT
): Promise<User | null> => {
	try {
		console.log('Creating new user with clerk ID:', clerkId);
		const response = await fetch(`${API_URL}/users`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			credentials: 'include',
			body: JSON.stringify({
				clerk_id: clerkId,
				username,
				email,
				subscription_tier: tier,
			}),
		});

		if (!response.ok) {
			console.error(
				'User creation failed:',
				response.status,
				response.statusText
			);
			return null;
		}

		return await response.json();
	} catch (error) {
		console.error('Error creating user:', error);
		return null;
	}
};
