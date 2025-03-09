-- Complete database schema - drops everything and rebuilds from scratch

-- Disable triggers temporarily to avoid foreign key violations during drops
SET session_replication_role = 'replica';

-- First drop any triggers that depend on functions we'll be dropping
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop all public schema tables in the correct order to avoid dependency issues
DROP TABLE IF EXISTS public.quiz_answers CASCADE;
DROP TABLE IF EXISTS public.quiz_options CASCADE;
DROP TABLE IF EXISTS public.quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.quiz_questions CASCADE;
DROP TABLE IF EXISTS public.quiz_related_events CASCADE;
DROP TABLE IF EXISTS public.quizzes CASCADE;
DROP TABLE IF EXISTS public.path_events CASCADE;
DROP TABLE IF EXISTS public.paths CASCADE;
DROP TABLE IF EXISTS public.event_key_terms CASCADE;
DROP TABLE IF EXISTS public.key_terms CASCADE;
DROP TABLE IF EXISTS public.search_terms CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop all functions that we'll be recreating
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS match_events(VECTOR(1536), FLOAT, INT);
DROP FUNCTION IF EXISTS track_search_term(TEXT, BOOLEAN);

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================================================
-- USER PROFILE TABLES
-- =======================================================

-- Create profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    avatar_url TEXT,
    subscription_tier SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sign_in_at TIMESTAMP WITH TIME ZONE,
    search_count INTEGER DEFAULT 0,
    connection_count INTEGER DEFAULT 0,
    last_search_at TIMESTAMP WITH TIME ZONE,
    last_connection_at TIMESTAMP WITH TIME ZONE
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
DECLARE
    random_username TEXT;
BEGIN
    -- Generate a simple random username as a fallback
    random_username := 'user_' || substr(md5(gen_random_uuid()::text), 1, 10);
    
    INSERT INTO public.profiles (
        id, 
        username, 
        avatar_url, 
        subscription_tier,
        created_at,
        updated_at
    )
    VALUES (
        new.id, 
        COALESCE(new.raw_user_meta_data->>'username', random_username),
        new.raw_user_meta_data->>'avatar_url',
        COALESCE((new.raw_user_meta_data->>'subscription_tier')::smallint, 1),
        NOW(),
        NOW()
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
    description TEXT NOT NULL,
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

-- =======================================================
-- SEARCH AND VECTOR SEARCH
-- =======================================================

-- Create search_terms table
CREATE TABLE IF NOT EXISTS public.search_terms (
    term TEXT PRIMARY KEY,
    search_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    first_searched TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
    description TEXT,
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
        events.description,
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
    INSERT INTO search_terms (term, search_count, success_count, first_searched, last_searched)
    VALUES (p_term, 1, CASE WHEN p_had_results THEN 1 ELSE 0 END, NOW(), NOW())
    ON CONFLICT (term) 
    DO UPDATE SET 
        search_count = search_terms.search_count + 1,
        success_count = search_terms.success_count + CASE WHEN p_had_results THEN 1 ELSE 0 END,
        last_searched = NOW();
END;
$$;

-- =======================================================
-- PATHS AND USER INTERACTIONS
-- =======================================================

-- Create paths table
CREATE TABLE IF NOT EXISTS public.paths (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    search_term TEXT,
    subject TEXT NOT NULL DEFAULT 'History',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    current_event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL,
    event_count INTEGER DEFAULT 0,
    max_events INTEGER DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'abandoned'))
);

-- Enable RLS on paths
ALTER TABLE IF EXISTS public.paths ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for paths
DROP POLICY IF EXISTS "Users can view their own paths" ON paths;
CREATE POLICY "Users can view their own paths"
    ON paths FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own paths" ON paths;
CREATE POLICY "Users can insert their own paths"
    ON paths FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own paths" ON paths;
CREATE POLICY "Users can update their own paths"
    ON paths FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to paths" ON paths;
CREATE POLICY "Service role has full access to paths"
    ON paths FOR ALL
    USING (current_setting('role') = 'service_role');

