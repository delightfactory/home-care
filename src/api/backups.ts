import { supabase } from '../lib/supabase'
import { handleSupabaseError } from '../lib/supabase'

export interface BackupMeta {
  id: string
  label: string | null
  status: string
  created_at: string
  completed_at: string | null
  tables_count: number
  total_rows: number
  size_bytes: number
}

interface BackupManifestItem {
  table_name: string
  table_order: number
  row_count: number
  size_bytes: number
  checksum_md5: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export async function getBackups(): Promise<ApiResponse<BackupMeta[]>> {
  const { data, error } = await (supabase as any).rpc('admin_list_backup_v2')

  if (error) return { success: false, error: handleSupabaseError(error) }
  return { success: true, data: data || [] }
}

export async function createBackup(label?: string): Promise<ApiResponse<{ run_id: string }>> {
  const { data, error } = await (supabase as any).rpc('admin_create_backup_v2', {
    p_label: label || null
  })

  if (error) return { success: false, error: handleSupabaseError(error) }
  return { success: true, data }
}

export async function downloadBackup(backup: BackupMeta): Promise<ApiResponse<null>> {
  const { data: manifest, error: manifestError } = await (supabase as any).rpc(
    'admin_get_backup_v2_manifest',
    { p_run_id: backup.id }
  )

  if (manifestError) {
    return { success: false, error: handleSupabaseError(manifestError) }
  }

  const chunks = (manifest || []) as BackupManifestItem[]
  if (chunks.length !== backup.tables_count) {
    return { success: false, error: 'فشل التحقق من قائمة جداول النسخة' }
  }

  const payload: Record<string, unknown[]> = {}

  for (const chunk of chunks) {
    const { data, error } = await (supabase as any).rpc(
      'admin_download_backup_v2_chunk',
      {
        p_run_id: backup.id,
        p_table_name: chunk.table_name
      }
    )

    if (error) return { success: false, error: handleSupabaseError(error) }
    if (!Array.isArray(data) || data.length !== Number(chunk.row_count)) {
      return {
        success: false,
        error: `فشل التحقق من بيانات جدول ${chunk.table_name}`
      }
    }

    payload[chunk.table_name] = data
  }

  const exportData = {
    format: 'home-care-backup-v2',
    version: 2,
    backup: {
      id: backup.id,
      label: backup.label,
      created_at: backup.created_at,
      completed_at: backup.completed_at,
      tables_count: backup.tables_count,
      total_rows: backup.total_rows,
      size_bytes: backup.size_bytes
    },
    manifest: chunks,
    payload
  }

  const blob = new Blob([JSON.stringify(exportData)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const safeLabel = (backup.label || 'backup-v2').replace(/[^\p{L}\p{N}._-]+/gu, '-')

  link.href = url
  link.download = `${safeLabel}-${backup.id}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)

  return { success: true }
}
