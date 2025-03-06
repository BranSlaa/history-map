-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- =======================================================
-- USER PROFILE TABLES
-- =======================================================

-- Create profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    subscription_tier SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sign_in_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on profiles
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Service role has full access to profiles
DROP POLICY IF EXISTS "Service role has full access to profiles" ON profiles;
CREATE POLICY "Service role has full access to profiles"
    ON profiles FOR ALL
    USING (current_setting('role') = 'service_role');

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, subscription_tier)
    VALUES (
        new.id, 
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 
        COALESCE((new.raw_user_meta_data->>'subscription_tier')::smallint, 1)
    );
    RETURN new;
END;
$$;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =======================================================
-- EVENTS AND EVENT RELATIONSHIPS
-- =======================================================

-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    year INTEGER NOT NULL,
    lat FLOAT NOT NULL,
    lon FLOAT NOT NULL,
    subject TEXT NOT NULL,
    info TEXT NOT NULL,
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on events
ALTER TABLE IF EXISTS events ENABLE ROW LEVEL SECURITY;

-- Public events are viewable by everyone
DROP POLICY IF EXISTS "Public events are viewable by everyone" ON events;
CREATE POLICY "Public events are viewable by everyone" 
    ON events FOR SELECT 
    USING (true);

-- Service role has full access to events
DROP POLICY IF EXISTS "Service role has full access to events" ON events;
CREATE POLICY "Service role has full access to events" 
    ON events FOR ALL 
    USING (current_setting('role') = 'service_role');

-- Create key_terms table
CREATE TABLE IF NOT EXISTS public.key_terms (
    id SERIAL PRIMARY KEY,
    term TEXT UNIQUE NOT NULL
);

-- Enable RLS on key_terms
ALTER TABLE IF EXISTS public.key_terms ENABLE ROW LEVEL SECURITY;

-- Allow public read access to key_terms
DROP POLICY IF EXISTS "Key terms are viewable by everyone" ON key_terms;
CREATE POLICY "Key terms are viewable by everyone" 
    ON key_terms FOR SELECT 
    USING (true);

-- Only authenticated users can modify key terms
DROP POLICY IF EXISTS "Only authenticated users can insert key terms" ON key_terms;
CREATE POLICY "Only authenticated users can insert key terms" 
    ON key_terms FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Service role has full access to key_terms
DROP POLICY IF EXISTS "Service role has full access to key terms" ON key_terms;
CREATE POLICY "Service role has full access to key terms"
    ON key_terms FOR ALL
    USING (current_setting('role') = 'service_role');

-- Create event_key_terms junction table
CREATE TABLE IF NOT EXISTS public.event_key_terms (
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    key_term_id INTEGER REFERENCES public.key_terms(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, key_term_id)
);

-- Enable RLS on event_key_terms
ALTER TABLE IF EXISTS public.event_key_terms ENABLE ROW LEVEL SECURITY;

-- Allow public read access to event_key_terms
DROP POLICY IF EXISTS "Event key terms are viewable by everyone" ON event_key_terms;
CREATE POLICY "Event key terms are viewable by everyone" 
    ON event_key_terms FOR SELECT 
    USING (true);

-- Only authenticated users can modify event key terms
DROP POLICY IF EXISTS "Only authenticated users can insert event key terms" ON event_key_terms;
CREATE POLICY "Only authenticated users can insert event key terms" 
    ON event_key_terms FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Service role has full access to event_key_terms
DROP POLICY IF EXISTS "Service role has full access to event key terms" ON event_key_terms;
CREATE POLICY "Service role has full access to event key terms"
    ON event_key_terms FOR ALL
    USING (current_setting('role') = 'service_role');

-- Create event_connections table
CREATE TABLE IF NOT EXISTS public.event_connections (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source_event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    target_event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    connection_strength INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, source_event_id, target_event_id)
);

-- Enable RLS on event_connections
ALTER TABLE IF EXISTS event_connections ENABLE ROW LEVEL SECURITY;

-- Users can view their own event connections
DROP POLICY IF EXISTS "Users can view their own event connections" ON event_connections;
CREATE POLICY "Users can view their own event connections" 
    ON event_connections FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own event connections
DROP POLICY IF EXISTS "Users can insert their own event connections" ON event_connections;
CREATE POLICY "Users can insert their own event connections" 
    ON event_connections FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own event connections
