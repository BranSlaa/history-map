export enum SubscriptionTier {
	STUDENT = 1,
	SCHOLAR = 2,
	HISTORIAN = 3,
}

export interface Profile {
	id: string;
	username: string;
	full_name?: string;
	avatar_url?: string;
	website?: string;
	subscription_tier: SubscriptionTier;
	updated_at?: string;
}

export interface User {
	id: string;
	email?: string;
	full_name?: string;
	avatar_url?: string;
	billing_address?: any;
	payment_method?: any;
	profile_id: string;
	profile?: Profile;
}

export interface Subscription {
	id: string;
	user_id: string;
	status: 'trialing' | 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'unpaid';
	price_id: string;
	quantity: number;
	cancel_at_period_end: boolean;
	created: string;
	current_period_start: string;
	current_period_end: string;
	ended_at?: string;
	cancel_at?: string;
	canceled_at?: string;
	trial_start?: string;
	trial_end?: string;
	price?: Price;
}

export interface Price {
	id: string;
	product_id: string;
	active: boolean;
	description?: string;
	unit_amount: number;
	currency: string;
	type: 'one_time' | 'recurring';
	interval?: 'day' | 'week' | 'month' | 'year';
	interval_count?: number;
	trial_period_days?: number;
	product?: Product;
}

export interface Product {
	id: string;
	active: boolean;
	name: string;
	description?: string;
	image?: string;
	metadata?: Record<string, any>;
}

export interface UserMetadata {
	subscription_tier: SubscriptionTier;
	full_name?: string;
	avatar_url?: string;
}

export interface TokenData {
	clerk_id: string;
	tier: SubscriptionTier;
}
