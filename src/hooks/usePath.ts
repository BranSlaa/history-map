import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Path, PathEvent } from '@/types/path';
import { useRouter } from 'next/navigation';

interface UsePathOptions {
    userId: string;
    maxEvents?: number;
}

interface UsePathReturn {
    currentPath: Path | null;
    loading: boolean;
    error: Error | null;
    createPath: (searchTerm: string, title?: string) => Promise<Path | null>;
    addEventToPath: (eventId: string, eventTitle: string) => Promise<boolean>;
    completePath: () => Promise<boolean>;
    abandonPath: () => Promise<boolean>;
}

export function usePath({ userId, maxEvents = 10 }: UsePathOptions): UsePathReturn {
    const [currentPath, setCurrentPath] = useState<Path | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);
    const router = useRouter();

    // Fetch the user's active path
    const fetchActivePath = useCallback(async () => {
        if (!userId) return;
        
        try {
            setLoading(true);
            
            const { data, error } = await supabase
                .from('paths')
                .select(`
                    *,
                    path_events(*)
                `)
                .eq('user_id', userId)
                .eq('status', 'active')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();
                
            if (error) {
                console.error('Error fetching active path:', error);
                return;
            }
            
            if (data) {
                setCurrentPath({
                    ...data,
                    events: data.path_events || []
                });
            } else {
                setCurrentPath(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setLoading(false);
        }
    }, [userId]);

    // Create a new path
    const createPath = async (searchTerm: string, title?: string): Promise<Path | null> => {
        try {
            const pathTitle = title || `Exploration: ${searchTerm}`;
            
            const { data, error } = await supabase
                .from('paths')
                .insert({
                    user_id: userId,
                    search_term: searchTerm,
                    title: pathTitle,
                    subject: 'History',
                    max_events: maxEvents,
                    event_count: 0,
                    status: 'active'
                })
                .select()
                .single();
                
            if (error) {
                setError(new Error(`Error creating path: ${error.message}`));
                return null;
            }
            
            const newPath: Path = {
                ...data,
                events: []
            };
            
            setCurrentPath(newPath);
            return newPath;
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            return null;
        }
    };

    // Add an event to the current path
    const addEventToPath = async (eventId: string, eventTitle: string): Promise<boolean> => {
        if (!currentPath) {
            setError(new Error('No active path found'));
            return false;
        }
        
        try {
            // Check if we've already reached max events
            if (currentPath.event_count >= currentPath.max_events) {
                // Path is full, complete it
                return await completePath();
            }
            
            // Check if event is already in path
            const eventExists = currentPath.events.some(event => event.id === eventId);
            if (eventExists) {
                return true; // Event already in path
            }
            
            // Calculate the next event order
            const eventOrder = currentPath.event_count + 1;
            
            // Add the event to path_events
            const { error: eventError } = await supabase
                .from('path_events')
                .insert({
                    path_id: currentPath.id,
                    event_id: eventId,
                    title: eventTitle,
                    event_order: eventOrder
                });
                
            if (eventError) {
                setError(new Error(`Error adding event to path: ${eventError.message}`));
                return false;
            }
            
            // Update the path's event count and current event
            const { error: pathError } = await supabase
                .from('paths')
                .update({
                    event_count: eventOrder,
                    current_event_id: eventId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentPath.id);
                
            if (pathError) {
                setError(new Error(`Error updating path: ${pathError.message}`));
                return false;
            }
            
            // Track the user-event interaction
            await supabase
                .from('user_event_interactions')
                .insert({
                    user_id: userId,
                    event_id: eventId,
                    path_id: currentPath.id,
                    interaction_type: 'explore'
                });
            
            // Check if we've reached max events after adding this one
            if (eventOrder >= currentPath.max_events) {
                // We've reached max events, complete the path
                return await completePath();
            }
            
            // Refresh the path data
            await fetchActivePath();
            return true;
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            return false;
        }
    };

    // Complete the current path and generate a quiz
    const completePath = async (): Promise<boolean> => {
        if (!currentPath) {
            setError(new Error('No active path found'));
            return false;
        }
        
        try {
            // Mark the path as completed
            const { error: updateError } = await supabase
                .from('paths')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', currentPath.id);
                
            if (updateError) {
                setError(new Error(`Error completing path: ${updateError.message}`));
                return false;
            }
            
            // Generate quiz for this path
            try {
                // Get all events from this path
                const { data: eventData } = await supabase
                    .from('path_events')
                    .select('event_id')
                    .eq('path_id', currentPath.id);
                
                const eventIds = eventData?.map(e => e.event_id) || [];
                
                if (eventIds.length > 0) {
                    // Call the quiz generation API
                    const response = await fetch('/api/quizzes/generate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            userid: userId,
                            path_id: currentPath.id,
                            search_term: currentPath.search_term,
                            eventIds: eventIds
                        }),
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        
                        if (result.quiz && result.quiz.id) {
                            // Update the path with the quiz ID
                            await supabase
                                .from('paths')
                                .update({
                                    quiz_id: result.quiz.id
                                })
                                .eq('id', currentPath.id);
                                
                            // Redirect to the quiz
                            router.push(`/quizzes/${result.quiz.id}`);
                        }
                    } else {
                        console.error('Failed to generate quiz:', await response.text());
                    }
                }
            } catch (quizError) {
                console.error('Error generating quiz:', quizError);
                // Continue with path completion even if quiz generation fails
            }
            
            // Refresh the path data (will now be null since it's completed)
            await fetchActivePath();
            return true;
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            return false;
        }
    };

    // Abandon the current path
    const abandonPath = async (): Promise<boolean> => {
        if (!currentPath) {
            return true; // No path to abandon
        }
        
        try {
            const { error } = await supabase
                .from('paths')
                .update({
                    status: 'abandoned',
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentPath.id);
                
            if (error) {
                setError(new Error(`Error abandoning path: ${error.message}`));
                return false;
            }
            
            setCurrentPath(null);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            return false;
        }
    };

    // Load the active path on component mount or when userId changes
    useEffect(() => {
        if (userId) {
            fetchActivePath();
        }
    }, [userId, fetchActivePath]);

    return {
        currentPath,
        loading,
        error,
        createPath,
        addEventToPath,
        completePath,
        abandonPath
    };
} 