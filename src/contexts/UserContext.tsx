'use client';

import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from 'react';
import { User as AuthUser } from '@supabase/supabase-js';
import { User, Profile, SubscriptionTier, UserMetadata } from '@/types/user';
import supabase from '@/lib/supabaseClient';
import { generateUsername } from '@/utils/usernameGenerator';

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
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	const syncUser = async () => {
		setIsLoading(true);
		setError(null);

		try {
			const {
				data: { session },
				error: authError,
			} = await supabase.auth.getSession();

			if (authError) {
				throw authError;
			}

			if (!session) {
				console.log('No active session');
				setUser(null);
				setIsLoading(false);
				return;
			}

			// Try fetching the profile directly
			const { data: profileData, error: profileError } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', session.user.id)
				.single();

			if (profileError) {
				if (profileError.code === 'PGRST116') {
					// Profile not found, create a new one
					console.log(
						'Creating new profile for user',
						session.user.id,
					);

					// Generate a username using our generator
					const username = generateUsername();

					// Use API endpoint instead of direct supabaseAdmin
					try {
						const response = await fetch('/api/profile', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: session.user.id,
								username: username,
								avatar_url:
									session.user.user_metadata?.avatar_url ||
									'',
								tier: 'student',
							}),
						});

						if (!response.ok) {
							throw new Error('Failed to create profile');
						}

						const result = await response.json();
						const newProfile = result.data;

						// Construct a user object with the profile data
						const constructedUser: User = {
							id: session.user.id,
							email: session.user.email,
							profile_id: session.user.id,
							username: username,
							avatar_url:
								session.user.user_metadata?.avatar_url || '',
							profile: {
								...newProfile,
								subscription_tier: mapTierToEnum(
									newProfile.tier,
								), // Map string tier to enum
							} as Profile,
						};

						setUser(constructedUser);
					} catch (err) {
						console.error('Error creating profile:', err);
						throw err;
					}
				} else {
					throw profileError;
				}
			} else {
				// We have the profile, construct the user object
				const constructedUser: User = {
					id: session.user.id,
					email: session.user.email,
					profile_id: profileData.id,
					username: profileData.username || generateUsername(),
					avatar_url:
						session.user.user_metadata?.avatar_url ||
						profileData.avatar_url,
					profile: {
						...profileData,
						subscription_tier: mapTierToEnum(profileData.tier),
					} as Profile,
				};

				setUser(constructedUser);
			}
		} catch (err) {
			console.error('Error syncing user:', err);
			setError(
				`Error syncing user: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
			setUser(null);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		syncUser();

		// Subscribe to auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event, session) => {
			if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
				syncUser();
			} else if (event === 'SIGNED_OUT') {
				setUser(null);
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	const logout = async () => {
		setIsLoading(true);
		try {
			const { error } = await supabase.auth.signOut();
			if (error) {
				throw error;
			}
			setUser(null);
		} catch (err) {
			console.error('Error signing out:', err);
			setError(
				`Error signing out: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
		} finally {
			setIsLoading(false);
		}
	};

	const updateTier = async (tier: SubscriptionTier) => {
		setIsLoading(true);
		setError(null);

		if (!user) {
			console.error('Cannot update tier: No user logged in');
			return;
		}

		try {
			// Update the profile with new tier
			const { error } = await supabase
				.from('profiles')
				.update({
					subscription_tier: tier,
					updated_at: new Date().toISOString(),
				})
				.eq('id', user.id);

			if (error) {
				throw error;
			}

			// Update the local user state
			setUser(prevUser => {
				if (!prevUser) return null;
				return {
					...prevUser,
					profile: {
						...prevUser.profile!,
						subscription_tier: tier,
					},
				};
			});
		} catch (err) {
			console.error('Error updating tier:', err);
			throw err;
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

// Helper function to map string tier to enum
function mapTierToEnum(tier: string): SubscriptionTier {
	switch (tier?.toLowerCase()) {
		case 'student':
			return SubscriptionTier.STUDENT;
		case 'scholar':
			return SubscriptionTier.SCHOLAR;
		case 'historian':
			return SubscriptionTier.HISTORIAN;
		default:
			return SubscriptionTier.STUDENT;
	}
}
