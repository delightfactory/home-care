// @ts-nocheck - Deno Edge Function (runs in Deno runtime, not Node.js)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateUserRequest {
    user_id: string
    full_name?: string
    phone?: string
    role_id?: string
    is_active?: boolean
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { user_id, full_name, phone, role_id, is_active }: UpdateUserRequest = await req.json()

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

        // Build update object with only provided fields
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        }

        if (full_name !== undefined) updateData.full_name = full_name
        if (phone !== undefined) updateData.phone = phone
        if (role_id !== undefined) updateData.role_id = role_id
        if (is_active !== undefined) updateData.is_active = is_active

        // Update user
        const { error } = await supabaseAdmin
            .from('users')
            .update(updateData)
            .eq('id', user_id)

        if (error) throw error

        return new Response(
            JSON.stringify({
                success: true,
                message: 'تم تحديث بيانات المستخدم بنجاح'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )
    } catch (error) {
        console.error('Update user error:', error)
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
