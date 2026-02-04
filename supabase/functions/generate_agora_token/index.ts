/// <reference path="./deno.d.ts" />
// ===========================================
// Edge Function: generate_agora_token
// توليد توكن Agora للمكالمات الصوتية
// ===========================================
// يستخدم مكتبة agora-token الرسمية عبر npm:

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// استيراد مكتبة Agora الرسمية عبر npm compatibility
// @ts-ignore - Deno npm import
import { RtcTokenBuilder, RtcRole } from 'npm:agora-token'

// واجهة الطلب
interface TokenRequest {
    channelName: string
    role?: 'publisher' | 'subscriber'
    uid?: number
}

// واجهة الاستجابة
interface TokenResponse {
    success: boolean
    token?: string
    uid?: number
    expiresAt?: number
    error?: string
}

// توليد UID عشوائي
function generateUid(): number {
    return Math.floor(Math.random() * 100000) + 1
}

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({
            success: false,
            error: 'Method not allowed'
        } as TokenResponse), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
        const appId = Deno.env.get('AGORA_APP_ID')!
        const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE')!

        console.log('🔐 Agora Config:', {
            appId: appId ? `${appId.substring(0, 8)}...` : 'MISSING',
            appCertificate: appCertificate ? `${appCertificate.substring(0, 8)}...` : 'MISSING'
        })

        if (!appId || !appCertificate) {
            console.error('❌ Missing Agora credentials')
            throw new Error('Agora credentials not configured')
        }

        // Verify JWT
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({
                success: false,
                error: 'غير مصرح'
            } as TokenResponse), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return new Response(JSON.stringify({
                success: false,
                error: 'جلسة غير صالحة'
            } as TokenResponse), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Parse request
        const body: TokenRequest = await req.json()
        const { channelName, role = 'publisher', uid: requestedUid } = body

        if (!channelName) {
            return new Response(JSON.stringify({
                success: false,
                error: 'اسم القناة مطلوب'
            } as TokenResponse), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Generate token using official Agora library
        const uid = requestedUid || generateUid()
        const expirationTimeInSeconds = 3600 // 1 hour
        const currentTimestamp = Math.floor(Date.now() / 1000)
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds

        const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER

        console.log('🎫 Generating token:', {
            channelName,
            uid,
            role: rtcRole,
            expiresIn: expirationTimeInSeconds
        })

        // استخدام المكتبة الرسمية
        const token = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            channelName,
            uid,
            rtcRole,
            expirationTimeInSeconds,
            expirationTimeInSeconds
        )

        console.log(`✅ Token generated for ${user.id} - Channel: ${channelName} - UID: ${uid}`)
        console.log(`📝 Token preview: ${token.substring(0, 30)}...`)

        return new Response(JSON.stringify({
            success: true,
            token,
            uid,
            expiresAt: privilegeExpiredTs
        } as TokenResponse), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate'
            }
        })

    } catch (error) {
        console.error('❌ Token generation error:', error)

        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'خطأ غير متوقع'
        } as TokenResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
