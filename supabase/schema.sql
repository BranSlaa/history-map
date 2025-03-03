-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Create users table
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    subscription_tier SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sign_in_at TIMESTAMP WITH TIME ZONE
);

-- Create events table
CREATE TABLE public.events (
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

-- Create user_event_interactions table
CREATE TABLE public.user_event_interactions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    previous_event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL,
    next_event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL,
    interaction_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- Create event_connections table
CREATE TABLE public.event_connections (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    source_event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    target_event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    connection_strength INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, source_event_id, target_event_id)
);

-- Create user_paths table to track chosen and unchosen events
CREATE TABLE public.user_paths (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    path_data JSONB NOT NULL DEFAULT '{"chosenEvents": [], "unchosenEvents": []}',
    current_event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create key_terms table
CREATE TABLE public.key_terms (
    id SERIAL PRIMARY KEY,
    term TEXT UNIQUE NOT NULL
);

-- Create event_key_terms junction table
CREATE TABLE public.event_key_terms (
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    key_term_id INTEGER REFERENCES public.key_terms(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, key_term_id)
);

-- Create search_terms table
CREATE TABLE public.search_terms (
    term TEXT PRIMARY KEY,
    search_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    last_searched TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Create view for popular search terms
CREATE VIEW popular_search_terms AS
SELECT term, search_count, success_count
FROM search_terms
ORDER BY search_count DESC;

-- Set up RLS policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Public events are viewable by everyone
CREATE POLICY "Public events are viewable by everyone" 
    ON events FOR SELECT 
    USING (true);

-- Set up RLS for user_event_interactions
ALTER TABLE user_event_interactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own event interactions
CREATE POLICY "Users can view their own event interactions" 
    ON user_event_interactions FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own event interactions
CREATE POLICY "Users can insert their own event interactions" 
    ON user_event_interactions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own event interactions
CREATE POLICY "Users can update their own event interactions" 
    ON user_event_interactions FOR UPDATE 
    USING (auth.uid() = user_id);

-- Only authenticated users can view the search_terms table
ALTER TABLE search_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Search terms are viewable by authenticated users only" 
    ON search_terms FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Set up RLS for event_connections
ALTER TABLE event_connections ENABLE ROW LEVEL SECURITY;

-- Users can view their own event connections
CREATE POLICY "Users can view their own event connections" 
    ON event_connections FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own event connections
CREATE POLICY "Users can insert their own event connections" 
    ON event_connections FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own event connections
CREATE POLICY "Users can update their own event connections" 
    ON event_connections FOR UPDATE 
    USING (auth.uid() = user_id);

-- Create function to generate embeddings (to be called from Edge Function)
-- Note: This is a placeholder as the actual embedding generation will happen in an Edge Function
COMMENT ON TABLE public.events IS 'Historical events with geographic coordinates and vector embeddings for semantic search'; 