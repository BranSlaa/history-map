import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const quizId = params?.id;
    
    if (!quizId) {
        return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 });
    }
    
    try {
        // Fetch quiz details with the correct field names
        const { data: quiz, error: quizError } = await supabase
            .from('quizzes')
            .select(`
                id, title, description, subject, topic, difficulty, question_count,
                created_at, updated_at, user_id,
                quiz_questions (
                    id, question_text, explanation, question_order,
                    quiz_options (
                        id, option_text, is_correct, option_order
                    )
                )
            `)
            .eq('id', quizId)
            .single();
            
        if (quizError) {
            console.error('Error fetching quiz:', quizError);
            return NextResponse.json({ error: 'Error fetching quiz' }, { status: 500 });
        }
        
        if (!quiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        // Separately fetch the creator information if user_id exists
        let creator = null;
        if (quiz.user_id) {
            try {
                const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('id, username, first_name, last_name')
                    .eq('id', quiz.user_id)
                    .single();
                    
                if (!userError && userData) {
                    creator = userData;
                }
            } catch (err) {
                console.error('Error fetching creator data:', err);
                // Continue without creator data
            }
        }
        
        // Format the quiz data for the client
        const formattedQuiz = {
            id: quiz.id,
            title: quiz.title,
            description: quiz.description,
            subject: quiz.subject,
            topic: quiz.topic,
            difficulty: quiz.difficulty,
            question_count: quiz.question_count || quiz.quiz_questions?.length || 0,
            created_at: quiz.created_at,
            creator: creator || { id: quiz.user_id },
            questions: quiz.quiz_questions?.map((question: any) => ({
                id: question.id,
                text: question.question_text,
                explanation: question.explanation || '',
                options: question.quiz_options?.map((option: any) => ({
                    id: option.id,
                    text: option.option_text,
                    isCorrect: option.is_correct
                })) || []
            })) || []
        };
        
        return NextResponse.json(formattedQuiz);
    } catch (error) {
        console.error('Error fetching quiz details:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 