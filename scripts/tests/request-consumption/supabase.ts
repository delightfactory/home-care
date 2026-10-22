import { createClient } from '@supabase/supabase-js';

export interface CapturedRequest { table: string; method: string; url: URL; body: string | undefined }
export const transport = {
  calls: [] as CapturedRequest[],
  reply: async (_request: CapturedRequest): Promise<Response> => new Response('[]', {
    headers: { 'content-type': 'application/json', 'content-range': '*/0' }
  }),
};

export const supabase = createClient('https://request-test.invalid', 'synthetic-public-key', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: async (input, init) => {
    const url = new URL(String(input));
    const request = { table: url.pathname.split('/').pop()!, method: init?.method ?? 'GET', url, body: init?.body as string | undefined };
    transport.calls.push(request);
    return transport.reply(request);
  } },
});
export const handleSupabaseError = (failure: { message?: string }) => failure.message ?? 'request failed';
export const generateOrderNumber = () => 'SYNTHETIC-UNUSED';