-- Create path_events table to track events in a path
CREATE TABLE IF NOT EXISTS public.path_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    path_id UUID NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    explored_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    event_order INTEGER NOT NULL,
    quiz_generated BOOLEAN DEFAULT FALSE,
    exploration_time INTEGER, -- time spent in seconds
    UNIQUE(path_id, event_id)
);

-- Enable RLS on path_events
ALTER TABLE IF EXISTS public.path_events ENABLE ROW LEVEL SECURITY;

-- Path events policies
DROP POLICY IF EXISTS "Path events are viewable by path owners" ON path_events;
CREATE POLICY "Path events are viewable by path owners"
    ON path_events FOR SELECT
    USING (path_id IN (SELECT id FROM paths WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Path events can be inserted by path owners" ON path_events;
CREATE POLICY "Path events can be inserted by path owners"
    ON path_events FOR INSERT
    WITH CHECK (path_id IN (SELECT id FROM paths WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Path events can be updated by path owners" ON path_events;
CREATE POLICY "Path events can be updated by path owners"
    ON path_events FOR UPDATE
    USING (path_id IN (SELECT id FROM paths WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role has full access to path events" ON path_events;
CREATE POLICY "Service role has full access to path events"
    ON path_events FOR ALL
    USING (current_setting('role') = 'service_role');

-- =======================================================
-- QUIZZES AND LEARNING
-- =======================================================

-- Create quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    path_id UUID REFERENCES paths(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    difficulty SMALLINT DEFAULT 1,
    status TEXT DEFAULT 'active',
    CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'archived'))
);

-- Enable RLS on quizzes
ALTER TABLE IF EXISTS public.quizzes ENABLE ROW LEVEL SECURITY;

-- Create quiz_questions table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_order INTEGER NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'multiple_choice'
);

-- Enable RLS on quiz_questions
ALTER TABLE IF EXISTS public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- Create quiz_options table
CREATE TABLE IF NOT EXISTS public.quiz_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    option_order INTEGER NOT NULL
);

-- Enable RLS on quiz_options
ALTER TABLE IF EXISTS public.quiz_options ENABLE ROW LEVEL SECURITY;

-- Create quiz_attempts table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    score INTEGER,
    max_score INTEGER,
    time_taken INTEGER  -- seconds
);

-- Enable RLS on quiz_attempts
ALTER TABLE IF EXISTS public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Create quiz_answers table
CREATE TABLE IF NOT EXISTS public.quiz_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    quiz_question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    selected_option_id UUID REFERENCES quiz_options(id) ON DELETE CASCADE,
    is_correct BOOLEAN,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on quiz_answers
ALTER TABLE IF EXISTS public.quiz_answers ENABLE ROW LEVEL SECURITY;

-- Create quiz_related_events table
CREATE TABLE IF NOT EXISTS public.quiz_related_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    relevance_score FLOAT DEFAULT 1.0,
    UNIQUE(quiz_id, event_id)
);

-- Enable RLS on quiz_related_events
ALTER TABLE IF EXISTS public.quiz_related_events ENABLE ROW LEVEL SECURITY;

-- =======================================================
-- SECURITY POLICIES FOR QUIZ TABLES
-- =======================================================

-- Quizzes policies
DROP POLICY IF EXISTS "Quizzes are viewable by creators" ON quizzes;
CREATE POLICY "Quizzes are viewable by creators"
    ON quizzes FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Quizzes can be inserted by owners" ON quizzes;
CREATE POLICY "Quizzes can be inserted by owners"
    ON quizzes FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role has full access to quizzes" ON quizzes;
CREATE POLICY "Service role has full access to quizzes"
    ON quizzes FOR ALL
    USING (current_setting('role') = 'service_role');

