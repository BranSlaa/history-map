-- Drop existing tables and triggers that will be replaced
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop tables if they exist (in the correct order to avoid constraint violations)
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Create storage buckets for avatars
INSERT INTO storage.buckets (id, name)
  VALUES ('avatars', 'avatars')
  ON CONFLICT (id) DO NOTHING;

-- Set up access controls for storage
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible." ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
CREATE POLICY "Anyone can upload an avatar." ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars');

-- Create the NextAuth schema
CREATE SCHEMA IF NOT EXISTS next_auth;

GRANT USAGE ON SCHEMA next_auth TO service_role;
GRANT ALL ON SCHEMA next_auth TO postgres;

-- Create NextAuth tables
CREATE TABLE IF NOT EXISTS next_auth.users
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text,
    email text,
    "emailVerified" timestamp with time zone,
    image text,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT email_unique UNIQUE (email)
);

GRANT ALL ON TABLE next_auth.users TO postgres;
GRANT ALL ON TABLE next_auth.users TO service_role;

-- uid() function to be used in RLS policies
CREATE OR REPLACE FUNCTION next_auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select
    coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;

CREATE TABLE IF NOT EXISTS next_auth.sessions
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    expires timestamp with time zone NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" uuid,
    CONSTRAINT sessions_pkey PRIMARY KEY (id),
    CONSTRAINT sessionToken_unique UNIQUE ("sessionToken"),
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES next_auth.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

GRANT ALL ON TABLE next_auth.sessions TO postgres;
GRANT ALL ON TABLE next_auth.sessions TO service_role;

CREATE TABLE IF NOT EXISTS next_auth.accounts
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at bigint,
    token_type text,
    scope text,
    id_token text,
    session_state text,
    oauth_token_secret text,
    oauth_token text,
    "userId" uuid,
    CONSTRAINT accounts_pkey PRIMARY KEY (id),
    CONSTRAINT provider_unique UNIQUE (provider, "providerAccountId"),
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES next_auth.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

GRANT ALL ON TABLE next_auth.accounts TO postgres;
GRANT ALL ON TABLE next_auth.accounts TO service_role;

CREATE TABLE IF NOT EXISTS next_auth.verification_tokens
(
    identifier text,
    token text,
    expires timestamp with time zone NOT NULL,
    CONSTRAINT verification_tokens_pkey PRIMARY KEY (token),
    CONSTRAINT token_unique UNIQUE (token),
    CONSTRAINT token_identifier_unique UNIQUE (token, identifier)
);

GRANT ALL ON TABLE next_auth.verification_tokens TO postgres;
GRANT ALL ON TABLE next_auth.verification_tokens TO service_role;

-- USER MANAGEMENT
-- Create a table for public profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  username text UNIQUE,
  full_name text,
  avatar_url text,
  website text,
  subscription_tier SMALLINT DEFAULT 1,

  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
ALTER TABLE IF EXISTS profiles
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
CREATE POLICY "Users can insert their own profile." ON profiles
  FOR INSERT WITH CHECK ((auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
CREATE POLICY "Users can update own profile." ON profiles
  FOR UPDATE USING ((auth.uid()) = id);

-- This trigger automatically creates a profile entry when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Create the profile
  INSERT INTO public.profiles (id, full_name, avatar_url, username)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(
      new.raw_user_meta_data->>'username', 
      split_part(new.email, '@', 1)
    )
  );
  
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  -- UUID from auth.users
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  -- The user's customer ID in Stripe
  stripe_customer_id text
);

ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
-- No policies as this is a private table

-- PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  -- Product ID from Stripe, e.g. prod_1234.
  id text PRIMARY KEY,
  -- Whether the product is currently available for purchase.
  active boolean,
  -- The product's name
  name text,
  -- The product's description
  description text,
  -- A URL of the product image in Stripe
  image text,
  -- Set of key-value pairs
  metadata jsonb
);

-- Set up RLS policies
ALTER TABLE IF EXISTS products
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-only access." ON products;
CREATE POLICY "Allow public read-only access." ON products
  FOR SELECT USING (true);

-- PRICES
CREATE TYPE IF NOT EXISTS pricing_type AS ENUM ('one_time', 'recurring');
CREATE TYPE IF NOT EXISTS pricing_plan_interval AS ENUM ('day', 'week', 'month', 'year');

CREATE TABLE IF NOT EXISTS prices (
  -- Price ID from Stripe, e.g. price_1234.
  id text PRIMARY KEY,
  -- The ID of the product that this price belongs to.
  product_id text REFERENCES products,
  -- Whether the price can be used for new purchases.
  active boolean,
  -- A brief description of the price.
  description text,
  -- The unit amount in smallest currency unit
  unit_amount bigint,
  -- Three-letter ISO currency code, in lowercase.
  currency text CHECK (char_length(currency) = 3),
  -- One of `one_time` or `recurring`
  type pricing_type,
  -- One of `day`, `week`, `month` or `year`
  interval pricing_plan_interval,
  -- The number of intervals between subscription billings
  interval_count integer,
  -- Default number of trial days
  trial_period_days integer,
  -- Additional information
  metadata jsonb
);

-- Set up RLS policies
ALTER TABLE IF EXISTS prices
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-only access." ON prices;
CREATE POLICY "Allow public read-only access." ON prices
  FOR SELECT USING (true);

-- SUBSCRIPTIONS
CREATE TYPE IF NOT EXISTS subscription_status AS ENUM ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid');

CREATE TABLE IF NOT EXISTS subscriptions (
  -- Subscription ID from Stripe, e.g. sub_1234.
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  -- The status of the subscription object
  status subscription_status,
  -- Additional information
  metadata jsonb,
  -- ID of the price that created this subscription.
  price_id text REFERENCES prices,
  -- Quantity
  quantity integer,
  -- If true, subscription will be deleted at end of billing period
  cancel_at_period_end boolean,
  -- Time at which the subscription was created.
  created timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Start of the current period
  current_period_start timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- End of the current period
  current_period_end timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- If the subscription has ended
  ended_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  -- Future cancellation date
  cancel_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  -- Cancellation date
  canceled_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  -- Trial start
  trial_start timestamp with time zone DEFAULT timezone('utc'::text, now()),
  -- Trial end
  trial_end timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE IF EXISTS subscriptions
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Can only view own subs data." ON subscriptions
  FOR SELECT USING ((auth.uid()) = user_id);

-- REALTIME SUBSCRIPTIONS
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime
  FOR TABLE products, prices;

-- Migrate existing data from users table to profiles
INSERT INTO profiles (id, username, subscription_tier)
SELECT 
    u.id, 
    COALESCE(split_part(u.email, '@', 1), 'user_' || u.id), -- Create username from email
    COALESCE((u.raw_user_meta_data->>'subscription_tier')::smallint, 1) -- Get tier from metadata or use default
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;