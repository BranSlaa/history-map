'use client';

import {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from 'react';
import { User, SubscriptionTier, UserMetadata } from '@/types/user';
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

			const { data: userData, error: userError } = await supabase
				.from('users')
				.select('*')
				.eq('id', session.user.id)
				.single();

			if (userError) {
				if (userError.code === 'PGRST116') {
					// User not found in the database, create a new record
					const { data: newUser, error: createError } = await supabase
						.from('users')
						.insert([
							{
								id: session.user.id,
								email: session.user.email,
								username:
									session.user.email?.split('@')[0] ||
									session.user.id,
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
