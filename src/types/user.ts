export enum SubscriptionTier {
	STUDENT = 1,
	SCHOLAR = 2,
	HISTORIAN = 3,
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
