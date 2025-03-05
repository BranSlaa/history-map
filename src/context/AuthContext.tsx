'use client';

import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from 'react';
import {
	Session,
	User as SupabaseUser,
	AuthError,
} from '@supabase/supabase-js';
import { User, Profile, SubscriptionTier } from '@/types/user';
import supabase from '@/lib/supabaseClient';

interface AuthContextType {
	authUser: SupabaseUser | null;
	user: User | null;
	profile: Profile | null;
	loading: boolean;
	error: string | null;
	signOut: () => Promise<{ error: AuthError | null }>;
	updateProfile: (profile: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
	children: ReactNode;
}

export function AuthProvider({
	children,
}: AuthProviderProps): React.ReactElement {
	const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
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

			// Try fetching the profile directly
			const { data: profileData, error: profileError } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', sessionUser.id)
				.single();

			if (profileError) {
				console.error('Error fetching profile:', profileError);

				// Profile doesn't exist - this could be a new user
				// Create a new profile for the user
				const { data: newProfileData, error: createProfileError } =
					await supabase
						.from('profiles')
						.insert([
							{
								id: sessionUser.id,
								username:
									sessionUser.email?.split('@')[0] ||
									`user_${sessionUser.id}`,
								full_name:
									sessionUser.user_metadata?.full_name || '',
								avatar_url:
									sessionUser.user_metadata?.avatar_url || '',
								subscription_tier: SubscriptionTier.STUDENT,
							},
						])
						.select('*')
						.single();

				if (createProfileError) {
					console.error(
						'Error creating profile:',
						createProfileError,
					);
					setUser(null);
					setProfile(null);
					throw new Error('Failed to create profile');
				}

				// Set the new profile
				setProfile(newProfileData as Profile);

				// Create a user object from the profile data
				const constructedUser: User = {
					id: sessionUser.id,
					profile_id: newProfileData.id,
					email: sessionUser.email,
					full_name:
						sessionUser.user_metadata?.full_name ||
						newProfileData.full_name,
					avatar_url:
						sessionUser.user_metadata?.avatar_url ||
						newProfileData.avatar_url,
					profile: newProfileData as Profile,
				};
				setUser(constructedUser);
			} else {
				// Successfully retrieved profile
				setProfile(profileData as Profile);

				// Construct user from auth user and profile data
				const constructedUser: User = {
					id: sessionUser.id,
					profile_id: profileData.id,
					email: sessionUser.email,
					full_name:
						sessionUser.user_metadata?.full_name ||
						profileData.full_name,
					avatar_url:
						sessionUser.user_metadata?.avatar_url ||
						profileData.avatar_url,
					profile: profileData as Profile,
				};
				setUser(constructedUser);
			}
		} catch (err) {
			console.error('Error syncing user:', err);
			setError(
				`Error syncing user: ${
					err instanceof Error ? err.message : JSON.stringify(err)
				}`,
			);
			setUser(null);
			setProfile(null);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		let mounted = true;

		const setupAuth = async () => {
			try {
				console.log('Setting up auth...');
				setIsLoading(true);

				// Get initial session
				const {
					data: { session },
				} = await supabase.auth.getSession();

				console.log('Initial session:', session?.user?.id);

				if (session?.user) {
					setAuthUser(session.user);
					await syncUser(session.user);
				} else {
					setAuthUser(null);
					setUser(null);
					setProfile(null);
				}

				// Set up auth state change listener
				const {
					data: { subscription },
				} = supabase.auth.onAuthStateChange(async (event, session) => {
					console.log('Auth state change:', event, session?.user?.id);
					setAuthUser(session?.user || null);

					if (session?.user) {
						await syncUser(session.user);
					} else {
						setUser(null);
						setProfile(null);
					}
				});

				return () => {
					subscription.unsubscribe();
				};
			} catch (error) {
				console.error('Error setting up auth:', error);
			} finally {
				if (mounted) {
					setIsLoading(false);
				}
			}
		};

		setupAuth();

		return () => {
			mounted = false;
		};
	}, []);

	const updateProfile = async (profileData: Partial<Profile>) => {
		setIsLoading(true);
		setError(null);

		try {
			if (!profile || !authUser) throw new Error('No user logged in');

			const { data, error } = await supabase
				.from('profiles')
				.update(profileData)
				.eq('id', profile.id)
				.select('*')
				.single();

			if (error) throw error;
			setProfile(data as Profile);

			// Update the user object with the new profile data
			if (user) {
				const updatedUser: User = {
					...user,
					full_name: data.full_name || user.full_name,
					avatar_url: data.avatar_url || user.avatar_url,
					profile: data as Profile,
				};
				setUser(updatedUser);
			}
		} catch (err) {
			console.error('Error updating profile:', err);
			setError(
				`Error updating profile: ${
					err instanceof Error ? err.message : JSON.stringify(err)
				}`,
			);
		} finally {
			setIsLoading(false);
		}
	};

	const signOut = async () => {
		// Clear all state
		setAuthUser(null);
		setUser(null);
		setProfile(null);

		// Call Supabase signOut with global scope to ensure complete logout
		return await supabase.auth.signOut({ scope: 'global' });
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
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};
