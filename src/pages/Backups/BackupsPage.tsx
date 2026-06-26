import React, { useState } from 'react'
import { Download, PlusCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { useBackups } from '../../hooks/useBackups'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import { formatBytes } from '@/utils/formatters'

const BackupsPage: React.FC = () => {
  const {
    backups,
    loading,
    creating,
    downloadingId,
    refresh,
    handleCreateBackup,
    handleDownload
  } = useBackups()
  const [label, setLabel] = useState('')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة النسخ الاحتياطية</h1>
          <p className="text-gray-600 mt-1">إنشاء وعرض وتنزيل النسخ الاحتياطية المتحقق من سلامتها</p>
        </div>
        <button onClick={refresh} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-5 h-5" /> تحديث
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label">وصف النسخة (اختياري)</label>
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="input w-full"
              maxLength={200}
              placeholder="مثلاً: قبل تحديث رئيسي"
            />
          </div>
          <button
            onClick={() => handleCreateBackup(label)}
            disabled={creating}
            className="btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PlusCircle className="w-5 h-5" />
            {creating ? 'جاري الإنشاء والتحقق...' : 'إنشاء نسخة احتياطية'}
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            يتم الاحتفاظ بآخر نسخة مكتملة فقط لتقليل استهلاك مساحة الكاش.
            الاستعادة غير متاحة من الواجهة حاليًا لحماية بيانات التشغيل.
          </p>
        </div>
      </div>

      <div className="card overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingSpinner size="large" text="جاري التحميل..." />
          </div>
        ) : backups.length === 0 ? (
          <p className="text-center text-gray-500 py-8">لا توجد نسخ احتياطية مكتملة حتى الآن</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-right bg-gray-50">
                <th className="px-4 py-2">التاريخ</th>
                <th className="px-4 py-2">الوصف</th>
                <th className="px-4 py-2">الحجم</th>
                <th className="px-4 py-2">المحتوى</th>
                <th className="px-4 py-2">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(backup.completed_at || backup.created_at).toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-2">{backup.label || '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatBytes(backup.size_bytes || 0)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {backup.tables_count} جدول / {backup.total_rows.toLocaleString('en-US')} سجل
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleDownload(backup)}
                      disabled={downloadingId !== null}
                      className="btn-primary btn-sm inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="w-4 h-4" />
                      {downloadingId === backup.id ? 'جاري التجهيز...' : 'تنزيل'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default BackupsPage
