// @ts-nocheck - Deno Edge Function (runs in Deno runtime, not Node.js)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
    email: string
    password: string
    full_name: string
    phone?: string
    role_id: string
    is_active?: boolean
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { email, password, full_name, phone, role_id, is_active = true }: CreateUserRequest = await req.json()

        // Validate required fields
        if (!email || !password || !full_name || !role_id) {
            throw new Error('البريد الإلكتروني وكلمة المرور والاسم والدور مطلوبون')
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

        // 1. Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        })

        if (authError) {
            // Handle duplicate email
            if (authError.message.includes('already')) {
                throw new Error('البريد الإلكتروني مستخدم بالفعل')
            }
            throw authError
        }

        // 2. Wait a moment for trigger to create the users row
        await new Promise(resolve => setTimeout(resolve, 200))

        // 3. Update the users row created by trigger with full data
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                full_name,
                phone: phone || null,
                role_id,
                is_active,
                updated_at: new Date().toISOString(),
            })
            .eq('id', authData.user.id)

        if (updateError) {
            // If update fails, try insert (fallback if trigger didn't work)
            const { error: insertError } = await supabaseAdmin
                .from('users')
                .insert({
                    id: authData.user.id,
                    email,
                    full_name,
                    phone: phone || null,
                    role_id,
                    is_active,
                })

            if (insertError) {
                // Rollback: delete auth user
                await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
                throw new Error('فشل في إنشاء بيانات المستخدم')
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                user_id: authData.user.id,
                message: 'تم إنشاء المستخدم بنجاح'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )
    } catch (error) {
        console.error('Create user error:', error)
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
