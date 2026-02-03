// supabase/functions/send_push_notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
    user_id?: string;
    user_ids?: string[];
    title: string;
    message: string;
    url?: string;
    icon?: string;
    data?: Record<string, unknown>;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Verify authorization
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const payload: PushPayload = await req.json();
        const { user_id, user_ids, title, message, url, icon, data } = payload;

        // Validate required fields
        if (!title || !message) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: title, message' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Collect target user IDs
        const targetUserIds = user_ids || (user_id ? [user_id] : []);

        if (targetUserIds.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No user IDs provided' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get active push subscriptions for target users
        const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('*')
            .in('user_id', targetUserIds)
            .eq('is_active', true);

        if (subError) {
            console.error('Error fetching subscriptions:', subError);
            throw subError;
        }

        if (!subscriptions || subscriptions.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No active subscriptions found', sent: 0, failed: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get VAPID keys from environment
        const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
        const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
        const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@homecare.com';

        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            return new Response(
                JSON.stringify({ error: 'VAPID keys not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Import web-push library
        const webpush = await import('npm:web-push@3.6.7');

        webpush.setVapidDetails(
            VAPID_SUBJECT,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );

        // Prepare push notification payload
        const pushPayload = JSON.stringify({
            title,
            body: message,
            icon: icon || '/icons/icon-192x192.png',
            badge: '/icons/favicon-32x32.png',
            dir: 'rtl',
            lang: 'ar',
            data: { url, ...data }
        });

        // Send push to each subscription
        let sentCount = 0;
        let failedCount = 0;

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh_key,
                            auth: sub.auth_key
                        }
                    },
                    pushPayload
                );

                sentCount++;

                // Update last_used_at and reset failed_count
                await supabase
                    .from('push_subscriptions')
                    .update({
                        last_used_at: new Date().toISOString(),
                        failed_count: 0
                    })
                    .eq('id', sub.id);

            } catch (pushError: unknown) {
                console.error(`Push failed for endpoint ${sub.endpoint}:`, pushError);
                failedCount++;

                const error = pushError as { statusCode?: number };

                // If 410 (Gone) or 404 (Not Found), subscription is invalid
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await supabase
                        .from('push_subscriptions')
                        .update({ is_active: false })
                        .eq('id', sub.id);
                } else {
                    // Increment failed count
                    await supabase
                        .from('push_subscriptions')
                        .update({ failed_count: (sub.failed_count || 0) + 1 })
                        .eq('id', sub.id);

                    // Deactivate if too many failures
                    if ((sub.failed_count || 0) >= 5) {
                        await supabase
                            .from('push_subscriptions')
                            .update({ is_active: false })
                            .eq('id', sub.id);
                    }
                }
            }
        }

        return new Response(
            JSON.stringify({
                sent: sentCount,
                failed: failedCount,
                total: subscriptions.length
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: unknown) {
        console.error('Error in send_push_notification:', error);
        const err = error as Error;
        return new Response(
            JSON.stringify({ error: err.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
