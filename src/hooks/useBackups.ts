import { useState, useEffect, useCallback } from 'react'
import { getBackups, BackupMeta, createBackup, resetOperationalData, restoreBackup, deleteBackup } from '../api/backups'
import toast from 'react-hot-toast'

export const useBackups = () => {
  const [backups, setBackups] = useState<BackupMeta[]>([])
  const [loading, setLoading] = useState(false)

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

  // عمليات
  const handleCreateBackup = async (label?: string) => {
    toast.loading('إنشاء نسخة احتياطية...', { id: 'bk' })
    const res = await createBackup(label)
    toast.dismiss('bk')
    if (res.success) {
      toast.success('تم إنشاء النسخة بنجاح')
      // تنزيل تلقائيًا
      const blob = new Blob([JSON.stringify(res.data)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${label || 'backup'}-${new Date().toISOString().slice(0,19)}.json`
      a.click()
      URL.revokeObjectURL(url)
      fetchBackups()
    } else {
      toast.error(res.error || 'فشل إنشاء النسخة')
    }
  }

  const handleReset = async () => {
    const confirmed = window.confirm('سيتم حذف البيانات التشغيلية! هل أنت متأكد؟')
    if (!confirmed) return
    toast.loading('جاري إعادة الضبط...', { id: 'reset' })
    const res = await resetOperationalData()
    toast.dismiss('reset')
    res.success ? toast.success('تمت إعادة الضبط') : toast.error(res.error || 'فشل إعادة الضبط')
  }

  const handleRestore = async (id: string) => {
    const confirmed = window.confirm('سيتم استعادة البيانات وقد تفقد التغييرات الحالية، هل تريد المتابعة؟')
    if (!confirmed) return
    toast.loading('جاري الاستعادة...', { id: 'restore' })
    const res = await restoreBackup(id)
    toast.dismiss('restore')
    if (res.success) {
      toast.success('تمت الاستعادة بنجاح')
    } else {
      toast.error(res.error || 'فشل الاستعادة')
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('سيتم حذف النسخة بشكل نهائي!')
    if (!confirmed) return
    const res = await deleteBackup(id)
    res.success ? toast.success('تم حذف النسخة') : toast.error(res.error || 'فشل الحذف')
    fetchBackups()
  }

  return { backups, loading, refresh: fetchBackups, handleCreateBackup, handleReset, handleRestore, handleDelete }
}
