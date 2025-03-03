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
import { User, SubscriptionTier } from '@/types/user';
import supabase from '@/lib/supabaseClient';

interface AuthContextType {
	authUser: SupabaseUser | null;
	user: User | null;
	loading: boolean;
	error: string | null;
	signOut: () => Promise<{ error: AuthError | null }>;
	updateTier: (tier: SubscriptionTier) => Promise<void>;
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
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	const syncUser = async (sessionUser: SupabaseUser | null) => {
		setError(null);

		if (!sessionUser) {
			setUser(null);
			return;
		}

		try {
			// Fetch user data from the database
			const { data: userData, error: userError } = await supabase
				.from('users')
				.select('*')
				.eq('id', sessionUser.id)
				.single();

			if (userError) {
				if (userError.code === 'PGRST116') {
					// User not found in the database, create a new record
					const { data: newUser, error: createError } = await supabase
						.from('users')
						.insert([
							{
								id: sessionUser.id,
								email: sessionUser.email,
								username:
									sessionUser.email?.split('@')[0] ||
									sessionUser.id,
								subscription_tier: SubscriptionTier.STUDENT,
							},
						])
						.select('*')
						.single();

					if (createError) {
						throw createError;
					}

					setUser(newUser as User);
				} else {
					throw userError;
				}
			} else {
				setUser(userData as User);
			}
		} catch (err) {
			console.error('Error syncing user:', err);
			setError(
				`Error syncing user: ${
					err instanceof Error ? err.message : JSON.stringify(err)
				}`,
			);
		}
	};

	useEffect(() => {
		const setupAuth = async () => {
			setLoading(true);

			// Get initial session
			const {
				data: { session },
			} = await supabase.auth.getSession();
			setAuthUser(session?.user || null);
			await syncUser(session?.user || null);

			setLoading(false);

			// Set up auth state change listener
			const {
				data: { subscription },
			} = supabase.auth.onAuthStateChange(async (event, session) => {
				setAuthUser(session?.user || null);
				await syncUser(session?.user || null);
			});

			return () => subscription.unsubscribe();
		};

		const unsubscribe = setupAuth();

		return () => {
			unsubscribe.then(unsub => unsub());
		};
	}, []);

	const updateTier = async (tier: SubscriptionTier) => {
		setLoading(true);
		setError(null);

		try {
			if (!user || !authUser) throw new Error('No user logged in');

			const { data, error } = await supabase
				.from('users')
				.update({ subscription_tier: tier })
				.eq('id', user.id)
				.select('*')
				.single();

			if (error) throw error;
			setUser(data as User);
		} catch (err) {
			console.error('Error updating tier:', err);
			setError(
				`Error updating subscription tier: ${
					err instanceof Error ? err.message : JSON.stringify(err)
				}`,
			);
		} finally {
			setLoading(false);
		}
	};

	const value: AuthContextType = {
		authUser,
		user,
		loading,
		error,
		signOut: () => supabase.auth.signOut(),
		updateTier,
	};

	return (
		<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
	);
}

export const useAuth = (): AuthContextType => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};
