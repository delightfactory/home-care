-- =====================================================================
-- Migration 213: Fix advance_installments status check constraint
-- إضافة 'cancelled' للقيم المسموح بها في حالة القسط
-- =====================================================================
-- المشكلة: دالة cancel_advance_with_refund تحاول تغيير حالة الأقساط إلى 'cancelled'
-- لكن الـ CHECK constraint الأصلى لا يسمح بهذه القيمة
-- الحل: حذف الـ constraint القديم وإنشاء واحد جديد يتضمن 'cancelled'
-- =====================================================================

ALTER TABLE advance_installments
  DROP CONSTRAINT IF EXISTS advance_installments_status_check;

ALTER TABLE advance_installments
  ADD CONSTRAINT advance_installments_status_check
  CHECK (status IN ('pending', 'deducted', 'skipped', 'cancelled'));
