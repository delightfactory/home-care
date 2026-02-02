// @ts-nocheck - Deno Edge Function (runs in Deno runtime, not Node.js)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteUserRequest {
    user_id: string
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { user_id }: DeleteUserRequest = await req.json()

        // Validate required fields
        if (!user_id) {
            throw new Error('معرف المستخدم مطلوب')
        }

        // Create Supabase admin client
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // 1. Check if user has associated worker
        const { data: workerData } = await supabaseAdmin
            .from('workers')
            .select('id')
            .eq('user_id', user_id)
            .single()

        if (workerData) {
            // Unlink worker from user (don't delete worker)
            await supabaseAdmin
                .from('workers')
                .update({ user_id: null })
                .eq('user_id', user_id)
        }

        // 2. Delete from users table
        const { error: usersError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', user_id)

        if (usersError) throw usersError

        // 3. Delete from auth
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

        if (authError) {
            console.warn('Auth delete warning:', authError)
            // Continue even if auth delete fails (user might already be deleted)
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'تم حذف المستخدم بنجاح'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )
    } catch (error) {
        console.error('Delete user error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            }
        )
    }
})
