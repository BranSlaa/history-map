import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import crypto from 'crypto';
import { saveEventsToDatabase } from '@/utils/databaseUtils';
import { 
    AI_MODEL, 
    AI_MAX_EVENTS_TOKENS, 
    AI_TEMPERATURE,
    AI_TOP_P,
    AI_FREQUENCY_PENALTY,
    AI_PRESENCE_PENALTY
} from '@/constants/ai';

// Initialize OpenAI client - server-side only
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // No NEXT_PUBLIC_ prefix for server-side env vars
});

export async function POST(request: NextRequest) {
    try {
        // Extract parameters from request
        const { topic, title, year, numberOfEvents } = await request.json();
        
        // Validate inputs
        if (!topic) {
            return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
        }
        
        if (!numberOfEvents || numberOfEvents <= 0) {
            return NextResponse.json({ error: 'Valid numberOfEvents is required' }, { status: 400 });
        }
        
        // Build prompt
        let prompt = `Provide exactly ${numberOfEvents} significant and DIVERSE historical events related to the topic "${topic}".`;

        // Help with building a path through history
        prompt += ` These events should be interesting connections to create a meaningful historical narrative or "Path through history".`;

        if (title) {
            prompt += ` The events should connect with the event titled '${title}' either conceptually, chronologically, or geographically.`;
        }

        if (year) {
            prompt += ` The events should have occurred shortly after the year ${year}, while still being related to the topic.`;
        }

        if (topic.includes('related to')) {
            prompt += ` Focus on finding DIFFERENT but RELATED events that would build upon the mentioned event, either by consequence, influence, or thematic connection.`;
        }

        prompt += `
            Each event must be unique and distinct from others already provided.
            
            Respond in JSON format as a list of objects, each containing:
            - "title" (string) - The specific title of the event (should be unique and descriptive)
            - "year" (int) - The precise year of the event (use negative number for BCE/BC)
            - "lat" (float) - The latitude coordinate of the event location
            - "lon" (float) - The longitude coordinate of the event location
            - "subject" (string) - The primary subject category of the event
            - "info" (string) - A brief description of the event and why it's significant
        `;

        // Check API key
        if (!process.env.OPENAI_API_KEY) {
            console.error('OpenAI API key is missing');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Call OpenAI
        const response = await openai.chat.completions.create({
            model: AI_MODEL,
            messages: [
                {
                    role: 'system',
                    content:
                        'You are an expert historian specializing in finding connections between historical events across time and geography. Your goal is to help users build engaging, educational paths through history by suggesting diverse but meaningfully connected events.',
                },
                { role: 'user', content: prompt },
            ],
            max_tokens: AI_MAX_EVENTS_TOKENS,
            temperature: AI_TEMPERATURE,
            top_p: AI_TOP_P,
            frequency_penalty: AI_FREQUENCY_PENALTY,
            presence_penalty: AI_PRESENCE_PENALTY,
        });

        if (!response.choices[0].message.content) {
            return NextResponse.json({ error: 'Empty response from AI service' }, { status: 500 });
        }

        const rawContent = response.choices[0].message.content.trim();
        const cleanedJson = rawContent.replace(/```json|```/g, '').trim();

        try {
            const suggestions = JSON.parse(cleanedJson);
            const returnedEventIds = new Set();
            const newEvents = [];

            for (const item of suggestions) {
                if (
                    item &&
                    typeof item === 'object' &&
                    'title' in item &&
                    'year' in item &&
                    'lat' in item &&
                    'lon' in item &&
                    'subject' in item &&
                    'info' in item
                ) {
                    const eventId = crypto
                        .createHash('sha256')
                        .update(`${item.title}-${item.year}`)
                        .digest('hex');

                    if (!returnedEventIds.has(eventId)) {
                        newEvents.push({
                            id: eventId,
                            title: item.title,
                            year: parseInt(item.year),
                            lat: parseFloat(item.lat),
                            lon: parseFloat(item.lon),
                            latitude: parseFloat(item.lat),
                            longitude: parseFloat(item.lon),
                            subject: item.subject,
                            info: item.info,
                        });

                        returnedEventIds.add(eventId);

                        if (newEvents.length === numberOfEvents) {
                            break;
                        }
                    }
                }
            }

            try {
                // Save the events to the database before returning them
                await saveEventsToDatabase(newEvents);
            } catch (saveError) {
                console.error('Error while saving events to database:', saveError);
                // Continue even if saving fails
            }

            return NextResponse.json({ events: newEvents });
        } catch (parseError) {
            console.error('Error parsing OpenAI response:', parseError);
            return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
        }
    } catch (error) {
        console.error('API route error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
} 