DROP POLICY IF EXISTS "Users can update their own event connections" ON event_connections;
CREATE POLICY "Users can update their own event connections" 
    ON event_connections FOR UPDATE 
    USING (auth.uid() = user_id);

-- Service role has full access to event_connections
DROP POLICY IF EXISTS "Service role has full access to event connections" ON event_connections;
CREATE POLICY "Service role has full access to event connections" 
    ON event_connections FOR ALL 
    USING (current_setting('role') = 'service_role');

-- =======================================================
-- USER INTERACTIONS WITH EVENTS
-- =======================================================

-- Create user_event_interactions table
CREATE TABLE IF NOT EXISTS public.user_event_interactions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    previous_event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL,
    next_event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL,
    interaction_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- Enable RLS on user_event_interactions
ALTER TABLE IF EXISTS user_event_interactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own event interactions
DROP POLICY IF EXISTS "Users can view their own event interactions" ON user_event_interactions;
CREATE POLICY "Users can view their own event interactions" 
    ON user_event_interactions FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own event interactions
DROP POLICY IF EXISTS "Users can insert their own event interactions" ON user_event_interactions;
CREATE POLICY "Users can insert their own event interactions" 
    ON user_event_interactions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own event interactions
DROP POLICY IF EXISTS "Users can update their own event interactions" ON user_event_interactions;
CREATE POLICY "Users can update their own event interactions" 
    ON user_event_interactions FOR UPDATE 
    USING (auth.uid() = user_id);

-- Service role has full access to user_event_interactions
DROP POLICY IF EXISTS "Service role has full access to user interactions" ON user_event_interactions;
CREATE POLICY "Service role has full access to user interactions" 
    ON user_event_interactions FOR ALL 
    USING (current_setting('role') = 'service_role');

