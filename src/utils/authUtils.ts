import { SubscriptionTier, User } from '@/types/user';

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

// Login user via Next.js API route
export const loginUser = async (
	email: string,
	password: string
): Promise<string | null> => {
	try {
		if (typeof window === 'undefined') {
			return null;
		}

		const response = await fetch('/api/auth/login', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ 
				email,
				password 
			}),
		});

		if (!response.ok) {
			console.error('Login failed:', response.status, response.statusText);
			return null;
		}

		const data = await response.json();
		if (data && data.access_token) {
			storeToken(data.access_token);
			return data.access_token;
		}
		return null;
	} catch (error) {
		console.error('Error during login:', error);
		return null;
	}
};

// Register a new user via Next.js API route
export const registerUser = async (
	email: string,
	password: string,
	fullName: string
): Promise<User | null> => {
	try {
		const response = await fetch('/api/auth/register', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				email,
				password,
				full_name: fullName
			}),
		});

		if (!response.ok) {
			console.error('Registration failed:', response.status, response.statusText);
			return null;
		}

		const data = await response.json();
		
		// If registration also returns a token, store it
		if (data && data.access_token) {
			storeToken(data.access_token);
		}
		
		return data.user || data;
	} catch (error) {
		console.error('Error during registration:', error);
		return null;
	}
};

// Logout user
export const logoutUser = async (): Promise<boolean> => {
	try {
		const token = getToken();
		if (!token) return true; // Already logged out
		
		const response = await fetch('/api/auth/logout', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			}
		});
		
		// Always remove the token locally, even if the server request fails
		removeToken();
		
		return response.ok;
	} catch (error) {
		console.error('Error during logout:', error);
		// Still remove the token on error
		removeToken();
		return false;
	}
};

// Get current user from backend via Next.js API route
export const fetchCurrentUser = async (): Promise<User | null> => {
	const token = getToken();
	if (!token) return null;

	try {
		console.log(
			'Fetching current user with token:',
			token.substring(0, 15) + '...',
		);
		
		const response = await fetch('/api/users/me', {
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			console.error('User fetch failed:', response.status, response.statusText);
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

// Update user subscription tier via Next.js API route
export const updateUserTier = async (
	tier: SubscriptionTier,
): Promise<User | null> => {
	const token = getToken();
	if (!token) return null;

	try {
		console.log('Updating user tier to:', tier);
		
		const response = await fetch('/api/users/me/tier', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ tier }),
		});

		if (!response.ok) {
			console.error('Tier update failed:', response.status, response.statusText);
			return null;
		}

		return await response.json();
	} catch (error) {
		console.error('Error updating user tier:', error);
		return null;
	}
}; 