-- Quiz questions policies
DROP POLICY IF EXISTS "Quiz questions are viewable by quiz owners" ON quiz_questions;
CREATE POLICY "Quiz questions are viewable by quiz owners"
    ON quiz_questions FOR SELECT
    USING (quiz_id IN (SELECT id FROM quizzes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role has full access to quiz questions" ON quiz_questions;
CREATE POLICY "Service role has full access to quiz questions"
    ON quiz_questions FOR ALL
    USING (current_setting('role') = 'service_role');

-- Quiz options policies
DROP POLICY IF EXISTS "Quiz options are viewable by question owners" ON quiz_options;
CREATE POLICY "Quiz options are viewable by question owners"
    ON quiz_options FOR SELECT
    USING (quiz_question_id IN (SELECT id FROM quiz_questions WHERE quiz_id IN 
          (SELECT id FROM quizzes WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Service role has full access to quiz options" ON quiz_options;
CREATE POLICY "Service role has full access to quiz options"
    ON quiz_options FOR ALL
    USING (current_setting('role') = 'service_role');

-- Quiz attempts policies
DROP POLICY IF EXISTS "Quiz attempts are viewable by owners" ON quiz_attempts;
CREATE POLICY "Quiz attempts are viewable by owners"
    ON quiz_attempts FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Quiz attempts can be inserted by owners" ON quiz_attempts;
CREATE POLICY "Quiz attempts can be inserted by owners"
    ON quiz_attempts FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Quiz attempts can be updated by owners" ON quiz_attempts;
CREATE POLICY "Quiz attempts can be updated by owners"
    ON quiz_attempts FOR UPDATE
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role has full access to quiz attempts" ON quiz_attempts;
CREATE POLICY "Service role has full access to quiz attempts"
    ON quiz_attempts FOR ALL
    USING (current_setting('role') = 'service_role');

-- Quiz answers policies
DROP POLICY IF EXISTS "Quiz answers are viewable by attempt owners" ON quiz_answers;
CREATE POLICY "Quiz answers are viewable by attempt owners"
    ON quiz_answers FOR SELECT
    USING (attempt_id IN (SELECT id FROM quiz_attempts WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Quiz answers can be inserted by attempt owners" ON quiz_answers;
CREATE POLICY "Quiz answers can be inserted by attempt owners"
    ON quiz_answers FOR INSERT
    WITH CHECK (attempt_id IN (SELECT id FROM quiz_attempts WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role has full access to quiz answers" ON quiz_answers;
CREATE POLICY "Service role has full access to quiz answers"
    ON quiz_answers FOR ALL
    USING (current_setting('role') = 'service_role');

-- Quiz related events policies
DROP POLICY IF EXISTS "Quiz related events are viewable by quiz owners" ON quiz_related_events;
CREATE POLICY "Quiz related events are viewable by quiz owners"
    ON quiz_related_events FOR SELECT
    USING (quiz_id IN (SELECT id FROM quizzes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role has full access to quiz related events" ON quiz_related_events;
CREATE POLICY "Service role has full access to quiz related events"
    ON quiz_related_events FOR ALL
    USING (current_setting('role') = 'service_role');

-- =======================================================
-- INDICES AND OPTIMIZATIONS
-- =======================================================

-- Events indices
CREATE INDEX IF NOT EXISTS idx_events_subject ON events(subject);
CREATE INDEX IF NOT EXISTS idx_events_year ON events(year);
CREATE INDEX IF NOT EXISTS idx_events_title ON events(title text_pattern_ops);

-- Paths indices
CREATE INDEX IF NOT EXISTS idx_paths_user_id ON paths(user_id);
CREATE INDEX IF NOT EXISTS idx_paths_status ON paths(status);
CREATE INDEX IF NOT EXISTS idx_paths_current_event_id ON paths(current_event_id);

-- Path events indices
CREATE INDEX IF NOT EXISTS idx_path_events_path_id ON path_events(path_id);
CREATE INDEX IF NOT EXISTS idx_path_events_event_id ON path_events(event_id);
CREATE INDEX IF NOT EXISTS idx_path_events_event_order ON path_events(event_order);

-- Quiz indices
CREATE INDEX IF NOT EXISTS idx_quizzes_path_id ON quizzes(path_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_options_question_id ON quiz_options(quiz_question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt_id ON quiz_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question_id ON quiz_answers(quiz_question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_related_events_quiz_id ON quiz_related_events(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_related_events_event_id ON quiz_related_events(event_id);
