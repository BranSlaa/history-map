'use client';

import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from 'react';
import { User, Profile, SubscriptionTier } from '@/types/user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
	children: ReactNode;
}

export function AuthProvider({
	children,
}: AuthProviderProps): React.ReactElement {
	const [authUser, setAuthUser] = useState<any | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	const syncUser = async (sessionUser: any) => {
		setIsLoading(true);
		setError(null);

		try {
			if (!sessionUser) {
				setUser(null);
				setProfile(null);
				return;
			}

			// Fetch user profile using API
			const response = await fetch('/api/user/profile', {
				headers: {
					Authorization: `Bearer ${getToken()}`,
					'Content-Type': 'application/json',
				},
			});

			if (!response.ok) {
				if (response.status === 401) {
					setUser(null);
					setProfile(null);
					return;
				}
				throw new Error('Failed to fetch user profile');
			}

			const profileData = await response.json();

			// Check if profile exists
			if (!profileData) {
				// If no profile exists, create one with API
				try {
					const createResponse = await fetch('/api/user/profile', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${getToken()}`,
						},
						body: JSON.stringify({
							username:
								sessionUser.email?.split('@')[0] || 'user',
							avatar_url:
								sessionUser.user_metadata?.avatar_url || '',
						}),
					});

					if (!createResponse.ok) {
						throw new Error('Failed to create user profile');
					}

					const newProfileData = await createResponse.json();

					// Set user and profile with new data
					setProfile(newProfileData);
					setUser({
						id: sessionUser.id,
						email: sessionUser.email,
						...newProfileData,
					});
				} catch (error) {
					console.error('Error creating profile:', error);
					setError('Error creating profile');
				}
			} else {
				// Use the retrieved profile
				setProfile(profileData);
				setUser({
					id: sessionUser.id,
					email: sessionUser.email,
					...profileData,
				});
			}
		} catch (error) {
			console.error('Error syncing user:', error);
			setError('Error syncing user profile');
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		const setupAuth = async () => {
			setIsLoading(true);
			try {
				if (!isAuthenticated()) {
					// No token exists
					setAuthUser(null);
					setUser(null);
					setProfile(null);
					setIsLoading(false);
					return;
				}

				// Fetch current user with token
				const userData = await fetchCurrentUser();

				if (!userData) {
					setAuthUser(null);
					setUser(null);
					setProfile(null);
					setIsLoading(false);
					return;
				}

				setAuthUser(userData);
				await syncUser(userData);
			} catch (error) {
				console.error('Error setting up auth:', error);
				setError('Authentication error');
				setAuthUser(null);
				setUser(null);
				setProfile(null);
			} finally {
				setIsLoading(false);
			}
		};

		setupAuth();

		// Set up event listener for auth state changes
		window.addEventListener('auth-state-change', setupAuth);

		return () => {
			window.removeEventListener('auth-state-change', setupAuth);
		};
	}, []);

	const updateProfile = async (profileData: Partial<Profile>) => {
		setIsLoading(true);
		setError(null);

		try {
			if (!user) {
				throw new Error('No user is logged in');
			}

			const response = await fetch('/api/user/profile', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${getToken()}`,
				},
				body: JSON.stringify(profileData),
			});

			if (!response.ok) {
				throw new Error('Failed to update profile');
			}

			const updatedProfile = await response.json();
			setProfile(prevProfile => ({
				...prevProfile!,
				...updatedProfile,
			}));

			setUser(prevUser => ({
				...prevUser!,
				...updatedProfile,
			}));
		} catch (error) {
			console.error('Error updating profile:', error);
			setError('Failed to update profile');
			throw error;
		} finally {
			setIsLoading(false);
		}
	};

	const signOut = async () => {
		setIsLoading(true);

		try {
			// Call the sign out API endpoint
			const response = await fetch('/api/auth/logout', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${getToken()}`,
				},
			});

			// Even if the server logout fails, remove local token
			removeToken();

			// Reset all states
			setAuthUser(null);
			setUser(null);
			setProfile(null);

			// Trigger auth state change event
			window.dispatchEvent(new Event('auth-state-change'));

			return { error: null };
		} catch (error) {
			console.error('Error signing out:', error);

			// Still remove token and reset state on error
			removeToken();
			setAuthUser(null);
			setUser(null);
			setProfile(null);

			return { error };
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<AuthContext.Provider
			value={{
				authUser,
				user,
				profile,
				loading: isLoading,
				error,
				signOut,
				updateProfile,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export const useAuth = (): AuthContextType => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};

function mapTierToEnum(tier: string): SubscriptionTier {
	switch (tier?.toLowerCase()) {
		case 'scholar':
			return SubscriptionTier.SCHOLAR;
		case 'educator':
			return SubscriptionTier.EDUCATOR;
		case 'student':
		default:
			return SubscriptionTier.STUDENT;
	}
}
