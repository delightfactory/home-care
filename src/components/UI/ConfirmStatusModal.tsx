import React from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import SmartModal from './SmartModal'
import LoadingSpinner from './LoadingSpinner'

interface ConfirmStatusModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
  orderNumber?: string | number
  newStatusLabel: string
}

/**
 * Modal عام لإضافة خطوة تأكيد قبل تغيير حالة الطلب.
 * يستخدم SmartModal لتناسق الشكل مع باقي الواجهات.
 */
const ConfirmStatusModal: React.FC<ConfirmStatusModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  orderNumber,
  newStatusLabel
}) => {
  if (!isOpen) return null

  return (
    <SmartModal
      isOpen={isOpen}
      onClose={onClose}
      title="تأكيد تغيير الحالة"
      subtitle="يرجى التأكد قبل المتابعة"
      icon={<AlertTriangle className="h-6 w-6 text-white" />}
      size="sm"
      headerGradient="from-amber-500 via-amber-600 to-amber-700"
    >
      <div className="p-6 space-y-6 text-center">
        <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-amber-600" />
        </div>
        <p className="text-gray-700 text-lg">
          {`هل أنت متأكد من رغبتك في تغيير حالة الطلب ${orderNumber ? `رقم ${orderNumber} ` : ''}إلى "${newStatusLabel}"؟`}
        </p>
        <div className="flex space-x-3 space-x-reverse">
          <button
            type="button"
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            onClick={onClose}
            disabled={loading}
          >
            تراجع
          </button>
          <button
            type="button"
            className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="small" />
                <span className="mr-2">جاري التحديث...</span>
              </div>
            ) : (
              'تأكيد'
            )}
          </button>
        </div>
      </div>
    </SmartModal>
  )
}

export default ConfirmStatusModal
