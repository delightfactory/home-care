import React, { useState } from 'react'
import { PlusCircle, RefreshCw, RotateCw, Trash2, ShieldCheck } from 'lucide-react'
import { useBackups } from '../../hooks/useBackups'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import { formatBytes } from '@/utils/formatters'

const BackupsPage: React.FC = () => {
  const { backups, loading, refresh, handleCreateBackup, handleReset, handleRestore, handleDelete } = useBackups()
  const [label, setLabel] = useState('')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة النسخ الاحتياطية</h1>
          <p className="text-gray-600 mt-1">إنشاء، تنزيل، استعادة، وحذف النسخ الاحتياطية لقاعدة البيانات</p>
        </div>
        <button onClick={refresh} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-5 h-5" /> تحديث
        </button>
      </div>

      {/* إنشاء نسخة */}
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label">وصف النسخة (اختياري)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="input w-full"
              placeholder="مثلاً: قبل تحديث رئيسي"
            />
          </div>
          <button onClick={() => handleCreateBackup(label)} className="btn-primary flex items-center gap-2">
            <PlusCircle className="w-5 h-5" /> إنشاء نسخة احتياطية
          </button>
          <button onClick={handleReset} className="btn-danger flex items-center gap-2">
            <RotateCw className="w-5 h-5" /> إعادة ضبط البيانات التشغيلية
          </button>
        </div>
      </div>

      {/* قائمة النسخ */}
      <div className="card overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingSpinner size="large" text="جاري التحميل..." />
          </div>
        ) : backups.length === 0 ? (
          <p className="text-center text-gray-500 py-8">لا توجد نسخ احتياطية حتى الآن</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-right bg-gray-50">
                <th className="px-4 py-2">التاريخ</th>
                <th className="px-4 py-2">الوصف</th>
                <th className="px-4 py-2">الحجم</th>
                <th className="px-4 py-2">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(b.created_at).toLocaleString('ar-EG')}</td>
                  <td className="px-4 py-2">{b.label || '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatBytes(b.size_bytes || 0)}</td>
                  <td className="px-4 py-2 space-x-1 space-x-reverse">
                    <button
                      onClick={() => handleRestore(b.id)}
                      className="btn-primary btn-sm inline-flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" /> استعادة
                    </button>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="btn-danger btn-sm inline-flex items-center gap-1">
                      <Trash2 className="w-4 h-4" /> حذف
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
