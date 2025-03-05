-- Create quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    question_count INTEGER NOT NULL,
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

-- Create junction table to track which events a quiz is related to
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

-- Setup RLS policies
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_related_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_metrics ENABLE ROW LEVEL SECURITY;

-- Everyone can view quizzes
DROP POLICY IF EXISTS "Quizzes are viewable by everyone" ON quizzes;
CREATE POLICY "Quizzes are viewable by everyone" 
    ON quizzes FOR SELECT 
    USING (true);

-- Everyone can view quiz questions
DROP POLICY IF EXISTS "Quiz questions are viewable by everyone" ON quiz_questions;
CREATE POLICY "Quiz questions are viewable by everyone" 
    ON quiz_questions FOR SELECT 
    USING (true);

-- Everyone can view quiz options
DROP POLICY IF EXISTS "Quiz options are viewable by everyone" ON quiz_options;
CREATE POLICY "Quiz options are viewable by everyone" 
    ON quiz_options FOR SELECT 
    USING (true);

-- Everyone can view quiz related events
DROP POLICY IF EXISTS "Quiz related events are viewable by everyone" ON quiz_related_events;
CREATE POLICY "Quiz related events are viewable by everyone" 
    ON quiz_related_events FOR SELECT 
    USING (true);

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

-- Service role can insert/update activity metrics
DROP POLICY IF EXISTS "Service role can manage activity metrics" ON user_activity_metrics;
CREATE POLICY "Service role can manage activity metrics" 
    ON user_activity_metrics FOR ALL 
    USING (auth.role() = 'service_role');

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

-- Users can update their own quiz attempts
DROP POLICY IF EXISTS "Users can update their own quiz attempts" ON quiz_attempts;
CREATE POLICY "Users can update their own quiz attempts" 
    ON quiz_attempts FOR UPDATE 
    USING (auth.uid() = user_id);

-- Users can view their own quiz answers
DROP POLICY IF EXISTS "Users can view their own quiz answers" ON quiz_answers;
CREATE POLICY "Users can view their own quiz answers" 
    ON quiz_answers FOR SELECT 
    USING (
        auth.uid() IN (
            SELECT user_id FROM quiz_attempts WHERE id = attempt_id
        )
    );

-- Users can insert their own quiz answers
DROP POLICY IF EXISTS "Users can insert their own quiz answers" ON quiz_answers;
CREATE POLICY "Users can insert their own quiz answers" 
    ON quiz_answers FOR INSERT 
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM quiz_attempts WHERE id = attempt_id
        )
    ); 