-- Create user_paths table to track chosen and unchosen events
CREATE TABLE IF NOT EXISTS public.user_paths (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    path_data JSONB NOT NULL DEFAULT '{"chosenEvents": [], "unchosenEvents": []}',
    current_event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_paths
ALTER TABLE IF EXISTS public.user_paths ENABLE ROW LEVEL SECURITY;

-- Users can view their own paths
DROP POLICY IF EXISTS "Users can view their own paths" ON user_paths;
CREATE POLICY "Users can view their own paths"
    ON user_paths FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own paths
DROP POLICY IF EXISTS "Users can insert their own paths" ON user_paths;
CREATE POLICY "Users can insert their own paths"
    ON user_paths FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own paths
DROP POLICY IF EXISTS "Users can update their own paths" ON user_paths;
CREATE POLICY "Users can update their own paths"
    ON user_paths FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role has full access to user_paths
DROP POLICY IF EXISTS "Service role has full access to user paths" ON user_paths;
CREATE POLICY "Service role has full access to user paths"
    ON user_paths FOR ALL
    USING (current_setting('role') = 'service_role');

-- =======================================================
-- SEARCH AND VECTOR SEARCH
-- =======================================================

-- Create search_terms table
CREATE TABLE IF NOT EXISTS public.search_terms (
    term TEXT PRIMARY KEY,
    search_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    last_searched TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on search_terms
ALTER TABLE IF EXISTS search_terms ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view the search_terms table
DROP POLICY IF EXISTS "Search terms are viewable by authenticated users only" ON search_terms;
CREATE POLICY "Search terms are viewable by authenticated users only" 
    ON search_terms FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Service role can modify search terms (needed for track_search_term function)
DROP POLICY IF EXISTS "Service role can modify search terms" ON search_terms;
CREATE POLICY "Service role can modify search terms" 
    ON search_terms FOR ALL 
    USING (current_setting('role') = 'service_role');

-- Create similarity search function
CREATE OR REPLACE FUNCTION match_events(query_embedding VECTOR(1536), match_threshold FLOAT, match_count INT)
RETURNS TABLE (
    id TEXT,
    title TEXT,
    year INTEGER,
    lat FLOAT,
    lon FLOAT,
    subject TEXT,
    info TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        events.id,
        events.title,
        events.year,
        events.lat,
        events.lon,
        events.subject,
        events.info,
        1 - (events.embedding <=> query_embedding) AS similarity
    FROM events
    WHERE 1 - (events.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Create function to track search terms
CREATE OR REPLACE FUNCTION track_search_term(p_term TEXT, p_had_results BOOLEAN DEFAULT FALSE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO search_terms (term, search_count, success_count)
    VALUES (p_term, 1, CASE WHEN p_had_results THEN 1 ELSE 0 END)
    ON CONFLICT (term)
    DO UPDATE SET
        search_count = search_terms.search_count + 1,
        success_count = search_terms.success_count + CASE WHEN p_had_results THEN 1 ELSE 0 END,
        last_searched = NOW();
END;
$$;

-- Create view for popular search terms (without SECURITY DEFINER)
DROP VIEW IF EXISTS popular_search_terms;
CREATE VIEW popular_search_terms AS
SELECT term, search_count, success_count
FROM search_terms
ORDER BY search_count DESC;

-- =======================================================
-- QUIZ SYSTEM
-- =======================================================

-- Create quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    question_count INTEGER NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create questions table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    explanation TEXT,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    points INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create question options table-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- =======================================================
-- USER PROFILE TABLES
-- =======================================================

-- Create profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    subscription_tier SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sign_in_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on profiles
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Service role has full access to profiles
DROP POLICY IF EXISTS "Service role has full access to profiles" ON profiles;
CREATE POLICY "Service role has full access to profiles"
    ON profiles FOR ALL
    USING (current_setting('role') = 'service_role');

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, subscription_tier)
    VALUES (
        new.id, 
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 
        COALESCE((new.raw_user_meta_data->>'subscription_tier')::smallint, 1)
    );
    RETURN new;
END;
$$;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =======================================================
-- EVENTS AND EVENT RELATIONSHIPS
-- =======================================================

-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    year INTEGER NOT NULL,
    lat FLOAT NOT NULL,
    lon FLOAT NOT NULL,
    subject TEXT NOT NULL,
    info TEXT NOT NULL,
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on events
ALTER TABLE IF EXISTS events ENABLE ROW LEVEL SECURITY;

-- Public events are viewable by everyone
DROP POLICY IF EXISTS "Public events are viewable by everyone" ON events;
CREATE POLICY "Public events are viewable by everyone" 
    ON events FOR SELECT 
    USING (true);

-- Service role has full access to events
DROP POLICY IF EXISTS "Service role has full access to events" ON events;
CREATE POLICY "Service role has full access to events" 
    ON events FOR ALL 
    USING (current_setting('role') = 'service_role');

-- Create key_terms table
CREATE TABLE IF NOT EXISTS public.key_terms (
    id SERIAL PRIMARY KEY,
    term TEXT UNIQUE NOT NULL
);

-- Enable RLS on key_terms
ALTER TABLE IF EXISTS public.key_terms ENABLE ROW LEVEL SECURITY;

-- Allow public read access to key_terms
DROP POLICY IF EXISTS "Key terms are viewable by everyone" ON key_terms;
CREATE POLICY "Key terms are viewable by everyone" 
    ON key_terms FOR SELECT 
    USING (true);

-- Only authenticated users can modify key terms
DROP POLICY IF EXISTS "Only authenticated users can insert key terms" ON key_terms;
CREATE POLICY "Only authenticated users can insert key terms" 
    ON key_terms FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Service role has full access to key_terms
DROP POLICY IF EXISTS "Service role has full access to key terms" ON key_terms;
CREATE POLICY "Service role has full access to key terms"
    ON key_terms FOR ALL
    USING (current_setting('role') = 'service_role');

-- Create event_key_terms junction table
CREATE TABLE IF NOT EXISTS public.event_key_terms (
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    key_term_id INTEGER REFERENCES public.key_terms(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, key_term_id)
);

-- Enable RLS on event_key_terms
ALTER TABLE IF EXISTS public.event_key_terms ENABLE ROW LEVEL SECURITY;

-- Allow public read access to event_key_terms
DROP POLICY IF EXISTS "Event key terms are viewable by everyone" ON event_key_terms;
CREATE POLICY "Event key terms are viewable by everyone" 
    ON event_key_terms FOR SELECT 
    USING (true);

-- Only authenticated users can modify event key terms
DROP POLICY IF EXISTS "Only authenticated users can insert event key terms" ON event_key_terms;
CREATE POLICY "Only authenticated users can insert event key terms" 
    ON event_key_terms FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Service role has full access to event_key_terms
DROP POLICY IF EXISTS "Service role has full access to event key terms" ON event_key_terms;
CREATE POLICY "Service role has full access to event key terms"
    ON event_key_terms FOR ALL
    USING (current_setting('role') = 'service_role');

-- Create event_connections table
CREATE TABLE IF NOT EXISTS public.event_connections (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source_event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    target_event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    connection_strength INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, source_event_id, target_event_id)
);

-- Enable RLS on event_connections
ALTER TABLE IF EXISTS event_connections ENABLE ROW LEVEL SECURITY;

-- Users can view their own event connections
DROP POLICY IF EXISTS "Users can view their own event connections" ON event_connections;
CREATE POLICY "Users can view their own event connections" 
    ON event_connections FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own event connections
DROP POLICY IF EXISTS "Users can insert their own event connections" ON event_connections;
CREATE POLICY "Users can insert their own event connections" 
    ON event_connections FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own event connections
DROP POLICY IF EXISTS "Users can update their own event connections" ON event_connections;
CREATE POLICY "Users can update their own event connections" 
    ON event_connections FOR UPDATE 
    USING (auth.uid() = user_id);

-- Service role has full access to event_connections
DROP POLICY IF EXISTS "Service role has full access to event connections" ON event_connections;
CREATE POLICY "Service role has full access to event connections" 
    ON event_connections FOR ALL 
    USING (current_setting('role') = 'service_role');

-- =======================================================
-- USER INTERACTIONS WITH EVENTS
-- =======================================================

-- Create user_event_interactions table
CREATE TABLE IF NOT EXISTS public.user_event_interactions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    previous_event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL,
    next_event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL,
    interaction_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- Enable RLS on user_event_interactions
ALTER TABLE IF EXISTS user_event_interactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own event interactions
DROP POLICY IF EXISTS "Users can view their own event interactions" ON user_event_interactions;
CREATE POLICY "Users can view their own event interactions" 
    ON user_event_interactions FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own event interactions
DROP POLICY IF EXISTS "Users can insert their own event interactions" ON user_event_interactions;
CREATE POLICY "Users can insert their own event interactions" 
    ON user_event_interactions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own event interactions
DROP POLICY IF EXISTS "Users can update their own event interactions" ON user_event_interactions;
CREATE POLICY "Users can update their own event interactions" 
    ON user_event_interactions FOR UPDATE 
    USING (auth.uid() = user_id);

-- Service role has full access to user_event_interactions
DROP POLICY IF EXISTS "Service role has full access to user interactions" ON user_event_interactions;
CREATE POLICY "Service role has full access to user interactions" 
    ON user_event_interactions FOR ALL 
    USING (current_setting('role') = 'service_role');

-- Create user_paths table to track chosen and unchosen events
CREATE TABLE IF NOT EXISTS public.user_paths (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    path_data JSONB NOT NULL DEFAULT '{"chosenEvents": [], "unchosenEvents": []}',
    current_event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_paths
ALTER TABLE IF EXISTS public.user_paths ENABLE ROW LEVEL SECURITY;

-- Users can view their own paths
DROP POLICY IF EXISTS "Users can view their own paths" ON user_paths;
CREATE POLICY "Users can view their own paths"
    ON user_paths FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own paths
DROP POLICY IF EXISTS "Users can insert their own paths" ON user_paths;
CREATE POLICY "Users can insert their own paths"
    ON user_paths FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own paths
DROP POLICY IF EXISTS "Users can update their own paths" ON user_paths;
CREATE POLICY "Users can update their own paths"
    ON user_paths FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role has full access to user_paths
DROP POLICY IF EXISTS "Service role has full access to user paths" ON user_paths;
CREATE POLICY "Service role has full access to user paths"
    ON user_paths FOR ALL
    USING (current_setting('role') = 'service_role');

-- =======================================================
-- SEARCH AND VECTOR SEARCH
-- =======================================================

-- Create search_terms table
CREATE TABLE IF NOT EXISTS public.search_terms (
    term TEXT PRIMARY KEY,
    search_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    last_searched TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on search_terms
ALTER TABLE IF EXISTS search_terms ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view the search_terms table
DROP POLICY IF EXISTS "Search terms are viewable by authenticated users only" ON search_terms;
CREATE POLICY "Search terms are viewable by authenticated users only" 
    ON search_terms FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Service role can modify search terms (needed for track_search_term function)
DROP POLICY IF EXISTS "Service role can modify search terms" ON search_terms;
CREATE POLICY "Service role can modify search terms" 
    ON search_terms FOR ALL 
    USING (current_setting('role') = 'service_role');

-- Create similarity search function
CREATE OR REPLACE FUNCTION match_events(query_embedding VECTOR(1536), match_threshold FLOAT, match_count INT)
RETURNS TABLE (
    id TEXT,
    title TEXT,
    year INTEGER,
    lat FLOAT,
    lon FLOAT,
    subject TEXT,
    info TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        events.id,
        events.title,
        events.year,
        events.lat,
        events.lon,
        events.subject,
        events.info,
        1 - (events.embedding <=> query_embedding) AS similarity
    FROM events
    WHERE 1 - (events.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Create function to track search terms
CREATE OR REPLACE FUNCTION track_search_term(p_term TEXT, p_had_results BOOLEAN DEFAULT FALSE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO search_terms (term, search_count, success_count)
    VALUES (p_term, 1, CASE WHEN p_had_results THEN 1 ELSE 0 END)
    ON CONFLICT (term)
    DO UPDATE SET
        search_count = search_terms.search_count + 1,
        success_count = search_terms.success_count + CASE WHEN p_had_results THEN 1 ELSE 0 END,
        last_searched = NOW();
END;
$$;

-- Create view for popular search terms (without SECURITY DEFINER)
DROP VIEW IF EXISTS popular_search_terms;
CREATE VIEW popular_search_terms AS
SELECT term, search_count, success_count
FROM search_terms
ORDER BY search_count DESC;

-- =======================================================
-- QUIZ SYSTEM
-- =======================================================

-- Create quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    question_count INTEGER NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create questions table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    explanation TEXT,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    points INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create question options table
CREATE TABLE IF NOT EXISTS public.quiz_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quiz attempts table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    score NUMERIC NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    generated_after_searches INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quiz answers table
CREATE TABLE IF NOT EXISTS public.quiz_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
    selected_option_id UUID REFERENCES public.quiz_options(id) ON DELETE CASCADE,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    points_earned NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quiz related events junction table
CREATE TABLE IF NOT EXISTS public.quiz_related_events (
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (quiz_id, event_id)
);

-- Create table to track user search/connection count
CREATE TABLE IF NOT EXISTS public.user_activity_metrics (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    search_count INTEGER NOT NULL DEFAULT 0,
    connection_count INTEGER NOT NULL DEFAULT 0, 
    quiz_trigger_count INTEGER NOT NULL DEFAULT 0,
    last_search_at TIMESTAMP WITH TIME ZONE,
    last_quiz_at TIMESTAMP WITH TIME ZONE,
    last_connection_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Setup RLS policies for quiz tables
ALTER TABLE IF EXISTS quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_related_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_activity_metrics ENABLE ROW LEVEL SECURITY;

-- Everyone can view quizzes
DROP POLICY IF EXISTS "Quizzes are viewable by everyone" ON quizzes;
CREATE POLICY "Quizzes are viewable by everyone" 
    ON quizzes FOR SELECT 
    USING (true);

-- Service role has full access to quizzes
DROP POLICY IF EXISTS "Service role has full access to quizzes" ON quizzes;
CREATE POLICY "Service role has full access to quizzes"
    ON quizzes FOR ALL
    USING (current_setting('role') = 'service_role');

-- Everyone can view quiz questions
DROP POLICY IF EXISTS "Quiz questions are viewable by everyone" ON quiz_questions;
CREATE POLICY "Quiz questions are viewable by everyone" 
    ON quiz_questions FOR SELECT 
    USING (true);

-- Service role has full access to quiz_questions
DROP POLICY IF EXISTS "Service role has full access to quiz questions" ON quiz_questions;
CREATE POLICY "Service role has full access to quiz questions"
    ON quiz_questions FOR ALL
    USING (current_setting('role') = 'service_role');

-- Everyone can view quiz options
DROP POLICY IF EXISTS "Quiz options are viewable by everyone" ON quiz_options;
CREATE POLICY "Quiz options are viewable by everyone" 
    ON quiz_options FOR SELECT 
    USING (true);

-- Service role has full access to quiz_options
DROP POLICY IF EXISTS "Service role has full access to quiz options" ON quiz_options;
CREATE POLICY "Service role has full access to quiz options"
    ON quiz_options FOR ALL
    USING (current_setting('role') = 'service_role');

-- Users can view their own quiz attempts
DROP POLICY IF EXISTS "Users can view their own quiz attempts" ON quiz_attempts;
CREATE POLICY "Users can view their own quiz attempts" 
    ON quiz_attempts FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own quiz attempts
DROP POLICY IF EXISTS "Users can insert their own quiz attempts" ON quiz_attempts;
CREATE POLICY "Users can insert their own quiz attempts" 
    ON quiz_attempts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Service role has full access to quiz_attempts
DROP POLICY IF EXISTS "Service role has full access to quiz attempts" ON quiz_attempts;
CREATE POLICY "Service role has full access to quiz attempts"
    ON quiz_attempts FOR ALL
    USING (current_setting('role') = 'service_role');

-- Users can view their own quiz answers
DROP POLICY IF EXISTS "Users can view their own quiz answers" ON quiz_answers;
CREATE POLICY "Users can view their own quiz answers"
    ON quiz_answers FOR SELECT
    USING (auth.uid() = (SELECT user_id FROM quiz_attempts WHERE id = attempt_id));

-- Users can insert their own quiz answers
DROP POLICY IF EXISTS "Users can insert their own quiz answers" ON quiz_answers;
CREATE POLICY "Users can insert their own quiz answers"
    ON quiz_answers FOR INSERT
    WITH CHECK (auth.uid() = (SELECT user_id FROM quiz_attempts WHERE id = attempt_id));

-- Service role has full access to quiz_answers
DROP POLICY IF EXISTS "Service role has full access to quiz answers" ON quiz_answers;
CREATE POLICY "Service role has full access to quiz answers"
    ON quiz_answers FOR ALL
    USING (current_setting('role') = 'service_role');

-- Everyone can view quiz_related_events
DROP POLICY IF EXISTS "Quiz related events are viewable by everyone" ON quiz_related_events;
CREATE POLICY "Quiz related events are viewable by everyone"
    ON quiz_related_events FOR SELECT
    USING (true);

-- Service role has full access to quiz_related_events
DROP POLICY IF EXISTS "Service role has full access to quiz related events" ON quiz_related_events;
CREATE POLICY "Service role has full access to quiz related events"
    ON quiz_related_events FOR ALL
    USING (current_setting('role') = 'service_role');

-- Users can view their own activity metrics
DROP POLICY IF EXISTS "Users can view their own activity metrics" ON user_activity_metrics;
CREATE POLICY "Users can view their own activity metrics"
    ON user_activity_metrics FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own activity metrics
DROP POLICY IF EXISTS "Users can insert their own activity metrics" ON user_activity_metrics;
CREATE POLICY "Users can insert their own activity metrics"
    ON user_activity_metrics FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own activity metrics
DROP POLICY IF EXISTS "Users can update their own activity metrics" ON user_activity_metrics;
CREATE POLICY "Users can update their own activity metrics"
    ON user_activity_metrics FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role has full access to user_activity_metrics
DROP POLICY IF EXISTS "Service role has full access to user activity metrics" ON user_activity_metrics;
CREATE POLICY "Service role has full access to user activity metrics"
    ON user_activity_metrics FOR ALL
    USING (current_setting('role') = 'service_role');

-- Add table comments
COMMENT ON TABLE public.events IS 'Historical events with geographic coordinates and vector embeddings for semantic search';
CREATE TABLE IF NOT EXISTS public.quiz_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quiz attempts table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    score NUMERIC NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    generated_after_searches INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quiz answers table
CREATE TABLE IF NOT EXISTS public.quiz_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
    selected_option_id UUID REFERENCES public.quiz_options(id) ON DELETE CASCADE,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    points_earned NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quiz related events junction table
CREATE TABLE IF NOT EXISTS public.quiz_related_events (
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (quiz_id, event_id)
);

-- Create table to track user search/connection count
CREATE TABLE IF NOT EXISTS public.user_activity_metrics (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    search_count INTEGER NOT NULL DEFAULT 0,
    connection_count INTEGER NOT NULL DEFAULT 0, 
    quiz_trigger_count INTEGER NOT NULL DEFAULT 0,
    last_search_at TIMESTAMP WITH TIME ZONE,
    last_quiz_at TIMESTAMP WITH TIME ZONE,
    last_connection_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Setup RLS policies for quiz tables
ALTER TABLE IF EXISTS quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_related_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_activity_metrics ENABLE ROW LEVEL SECURITY;

-- Everyone can view quizzes
DROP POLICY IF EXISTS "Quizzes are viewable by everyone" ON quizzes;
CREATE POLICY "Quizzes are viewable by everyone" 
    ON quizzes FOR SELECT 
    USING (true);

-- Service role has full access to quizzes
DROP POLICY IF EXISTS "Service role has full access to quizzes" ON quizzes;
CREATE POLICY "Service role has full access to quizzes"
    ON quizzes FOR ALL
    USING (current_setting('role') = 'service_role');

-- Everyone can view quiz questions
DROP POLICY IF EXISTS "Quiz questions are viewable by everyone" ON quiz_questions;
CREATE POLICY "Quiz questions are viewable by everyone" 
    ON quiz_questions FOR SELECT 
    USING (true);

-- Service role has full access to quiz_questions
DROP POLICY IF EXISTS "Service role has full access to quiz questions" ON quiz_questions;
CREATE POLICY "Service role has full access to quiz questions"
    ON quiz_questions FOR ALL
    USING (current_setting('role') = 'service_role');

-- Everyone can view quiz options
DROP POLICY IF EXISTS "Quiz options are viewable by everyone" ON quiz_options;
CREATE POLICY "Quiz options are viewable by everyone" 
    ON quiz_options FOR SELECT 
    USING (true);

-- Service role has full access to quiz_options
DROP POLICY IF EXISTS "Service role has full access to quiz options" ON quiz_options;
CREATE POLICY "Service role has full access to quiz options"
    ON quiz_options FOR ALL
    USING (current_setting('role') = 'service_role');

-- Users can view their own quiz attempts
DROP POLICY IF EXISTS "Users can view their own quiz attempts" ON quiz_attempts;
CREATE POLICY "Users can view their own quiz attempts" 
    ON quiz_attempts FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own quiz attempts
DROP POLICY IF EXISTS "Users can insert their own quiz attempts" ON quiz_attempts;
CREATE POLICY "Users can insert their own quiz attempts" 
    ON quiz_attempts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Service role has full access to quiz_attempts
DROP POLICY IF EXISTS "Service role has full access to quiz attempts" ON quiz_attempts;
CREATE POLICY "Service role has full access to quiz attempts"
    ON quiz_attempts FOR ALL
    USING (current_setting('role') = 'service_role');

-- Users can view their own quiz answers
DROP POLICY IF EXISTS "Users can view their own quiz answers" ON quiz_answers;
CREATE POLICY "Users can view their own quiz answers"
    ON quiz_answers FOR SELECT
    USING (auth.uid() = (SELECT user_id FROM quiz_attempts WHERE id = attempt_id));

-- Users can insert their own quiz answers
DROP POLICY IF EXISTS "Users can insert their own quiz answers" ON quiz_answers;
CREATE POLICY "Users can insert their own quiz answers"
    ON quiz_answers FOR INSERT
    WITH CHECK (auth.uid() = (SELECT user_id FROM quiz_attempts WHERE id = attempt_id));

-- Service role has full access to quiz_answers
DROP POLICY IF EXISTS "Service role has full access to quiz answers" ON quiz_answers;
CREATE POLICY "Service role has full access to quiz answers"
    ON quiz_answers FOR ALL
    USING (current_setting('role') = 'service_role');

-- Everyone can view quiz_related_events
DROP POLICY IF EXISTS "Quiz related events are viewable by everyone" ON quiz_related_events;
CREATE POLICY "Quiz related events are viewable by everyone"
    ON quiz_related_events FOR SELECT
    USING (true);

-- Service role has full access to quiz_related_events
DROP POLICY IF EXISTS "Service role has full access to quiz related events" ON quiz_related_events;
CREATE POLICY "Service role has full access to quiz related events"
    ON quiz_related_events FOR ALL
    USING (current_setting('role') = 'service_role');

-- Users can view their own activity metrics
DROP POLICY IF EXISTS "Users can view their own activity metrics" ON user_activity_metrics;
CREATE POLICY "Users can view their own activity metrics"
    ON user_activity_metrics FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own activity metrics
DROP POLICY IF EXISTS "Users can insert their own activity metrics" ON user_activity_metrics;
CREATE POLICY "Users can insert their own activity metrics"
    ON user_activity_metrics FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own activity metrics
DROP POLICY IF EXISTS "Users can update their own activity metrics" ON user_activity_metrics;
CREATE POLICY "Users can update their own activity metrics"
    ON user_activity_metrics FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role has full access to user_activity_metrics
DROP POLICY IF EXISTS "Service role has full access to user activity metrics" ON user_activity_metrics;
CREATE POLICY "Service role has full access to user activity metrics"
    ON user_activity_metrics FOR ALL
    USING (current_setting('role') = 'service_role');
