import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { generateQuizQuestionsWithAI } from './aiUtils';
import { QUIZ_DIFFICULTIES } from '@/constants/quiz';

// Create a Supabase admin client for database operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Creates a new quiz shell in the database
 * Returns the quiz ID and other metadata
 */
export async function createQuizShell(
    userId: string,
    title: string, 
    description: string,
    subject: string,
    topic: string,
    difficulty: string,
    pathId?: string,
    searchTerm?: string,
    relatedEventIds: string[] = []
) {
    try {
        const quizId = uuidv4();
        const timestamp = new Date().toISOString();
        
        // Create basic quiz record with path relationship
        const quizData = {
            id: quizId,
            title,
            description,
            subject,
            topic,
            difficulty,
            question_count: 0, // Will be updated after questions are added
            user_id: userId,
            path_id: pathId || null,
            search_term: searchTerm || null,
            created_at: timestamp,
            updated_at: timestamp
        };
        
        // Step 1: Insert the quiz record
        const { data, error } = await supabaseAdmin
            .from('quizzes')
            .insert(quizData)
            .select();
            
        if (error) {
            console.error('Error creating quiz shell:', error);
            throw new Error(`Failed to create quiz: ${error.message}`);
        }
        
        // Step 2: Create quiz_events relationships if there are related events
        if (relatedEventIds && relatedEventIds.length > 0) {
            const quizEventRecords = relatedEventIds.map(eventId => ({
                quiz_id: quizId,
                event_id: eventId,
                created_at: timestamp
            }));
            
            const { error: relError } = await supabaseAdmin
                .from('quiz_events')
                .insert(quizEventRecords);
                
            if (relError) {
                console.error('Error creating quiz-event relationships:', relError);
                // Continue anyway - the quiz was created successfully
            }
        }
        
        return data?.[0] || quizData;
    } catch (error) {
        console.error('Error in createQuizShell:', error);
        throw error;
    }
}

/**
 * Adds questions to an existing quiz
 * Handles the database operations for inserting questions and options
 */
export async function addQuestionsToQuiz(
    quizId: string,
    questions: any[]
) {
    try {
        if (!questions || questions.length === 0) {
            return { success: false, message: 'No questions provided', questionCount: 0 };
        }
        
        let questionCount = 0;
        
        // Process each question
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            const questionId = uuidv4();
            
            // Insert the question
            const { error: questionError } = await supabaseAdmin
                .from('quiz_questions')
                .insert({
                    id: questionId,
                    quiz_id: quizId,
                    event_id: question.event_id || null,
                    question_text: question.question,
                    explanation: question.explanation || '',
                    question_order: i
                });
                
            if (questionError) {
                console.error(`Error inserting question ${i}:`, questionError);
                continue; // Skip to next question if this one fails
            }
            
            // Insert the options for this question
            if (question.options && question.options.length > 0) {
                const optionsData = question.options.map((option: any, index: number) => ({
                    id: uuidv4(),
                    question_id: questionId,
                    option_text: option.text,
                    is_correct: option.isCorrect === true,
                    option_order: index
                }));
                
                const { error: optionsError } = await supabaseAdmin
                    .from('quiz_options')
                    .insert(optionsData);
                    
                if (optionsError) {
                    console.error(`Error inserting options for question ${i}:`, optionsError);
                    // Continue anyway, the question was created
                }
            }
            
            questionCount++;
        }
        
        return { 
            success: true, 
            message: `${questionCount} questions added to quiz`, 
            questionCount: questionCount 
        };
    } catch (error) {
        console.error('Error in addQuestionsToQuiz:', error);
        throw error;
    }
}

/**
 * Repairs an existing quiz by replacing its questions
 * Handles both the AI generation and database operations
 */
export async function repairQuiz(
    quizId: string,
    userId: string,
    events: any[],
    subject: string,
    topic: string
) {
    try {
        // First, validate ownership
        const { data: quiz, error: quizError } = await supabaseAdmin
            .from('quizzes')
            .select('id, user_id, difficulty')
            .eq('id', quizId)
            .single();
            
        if (quizError || !quiz) {
            throw new Error('Quiz not found');
        }
        
        if (quiz.user_id !== userId) {
            throw new Error('Unauthorized to repair this quiz');
        }
        
        // Generate new questions using AI
        const difficulty = quiz.difficulty || 'intermediate';
        const questions = await generateQuizQuestionsWithAI(
            events,
            topic,
            subject,
            difficulty,
            1 // Generate one question per event
        );
        
        if (!questions || questions.length === 0) {
            throw new Error('Failed to generate new questions');
        }
        
        // Delete existing questions
        const { error: deleteError } = await supabaseAdmin
            .from('quiz_questions')
            .delete()
            .eq('quiz_id', quizId);
            
        if (deleteError) {
            console.error('Error deleting existing questions:', deleteError);
            throw new Error('Failed to delete existing questions');
        }
        
        // Add new questions
        const result = await addQuestionsToQuiz(quizId, questions);
        
        return {
            success: true,
            quizId,
            questionCount: result.questionCount,
            message: `Quiz successfully repaired with ${result.questionCount} new questions`
        };
    } catch (error) {
        console.error('Error in repairQuiz:', error);
        throw error;
    }
}

/**
 * Generates a complete quiz in one operation
 * Creates the quiz shell and adds questions based on user events
 */
export async function generateCompleteQuiz(
    userId: string,
    events: any[],
    subject: string,
    topic: string,
    difficulty: string = QUIZ_DIFFICULTIES.BEGINNER,
    pathId?: string,
    searchTerm?: string
) {
    try {
        // First, create a quiz shell
        const quizTitle = pathId 
            ? `${difficulty} Path Quiz: ${topic || subject}`
            : `${difficulty} Quiz: ${subject}`;
            
        const quizDescription = `A ${difficulty.toLowerCase()} difficulty quiz about ${topic || subject}.`;
        
        const quiz = await createQuizShell(
            userId,
            quizTitle,
            quizDescription,
            subject,
            topic || searchTerm || subject,
            difficulty,
            pathId,
            searchTerm,
            events.map(e => e.id)
        );
        
        // Generate questions using AI
        const questions = await generateQuizQuestionsWithAI(
            events,
            topic,
            subject,
            difficulty,
            1 // Generate one question per event
        );
        
        if (!questions || questions.length === 0) {
            throw new Error('Failed to generate questions');
        }
        
        // Add generated questions to the quiz
        await addQuestionsToQuiz(quiz.id, questions.map((q: any, index: number) => ({
            ...q,
            event_id: events[index]?.id // Link each question to its corresponding event
        })));
        
        // Update question count on the quiz
        const { error: updateError } = await supabaseAdmin
            .from('quizzes')
            .update({ 
                question_count: questions.length,
                updated_at: new Date().toISOString()
            })
            .eq('id', quiz.id);
            
        if (updateError) {
            console.error('Error updating quiz question count:', updateError);
        }
        
        return {
            id: quiz.id,
            title: quiz.title,
            description: quiz.description,
            question_count: questions.length
        };
    } catch (error) {
        console.error('Error in generateCompleteQuiz:', error);
        throw error;
    }
} 