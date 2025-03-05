# Implementing Supabase Starters for Authentication and Subscriptions

This guide explains how to migrate your History Map application to use the Supabase Starters for Authentication and Subscriptions. These changes improve user management, enable storage for avatars, and prepare your app for subscription capabilities with Stripe integration.

## Database Migration Steps

1. **Run the SQL Migration Script**:

    - Execute the script in `supabase/migrations/20231206_implement_supabase_starters.sql` through the Supabase SQL Editor
    - This script will:
        - Create the NextAuth schema and tables
        - Set up user profiles and users tables following Supabase's recommended approach
        - Add subscription-related tables (customers, products, prices, subscriptions)
        - Configure Row Level Security policies
        - Create storage buckets for avatar images
        - Migrate existing user data to the new tables

2. **Prepare for Stripe Integration** (Optional):
    - If you plan to use Stripe for payments, follow the [Supabase Stripe setup guide](https://supabase.com/docs/guides/auth/auth-stripe)
    - Configure Stripe webhooks to update your subscription tables

## Code Changes

The following files have been updated to work with the new schema:

1. **User Types** (`src/types/user.ts`):

    - Added new interfaces for Profile, User, Subscription, Price, and Product
    - Modified the User interface to match the new database schema

2. **Auth Context** (`src/context/AuthContext.tsx`):

    - Updated to work with both the User and Profile objects
    - Changed `updateTier` to a more general `updateProfile` function
    - Improved error handling and added better logging

3. **Profile Page** (`src/app/profile/page.tsx`):
    - Enhanced with avatar upload capabilities
    - Added form fields for username, full name, and website
    - Shows subscription information if available
    - Improved UI with better form layout and avatar display

## Testing the Changes

After deploying these changes:

1. **Test Authentication Flow**:

    - Sign out and sign back in to verify the authentication process works
    - Check that you can access the profile page when authenticated

2. **Test Profile Management**:

    - Upload a profile avatar image
    - Update your profile information
    - Verify that subscription tier changes are saved

3. **Check Database Tables**:
    - Verify that user data is properly stored in both profiles and users tables
    - Confirm that RLS policies are properly restricting access

## Troubleshooting

If you encounter issues:

1. **Authentication Problems**:

    - Check browser console for error messages
    - Verify that Supabase auth cookies are being properly set
    - Review the middleware logs to track authentication state

2. **Profile Page Issues**:

    - Check if user and profile data is being properly fetched
    - Ensure the storage bucket for avatars is properly configured

3. **Database Migration Issues**:
    - If there are SQL errors, you may need to manually drop and recreate conflicting objects
    - Check for constraint violations when migrating data

## Next Steps

Once the migration is complete, you can enhance your application by:

1. **Implementing Stripe Integration** for paid subscriptions
2. **Creating Subscription Plans** in the Stripe dashboard and syncing to your database
3. **Adding a Subscription Management Page** for users to change their plans
4. **Setting up Feature Flags** based on subscription tiers

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Stripe Integration Guide](https://supabase.com/docs/guides/auth/auth-stripe)
- [NextAuth with Supabase](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
