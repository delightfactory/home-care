// @ts-nocheck - Deno Edge Function (runs in Deno runtime, not Node.js)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResetPasswordRequest {
    user_id: string
    new_password: string
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { user_id, new_password }: ResetPasswordRequest = await req.json()

        // Validate required fields
        if (!user_id || !new_password) {
            throw new Error('معرف المستخدم وكلمة المرور الجديدة مطلوبان')
        }

        // Validate password length
        if (new_password.length < 6) {
            throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
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

        // Update user password using admin API
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
            user_id,
            { password: new_password }
        )

        if (error) {
            if (error.message.includes('not found')) {
                throw new Error('المستخدم غير موجود')
            }
            throw error
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'تم تغيير كلمة المرور بنجاح'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )
    } catch (error) {
        console.error('Reset password error:', error)
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
