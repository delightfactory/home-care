// Backup API wrapper for Supabase RPC functions
// يوفر دوال للتعامل مع النسخ الاحتياطية عبر RPC

import { supabase } from '../lib/supabase'
import { handleSupabaseError } from '../lib/supabase'

export interface BackupMeta {
  id: string
  label: string | null
  created_at: string
  created_by: string | null
  size_bytes: number | null
  checksum_sha256?: string | null
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Fetch backups metadata (باستخدام الـ VIEW العامة أو الجدول مباشرة)
export async function getBackups(): Promise<ApiResponse<BackupMeta[]>> {
  const { data, error } = await supabase
    .from('v_backups_public')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: handleSupabaseError(error) }
  return { success: true, data: data || [] }
}

// Create a new backup and return JSON payload
export async function createBackup(label?: string): Promise<ApiResponse<any>> {
  const { data, error } = await supabase.rpc('create_backup_and_return', {
    p_label: label || null
  })
  if (error) return { success: false, error: handleSupabaseError(error) }
  return { success: true, data }
}

// Reset operational data (تفريغ الجداول التشغيلية)
export async function resetOperationalData(): Promise<ApiResponse<null>> {
  const { error } = await supabase.rpc('reset_operational_data')
  if (error) return { success: false, error: handleSupabaseError(error) }
  return { success: true }
}

// Restore from an existing backup by ID
export async function restoreBackup(backupId: string): Promise<ApiResponse<null>> {
  const { error } = await supabase.rpc('restore_from_backup', {
    p_backup_id: backupId
  })
  if (error) return { success: false, error: handleSupabaseError(error) }
  return { success: true }
}

// Delete backup (optional) – only for admin
export async function deleteBackup(backupId: string): Promise<ApiResponse<null>> {
  const { error } = await supabase
    .from('backups')
    .delete()
    .eq('id', backupId)

  if (error) return { success: false, error: handleSupabaseError(error) }
  return { success: true }
}
