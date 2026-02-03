-- تنظيف بيانات reply_to_id الخاطئة في جدول الرسائل
-- هذا السكربت يحذف الـ reply_to_id من الرسائل التي تم ربطها خطأً

-- ===============================================
-- 1. عرض الرسائل التي لديها reply_to_id (للفحص)
-- ===============================================
SELECT 
    m.id,
    m.content,
    m.reply_to_id,
    rt.content as replied_to_content,
    m.created_at
FROM messages m
LEFT JOIN messages rt ON m.reply_to_id = rt.id
WHERE m.reply_to_id IS NOT NULL
ORDER BY m.created_at DESC
LIMIT 50;

-- ===============================================
-- 2. تنظيف جميع reply_to_id 
-- (إذا كنت متأكد أن كل البيانات خاطئة)
-- ===============================================
-- ⚠️ احرص - هذا سيحذف جميع علاقات الـ reply
-- UPDATE messages SET reply_to_id = NULL WHERE reply_to_id IS NOT NULL;

-- ===============================================
-- 3. تنظيف reply_to_id للرسائل التي تشير لنفس الرسالة مراراً
-- (حل أكثر دقة)
-- ===============================================
-- البحث عن رسالة المرفق التي يتم الإشارة لها بشكل متكرر
WITH frequent_replies AS (
    SELECT 
        reply_to_id,
        COUNT(*) as reply_count
    FROM messages
    WHERE reply_to_id IS NOT NULL
    GROUP BY reply_to_id
    HAVING COUNT(*) > 3  -- أكثر من 3 رسائل تشير لنفس الرسالة
)
SELECT 
    m.id as original_message_id,
    m.content as original_content,
    m.content_type,
    fr.reply_count
FROM frequent_replies fr
JOIN messages m ON m.id = fr.reply_to_id;

-- ===============================================
-- 4. تنظيف الردود المكررة على نفس الرسالة
-- (نفذ هذا بعد التأكد من النتائج أعلاه)
-- ===============================================
/*
WITH frequent_replies AS (
    SELECT 
        reply_to_id
    FROM messages
    WHERE reply_to_id IS NOT NULL
    GROUP BY reply_to_id
    HAVING COUNT(*) > 3
)
UPDATE messages 
SET reply_to_id = NULL
WHERE reply_to_id IN (SELECT reply_to_id FROM frequent_replies);
*/

-- ===============================================
-- 5. لتنظيف كامل (إذا كل البيانات خاطئة):
-- ===============================================
UPDATE messages SET reply_to_id = NULL WHERE reply_to_id IS NOT NULL;

-- ===============================================
-- 6. تأكيد التنظيف
-- ===============================================
SELECT COUNT(*) as remaining_replies FROM messages WHERE reply_to_id IS NOT NULL;
