export enum SubscriptionTier {
	STUDENT = 1,
	SCHOLAR = 2,
	HISTORIAN = 3,
}

export interface User {
	id: string;
	email: string;
	username: string;
	subscription_tier: SubscriptionTier;
	created_at?: string;
	last_sign_in_at?: string;
}

export interface UserMetadata {
	subscription_tier: SubscriptionTier;
}

export interface TokenData {
	clerk_id: string;
	tier: SubscriptionTier;
}
