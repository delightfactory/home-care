// @ts-nocheck - Deno Edge Function (runs in Deno runtime, not Node.js)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateTechnicianRequest {
    email: string
    password: string
    full_name: string
    phone?: string
    skills?: string[]
    can_drive?: boolean
    salary?: number
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const {
            email,
            password,
            full_name,
            phone,
            skills = [],
            can_drive = false,
            salary
        }: CreateTechnicianRequest = await req.json()

        // Validate required fields
        if (!email || !password || !full_name) {
            throw new Error('البريد الإلكتروني وكلمة المرور والاسم مطلوبون')
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

        // 1. Get technician role ID (workers are created as technicians by default)
        const { data: roleData, error: roleError } = await supabaseAdmin
            .from('roles')
            .select('id')
            .eq('name', 'technician')
            .single()

        if (roleError || !roleData) {
            throw new Error('لم يتم العثور على دور الفني')
        }

        // 2. Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        })

        if (authError) {
            if (authError.message.includes('already')) {
                throw new Error('البريد الإلكتروني مستخدم بالفعل')
            }
            throw authError
        }

        // 3. Wait for trigger to create users row
        await new Promise(resolve => setTimeout(resolve, 200))

        try {
            // 4. Update users row with correct data
            const { error: updateError } = await supabaseAdmin
                .from('users')
                .update({
                    full_name,
                    phone: phone || null,
                    role_id: roleData.id,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', authData.user.id)

            if (updateError) {
                // Fallback: try insert
                await supabaseAdmin
                    .from('users')
                    .insert({
                        id: authData.user.id,
                        email,
                        full_name,
                        phone: phone || null,
                        role_id: roleData.id,
                        is_active: true,
                    })
            }

            // 5. Create worker linked to user
            const { data: workerData, error: workerError } = await supabaseAdmin
                .from('workers')
                .insert({
                    user_id: authData.user.id,
                    name: full_name,
                    phone: phone || '',
                    hire_date: new Date().toISOString().split('T')[0],
                    skills: skills,
                    can_drive: can_drive,
                    salary: salary || null,
                    status: 'active',
                    rating: 0,
                    total_orders: 0,
                })
                .select()
                .single()

            if (workerError) throw workerError

            return new Response(
                JSON.stringify({
                    success: true,
                    user_id: authData.user.id,
                    worker_id: workerData.id,
                    message: 'تم إنشاء الفني بنجاح'
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                }
            )
        } catch (innerError) {
            // Rollback: delete auth user if worker creation fails
            console.error('Rollback: deleting auth user due to error:', innerError)
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
            throw innerError
        }
    } catch (error) {
        console.error('Create technician error:', error)
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
