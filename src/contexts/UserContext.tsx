'use client';

import {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from 'react';
import { User, Profile, SubscriptionTier, UserMetadata } from '@/types/user';
import supabase from '@/lib/supabaseClient';

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
					const { data: newProfile, error: createError } =
						await supabase
							.from('profiles')
							.insert([
								{
									id: session.user.id,
									username:
										session.user.email?.split('@')[0] ||
										`user_${session.user.id}`,
									full_name:
										session.user.user_metadata?.full_name ||
										'',
									avatar_url:
										session.user.user_metadata
											?.avatar_url || '',
									subscription_tier: SubscriptionTier.STUDENT,
								},
							])
							.select('*')
							.single();

					if (createError) {
						throw createError;
					}

					// Construct a user object with the profile data
					const constructedUser: User = {
						id: session.user.id,
						email: session.user.email,
						profile_id: session.user.id,
						full_name: session.user.user_metadata?.full_name || '',
						avatar_url:
							session.user.user_metadata?.avatar_url || '',
						profile: newProfile as Profile,
					};

					setUser(constructedUser);
				} else {
					throw profileError;
				}
			} else {
				// We have the profile, construct the user object
				const constructedUser: User = {
					id: session.user.id,
					email: session.user.email,
					profile_id: profileData.id,
					full_name:
						session.user.user_metadata?.full_name ||
						profileData.full_name,
					avatar_url:
						session.user.user_metadata?.avatar_url ||
						profileData.avatar_url,
					profile: profileData as Profile,
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
		try {
			if (!user) throw new Error('No user logged in');

			// Update the profile's subscription tier instead of the user's
			const { data, error } = await supabase
				.from('profiles')
				.update({ subscription_tier: tier })
				.eq('id', user.id)
				.select('*')
				.single();

			if (error) throw error;

			// Create an updated user object with the new profile data
			const updatedUser: User = {
				...user,
				profile: data as Profile,
			};

			setUser(updatedUser);
		} catch (err) {
			console.error('Error updating tier:', err);
			setError(
				`Error updating subscription tier: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
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
