import { useState, useEffect, useCallback } from 'react'
import { getBackups, BackupMeta, createBackup, downloadBackup } from '../api/backups'
import toast from 'react-hot-toast'

export const useBackups = () => {
  const [backups, setBackups] = useState<BackupMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const fetchBackups = useCallback(async () => {
    setLoading(true)
    const res = await getBackups()
    if (res.success && res.data) {
      setBackups(res.data)
    } else if (!res.success) {
      toast.error(res.error || 'خطأ في جلب النسخ الاحتياطية')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchBackups()
  }, [fetchBackups])

  const handleCreateBackup = async (label?: string) => {
    if (creating) return
    setCreating(true)
    toast.loading('إنشاء نسخة احتياطية...', { id: 'bk' })
    const res = await createBackup(label)
    toast.dismiss('bk')

    if (res.success) {
      toast.success('تم إنشاء النسخة والتحقق منها بنجاح')
      await fetchBackups()
    } else {
      toast.error(res.error || 'فشل إنشاء النسخة')
    }

    setCreating(false)
  }

  const handleDownload = async (backup: BackupMeta) => {
    if (downloadingId) return
    setDownloadingId(backup.id)
    toast.loading('تجهيز ملف النسخة للتنزيل...', { id: 'download-backup' })
    const res = await downloadBackup(backup)
    toast.dismiss('download-backup')

    if (res.success) {
      toast.success('تم تجهيز وتنزيل النسخة')
    } else {
      toast.error(res.error || 'فشل تنزيل النسخة')
    }

    setDownloadingId(null)
  }

  return {
    backups,
    loading,
    creating,
    downloadingId,
    refresh: fetchBackups,
    handleCreateBackup,
    handleDownload
  }
}
