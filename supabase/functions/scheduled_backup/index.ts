// @ts-nocheck
// Scheduled Backup Edge Function
// يتوافق مع نظام النسخ الاحتياطي الحالي ونظام الاستعادة
// ================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// نفس ترتيب الجداول في النظام الحالي - مهم جداً للاستعادة
const TABLES_TO_BACKUP: string[] = [
    // جداول مرجعية (لا تُحذف في reset)
    'roles',
    'customers',
    'workers',
    'teams',
    'team_members',
    'service_categories',
    'services',
    'expense_categories',
    'system_settings',
    // جداول تشغيلية (تُفرَّغ في reset)
    'orders',
    'order_items',
    'order_status_logs',
    'routes',
    'route_orders',
    'order_workers',
    'expenses',
    'daily_reports',
    'team_performance',
    'performance_logs'
]

// عدد النسخ الاحتياطية للاحتفاظ بها
const MAX_BACKUPS_TO_KEEP = 5

// دالة لحساب SHA-256
async function sha256(text: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(text)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b: number) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req: Request) => {
    // التحقق من Authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        // استخدام service_role للوصول الكامل
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        console.log('Starting scheduled backup...')
        console.log(`Tables to backup: ${TABLES_TO_BACKUP.length}`)

        // تجميع البيانات من كل جدول
        const backupPayload: Record<string, unknown[]> = {}

        for (const tableName of TABLES_TO_BACKUP) {
            console.log(`Backing up table: ${tableName}`)

            const { data, error } = await supabase
                .from(tableName)
                .select('*', { count: 'exact' })
                .limit(1000000)  // جلب حتى مليون صف لكل جدول

            if (error) {
                console.error(`Error backing up ${tableName}:`, error)
                // نستمر حتى لو فشل جدول (قد يكون فارغاً أو غير موجود)
                backupPayload[tableName] = []
            } else {
                backupPayload[tableName] = data || []
                console.log(`  - ${(data || []).length} rows`)
            }
        }

        // تحويل إلى JSON
        const payloadJson = JSON.stringify(backupPayload)
        const sizeBytes = new TextEncoder().encode(payloadJson).length
        const checksum = await sha256(payloadJson)

        // إنشاء التسمية
        const now = new Date()
        const label = `Auto ${now.toISOString().slice(0, 16).replace('T', ' ')}`

        console.log(`Backup size: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`)
        console.log(`Checksum: ${checksum.slice(0, 16)}...`)

        // حفظ النسخة في جدول backups
        const { data: insertedBackup, error: insertError } = await supabase
            .from('backups')
            .insert({
                label,
                created_by: null, // تلقائي
                size_bytes: sizeBytes,
                checksum_sha256: checksum,
                payload: backupPayload
            })
            .select('id')
            .single()

        if (insertError) {
            console.error('Error inserting backup:', insertError)
            return new Response(JSON.stringify({
                success: false,
                error: insertError.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        console.log(`Backup created with ID: ${insertedBackup.id}`)

        // تنظيف النسخ القديمة - الاحتفاظ بآخر MAX_BACKUPS_TO_KEEP
        const { data: allBackups, error: listError } = await supabase
            .from('backups')
            .select('id, created_at')
            .order('created_at', { ascending: false })

        if (!listError && allBackups && allBackups.length > MAX_BACKUPS_TO_KEEP) {
            const backupsToDelete = allBackups.slice(MAX_BACKUPS_TO_KEEP)
            const idsToDelete = backupsToDelete.map((b: { id: string }) => b.id)

            console.log(`Cleaning up ${idsToDelete.length} old backups...`)

            const { error: deleteError } = await supabase
                .from('backups')
                .delete()
                .in('id', idsToDelete)

            if (deleteError) {
                console.error('Error deleting old backups:', deleteError)
            } else {
                console.log('Old backups cleaned up successfully')
            }
        }

        return new Response(JSON.stringify({
            success: true,
            backup_id: insertedBackup.id,
            label,
            size_bytes: sizeBytes,
            size_mb: (sizeBytes / 1024 / 1024).toFixed(2),
            tables_count: TABLES_TO_BACKUP.length,
            checksum: checksum.slice(0, 16) + '...'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Backup failed:', errorMessage)
        return new Response(JSON.stringify({
            success: false,
            error: errorMessage
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})
