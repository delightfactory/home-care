/// <reference path="./deno.d.ts" />
// ===========================================
// Edge Function: cleanup-storage
// التنظيف التلقائي للملفات في جميع buckets
// ===========================================
// 
// هذه الدالة تُنفذ يومياً لحذف الملفات القديمة
// والحفاظ على حجم التخزين ضمن الحدود المسموحة
//
// الجدولة: يومياً الساعة 3 صباحاً عبر pg_cron
// ===========================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// إعدادات كل bucket
const BUCKETS_CONFIG = [
    {
        name: 'receipts',
        minAgeDays: 90,        // الإيصالات: 90 يوم
        maxStorageMb: 500
    },
    {
        name: 'voice_messages',
        minAgeDays: 7,         // الرسائل الصوتية: 7 أيام فقط
        maxStorageMb: 200
    }
]

const CONFIG = {
    MAX_FILES_PER_RUN: 100,
    BATCH_SIZE: 10,
    CLEANUP_THRESHOLD: 0.8
}

interface StorageStats {
    total_size_mb: number
    file_count: number
    files_older_than_threshold: number
    usage_percentage: number
    cleanup_recommended: boolean
}

interface FileToCleanup {
    file_id: string
    file_name: string
    file_size_bytes: number
    age_days: number
}

interface BucketCleanupResult {
    bucket: string
    files_deleted: number
    bytes_freed: number
    errors: string[]
}

interface CleanupResult {
    success: boolean
    message: string
    buckets: BucketCleanupResult[]
    total_files_deleted: number
    total_mb_freed: number
    duration_ms: number
    errors: string[]
}

// دالة تنظيف bucket واحد
async function cleanupBucket(
    supabase: any,
    bucketName: string,
    minAgeDays: number,
    maxStorageMb: number
): Promise<BucketCleanupResult> {
    const errors: string[] = []
    let deletedCount = 0
    let freedBytes = 0

    try {
        // 1. الحصول على إحصائيات التخزين
        const { data: statsData, error: statsError } = await supabase
            .rpc('get_storage_stats_for_bucket', {
                p_bucket_id: bucketName,
                p_age_threshold_days: minAgeDays
            })

        if (statsError) {
            errors.push(`خطأ في إحصائيات ${bucketName}: ${statsError.message}`)
            return { bucket: bucketName, files_deleted: 0, bytes_freed: 0, errors }
        }

        const stats: StorageStats = statsData?.[0] || {
            total_size_mb: 0,
            file_count: 0,
            files_older_than_threshold: 0,
            usage_percentage: 0,
            cleanup_recommended: false
        }

        console.log(`📊 ${bucketName}: ${stats.total_size_mb}MB, ${stats.files_older_than_threshold} ملفات قديمة`)

        // 2. التحقق من الحاجة للتنظيف
        if (stats.files_older_than_threshold === 0) {
            console.log(`✅ ${bucketName}: لا توجد ملفات قديمة`)
            return { bucket: bucketName, files_deleted: 0, bytes_freed: 0, errors }
        }

        // 3. الحصول على الملفات للحذف
        const { data: filesToDelete, error: filesError } = await supabase
            .rpc('get_files_for_multi_bucket_cleanup', {
                p_bucket_id: bucketName,
                p_older_than_days: minAgeDays,
                p_max_files: CONFIG.MAX_FILES_PER_RUN
            })

        if (filesError) {
            errors.push(`خطأ في جلب ملفات ${bucketName}: ${filesError.message}`)
            return { bucket: bucketName, files_deleted: 0, bytes_freed: 0, errors }
        }

        if (!filesToDelete || filesToDelete.length === 0) {
            return { bucket: bucketName, files_deleted: 0, bytes_freed: 0, errors }
        }

        console.log(`🗑️ ${bucketName}: سيتم حذف ${filesToDelete.length} ملف`)

        // 4. حذف الملفات على دفعات
        for (let i = 0; i < filesToDelete.length; i += CONFIG.BATCH_SIZE) {
            const batch = filesToDelete.slice(i, i + CONFIG.BATCH_SIZE)
            const fileNames = batch.map((f: FileToCleanup) => f.file_name)

            const { error: deleteError } = await supabase
                .storage
                .from(bucketName)
                .remove(fileNames)

            if (deleteError) {
                errors.push(`خطأ في حذف دفعة من ${bucketName}: ${deleteError.message}`)
            } else {
                deletedCount += batch.length
                freedBytes += batch.reduce((sum: number, f: FileToCleanup) =>
                    sum + (f.file_size_bytes || 0), 0
                )
            }

            // انتظار قصير
            if (i + CONFIG.BATCH_SIZE < filesToDelete.length) {
                await new Promise(resolve => setTimeout(resolve, 100))
            }
        }

    } catch (error) {
        errors.push(`خطأ غير متوقع في ${bucketName}: ${error}`)
    }

    return { bucket: bucketName, files_deleted: deletedCount, bytes_freed: freedBytes, errors }
}

Deno.serve(async (req: Request) => {
    const startTime = Date.now()
    const allErrors: string[] = []
    const bucketResults: BucketCleanupResult[] = []

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false }
        })

        console.log('🧹 بدء عملية التنظيف الشاملة...')

        // تنظيف كل bucket
        for (const bucket of BUCKETS_CONFIG) {
            console.log(`\n📁 تنظيف ${bucket.name}...`)

            const result = await cleanupBucket(
                supabase,
                bucket.name,
                bucket.minAgeDays,
                bucket.maxStorageMb
            )

            bucketResults.push(result)
            allErrors.push(...result.errors)
        }

        // حساب الإجماليات
        const totalDeleted = bucketResults.reduce((sum, r) => sum + r.files_deleted, 0)
        const totalFreedBytes = bucketResults.reduce((sum, r) => sum + r.bytes_freed, 0)
        const totalFreedMb = Math.round((totalFreedBytes / 1024 / 1024) * 100) / 100
        const duration = Date.now() - startTime

        // تسجيل العملية
        if (totalDeleted > 0) {
            await supabase.rpc('log_cleanup_completed', {
                p_bucket_id: 'all',
                p_deleted_count: totalDeleted,
                p_freed_bytes: totalFreedBytes
            })
        }

        console.log(`\n🎉 اكتملت عملية التنظيف:`)
        console.log(`   - الملفات المحذوفة: ${totalDeleted}`)
        console.log(`   - المساحة المحررة: ${totalFreedMb} MB`)
        console.log(`   - المدة: ${duration}ms`)

        return new Response(JSON.stringify({
            success: true,
            message: `تم حذف ${totalDeleted} ملف وتحرير ${totalFreedMb} MB`,
            buckets: bucketResults,
            total_files_deleted: totalDeleted,
            total_mb_freed: totalFreedMb,
            duration_ms: duration,
            errors: allErrors
        } as CleanupResult), {
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('❌ خطأ في عملية التنظيف:', error)

        return new Response(JSON.stringify({
            success: false,
            message: error instanceof Error ? error.message : 'خطأ غير متوقع',
            buckets: bucketResults,
            total_files_deleted: 0,
            total_mb_freed: 0,
            duration_ms: Date.now() - startTime,
            errors: [error instanceof Error ? error.message : 'خطأ غير متوقع']
        } as CleanupResult), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})
