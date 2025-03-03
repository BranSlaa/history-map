// Deno type declarations
declare namespace Deno {
	namespace env {
		function get(key: string): string | undefined;
	}
}

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.24.0';
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.3.0';

// CORS headers for the function
export const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers':
		'authorization, x-client-info, apikey, content-type',
};

// Handle CORS preflight requests
function handleCors(req: Request) {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}
}

serve(async (req: Request) => {
	// Handle CORS
	const corsResponse = handleCors(req);
	if (corsResponse) return corsResponse;

	try {
		// Set up OpenAI client - must have OPENAI_API_KEY as env var
		const openAiKey = Deno.env.get('OPENAI_API_KEY');
		if (!openAiKey) {
			throw new Error('OPENAI_API_KEY is required');
		}

		const configuration = new Configuration({ apiKey: openAiKey });
		const openai = new OpenAIApi(configuration);

		// Set up Supabase client - these are injected by Supabase platform
		const supabaseAdmin = createClient(
			Deno.env.get('SUPABASE_URL') ?? '',
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
		);

		// Parse request
		const { text } = await req.json();
		if (!text) {
			return new Response(JSON.stringify({ error: 'Text is required' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Generate embedding from OpenAI
		const embeddingResponse = await openai.createEmbedding({
			model: 'text-embedding-ada-002',
			input: text.trim(),
		});

		// Extract embedding from response
		const [{ embedding }] = embeddingResponse.data.data;

		// Return embedding
		return new Response(JSON.stringify(embedding), {
			headers: {
				...corsHeaders,
				'Content-Type': 'application/json',
			},
			status: 200,
		});
	} catch (error) {
		console.error('Error:', error);

		return new Response(
			JSON.stringify({ error: (error as Error).message }),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 500,
			},
		);
	}
});
