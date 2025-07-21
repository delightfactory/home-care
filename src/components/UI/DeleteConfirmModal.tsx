import React from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'
import SmartModal from './SmartModal'

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  message: string
  loading?: boolean
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  message,
  loading = false
}) => {
  if (!isOpen) return null

  return (
    <SmartModal
      isOpen={isOpen}
      onClose={onClose}
      title="تأكيد الحذف"
      subtitle="هذا الإجراء لا يمكن التراجع عنه"
      icon={<AlertTriangle className="h-6 w-6 text-white" />}
      size="sm"
      headerGradient="from-red-600 to-red-700"
    >

      <div className="p-6">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Trash2 className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-gray-700 text-lg mb-2">
            {message || 'هل أنت متأكد من أنك تريد حذف هذا العنصر؟'}
          </p>
          <p className="text-gray-500 text-sm">
            سيتم حذف جميع البيانات المرتبطة بهذا العنصر نهائياً
          </p>
        </div>



        {/* Actions */}
        <div className="flex space-x-3 space-x-reverse">
          <button
            type="button"
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            onClick={onClose}
            disabled={loading}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="small" />
                <span className="mr-2">جاري الحذف...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Trash2 className="h-4 w-4 ml-2" />
                حذف نهائي
              </div>
            )}
          </button>
        </div>
      </div>
    </SmartModal>
  )
}

export default DeleteConfirmModal
