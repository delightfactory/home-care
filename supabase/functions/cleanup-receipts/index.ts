/// <reference path="./deno.d.ts" />
// ===========================================
// Edge Function: cleanup-receipts
// التنظيف التلقائي لإيصالات المصروفات
// ===========================================
// 
// هذه الدالة تُنفذ يومياً لحذف الملفات القديمة
// والحفاظ على حجم التخزين ضمن الحدود المسموحة
//
// الجدولة: يومياً الساعة 3 صباحاً عبر pg_cron
// ===========================================

import { createClient } from '@supabase/supabase-js'

// معايير التنظيف
const CONFIG = {
    BUCKET_NAME: 'receipts',
    MAX_STORAGE_MB: 500,        // الحد الأقصى للتخزين
    CLEANUP_THRESHOLD: 0.8,     // بدء التنظيف عند 80%
    MIN_FILE_AGE_DAYS: 90,      // الحد الأدنى لعمر الملفات للحذف
    MAX_FILES_PER_RUN: 100,     // الحد الأقصى للملفات في كل تشغيل
    BATCH_SIZE: 10              // حجم الدفعة للحذف
}

interface StorageStats {
    total_size_mb: number
    file_count: number
    files_older_than_90_days: number
    usage_percentage: number
    cleanup_recommended: boolean
}

interface FileToCleanup {
    file_id: string
    file_name: string
    file_size_bytes: number
    age_days: number
}

interface CleanupResult {
    success: boolean
    message: string
    stats: {
        files_deleted: number
        bytes_freed: number
        mb_freed: number
        duration_ms: number
    }
    errors: string[]
}

Deno.serve(async (req: Request) => {
    const startTime = Date.now()
    const errors: string[] = []

    try {
        // إنشاء عميل Supabase مع service role
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false }
        })

        console.log('🧹 بدء عملية تنظيف الإيصالات...')

        // 1. الحصول على إحصائيات التخزين الحالية
        const { data: statsData, error: statsError } = await supabase
            .rpc('get_storage_stats', { p_bucket_id: CONFIG.BUCKET_NAME })

        if (statsError) {
            throw new Error(`خطأ في الحصول على الإحصائيات: ${statsError.message}`)
        }

        const stats: StorageStats = statsData?.[0] || {
            total_size_mb: 0,
            file_count: 0,
            files_older_than_90_days: 0,
            usage_percentage: 0,
            cleanup_recommended: false
        }

        console.log(`📊 الإحصائيات الحالية:`)
        console.log(`   - الحجم: ${stats.total_size_mb} MB من ${CONFIG.MAX_STORAGE_MB} MB`)
        console.log(`   - النسبة: ${stats.usage_percentage}%`)
        console.log(`   - عدد الملفات: ${stats.file_count}`)
        console.log(`   - ملفات قديمة (>90 يوم): ${stats.files_older_than_90_days}`)

        // 2. التحقق من الحاجة للتنظيف
        if (!stats.cleanup_recommended && stats.files_older_than_90_days === 0) {
            console.log('✅ لا حاجة للتنظيف حالياً')

            return new Response(JSON.stringify({
                success: true,
                message: 'لا حاجة للتنظيف',
                stats: {
                    files_deleted: 0,
                    bytes_freed: 0,
                    mb_freed: 0,
                    duration_ms: Date.now() - startTime
                },
                errors: []
            } as CleanupResult), {
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // 3. الحصول على قائمة الملفات القديمة
        const { data: filesToDelete, error: filesError } = await supabase
            .rpc('get_files_for_cleanup', {
                p_bucket_id: CONFIG.BUCKET_NAME,
                p_older_than_days: CONFIG.MIN_FILE_AGE_DAYS,
                p_max_files: CONFIG.MAX_FILES_PER_RUN
            })

        if (filesError) {
            throw new Error(`خطأ في الحصول على الملفات: ${filesError.message}`)
        }

        if (!filesToDelete || filesToDelete.length === 0) {
            console.log('✅ لا توجد ملفات قديمة للحذف')

            return new Response(JSON.stringify({
                success: true,
                message: 'لا توجد ملفات قديمة للحذف',
                stats: {
                    files_deleted: 0,
                    bytes_freed: 0,
                    mb_freed: 0,
                    duration_ms: Date.now() - startTime
                },
                errors: []
            } as CleanupResult), {
                headers: { 'Content-Type': 'application/json' }
            })
        }

        console.log(`🗑️ سيتم حذف ${filesToDelete.length} ملف...`)

        // 4. حذف الملفات على دفعات
        let deletedCount = 0
        let freedBytes = 0

        for (let i = 0; i < filesToDelete.length; i += CONFIG.BATCH_SIZE) {
            const batch = filesToDelete.slice(i, i + CONFIG.BATCH_SIZE)
            const fileNames = batch.map((f: FileToCleanup) => f.file_name)

            const { error: deleteError } = await supabase
                .storage
                .from(CONFIG.BUCKET_NAME)
                .remove(fileNames)

            if (deleteError) {
                errors.push(`خطأ في حذف الدفعة ${Math.floor(i / CONFIG.BATCH_SIZE) + 1}: ${deleteError.message}`)
                console.error(`❌ ${errors[errors.length - 1]}`)
            } else {
                deletedCount += batch.length
                freedBytes += batch.reduce((sum: number, f: FileToCleanup) => sum + (f.file_size_bytes || 0), 0)
                console.log(`✅ تم حذف الدفعة ${Math.floor(i / CONFIG.BATCH_SIZE) + 1} (${batch.length} ملف)`)
            }

            // انتظار قصير بين الدفعات لتجنب الضغط
            if (i + CONFIG.BATCH_SIZE < filesToDelete.length) {
                await new Promise(resolve => setTimeout(resolve, 100))
            }
        }

        // 5. تسجيل عملية التنظيف
        await supabase.rpc('log_cleanup_completed', {
            p_bucket_id: CONFIG.BUCKET_NAME,
            p_deleted_count: deletedCount,
            p_freed_bytes: freedBytes
        })

        const freedMB = Math.round((freedBytes / 1024 / 1024) * 100) / 100
        const duration = Date.now() - startTime

        console.log(`\n🎉 اكتملت عملية التنظيف:`)
        console.log(`   - تم حذف: ${deletedCount} ملف`)
        console.log(`   - تم تحرير: ${freedMB} MB`)
        console.log(`   - المدة: ${duration}ms`)
        if (errors.length > 0) {
            console.log(`   - أخطاء: ${errors.length}`)
        }

        return new Response(JSON.stringify({
            success: true,
            message: `تم حذف ${deletedCount} ملف وتحرير ${freedMB} MB`,
            stats: {
                files_deleted: deletedCount,
                bytes_freed: freedBytes,
                mb_freed: freedMB,
                duration_ms: duration
            },
            errors
        } as CleanupResult), {
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('❌ خطأ في عملية التنظيف:', error)

        return new Response(JSON.stringify({
            success: false,
            message: error instanceof Error ? error.message : 'خطأ غير متوقع',
            stats: {
                files_deleted: 0,
                bytes_freed: 0,
                mb_freed: 0,
                duration_ms: Date.now() - startTime
            },
            errors: [error instanceof Error ? error.message : 'خطأ غير متوقع']
        } as CleanupResult), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})
