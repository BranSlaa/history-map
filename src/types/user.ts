export enum SubscriptionTier {
	STUDENT = 'student',
	SCHOLAR = 'scholar',
	HISTORIAN = 'historian',
}

export interface User {
	id: string;
	clerk_id: string;
	username: string;
	email: string;
	subscription_tier: SubscriptionTier;
	created_at?: string;
}

export interface TokenData {
	clerk_id: string;
	tier: SubscriptionTier;
}
