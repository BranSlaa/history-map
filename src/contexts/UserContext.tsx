'use client';

import {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from 'react';
import { useAuth, useUser as useClerkUser } from '@clerk/nextjs';
import { User, SubscriptionTier } from '@/types/user';
import {
	createUser,
	fetchCurrentUser,
	fetchToken,
	getToken,
	removeToken,
	updateUserTier,
} from '@/utils/authUtils';

interface UserContextType {
	user: User | null;
	isLoading: boolean;
	error: string | null;
	syncUser: () => Promise<void>;
	logout: () => void;
	updateTier: (tier: SubscriptionTier) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
	const {
		userId,
		isLoaded,
		isSignedIn,
		signOut,
		getToken: getClerkToken,
	} = useAuth();
	const { user: clerkUser, isLoaded: isClerkUserLoaded } = useClerkUser();
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	const syncUser = async () => {
		if (!isLoaded || !isClerkUserLoaded) {
			console.log('Clerk not loaded yet');
			return;
		}

		if (!isSignedIn || !userId || !clerkUser) {
			console.log('User not signed in with Clerk');
			setUser(null);
			setIsLoading(false);
			removeToken();
			return;
		}

		console.log('Syncing user with backend, Clerk ID:', userId);
		setIsLoading(true);
		setError(null);

		try {
			// Try to get an existing token first
			let backendToken = getToken();

			// If no existing token, try to get one using Clerk authentication
			if (!backendToken) {
				// Get a token from Clerk to pass to our backend
				const clerkToken = await getClerkToken();

				if (clerkToken) {
					// Exchange Clerk token for our backend token
					backendToken = await fetchToken(userId, clerkToken);
				}

				if (!backendToken) {
					console.log('No backend token, attempting to create user');

					// Get actual user details from Clerk - use Clerk's values directly
					let username = clerkUser.username || userId;

					// Get user's email from emailAddresses array
					let email = '';
					if (
						clerkUser.emailAddresses &&
						clerkUser.emailAddresses.length > 0
					) {
						email = clerkUser.emailAddresses[0].emailAddress;
					}

					console.log(
						`Creating user with Clerk details: ${username}, ${email}`
					);

					// Create a new user with actual Clerk user details
					const newUser = await createUser(
						userId,
						username,
						email,
						SubscriptionTier.SCHOLAR // Use SCHOLAR instead of STUDENT to match DB constraints
					);

					if (newUser) {
						console.log('User created successfully:', newUser);
						// Try to get a token again after user creation
						if (clerkToken) {
							backendToken = await fetchToken(userId, clerkToken);
						}

						if (!backendToken) {
							console.log(
								'Still failed to get backend token after creating user'
							);
							setUser(null);
							setIsLoading(false);
							return;
						}
					} else {
						console.log('Failed to create user');
						setUser(null);
						setIsLoading(false);
						return;
					}
				}
			}

			const userData = await fetchCurrentUser();

			if (userData) {
				setUser(userData);
			} else {
				console.log('No user data');
				setUser(null);
			}
		} catch (err) {
			console.error('Error syncing user:', err);
			setError(
				`Error syncing user: ${
					err instanceof Error ? err.message : String(err)
				}`
			);
			setUser(null);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		syncUser();
	}, [isLoaded, isSignedIn, userId, isClerkUserLoaded]);

	const logout = () => {
		console.log('Logging out user');
		removeToken();
		setUser(null);
		setError(null);
		if (signOut) {
			signOut();
		}
	};

	const updateTier = async (tier: SubscriptionTier) => {
		console.log('Updating subscription tier to:', tier);
		setIsLoading(true);
		try {
			const updatedUser = await updateUserTier(tier);
			if (updatedUser) {
				console.log('Tier updated successfully');
				setUser(updatedUser);
			} else {
				console.error('Failed to update tier');
				setError('Failed to update subscription tier');
			}
		} catch (err) {
			console.error('Error updating tier:', err);
			setError('Failed to update subscription tier');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<UserContext.Provider
			value={{ user, isLoading, error, syncUser, logout, updateTier }}
		>
			{children}
		</UserContext.Provider>
	);
}

export function useUser() {
	const context = useContext(UserContext);
	if (context === undefined) {
		throw new Error('useUser must be used within a UserProvider');
	}
	return context;
}
