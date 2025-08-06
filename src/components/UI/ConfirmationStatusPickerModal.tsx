import React, { useState } from 'react'
import SmartModal from './SmartModal'
import { Check, RefreshCw, XCircle } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'
import { ConfirmationStatus } from '../../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: (status: ConfirmationStatus) => void
  currentStatus?: ConfirmationStatus | null
  loading?: boolean
  customerName?: string
  customerArea?: string
}

const colorClasses: Record<ConfirmationStatus, string> = {
  [ConfirmationStatus.PENDING]: 'bg-amber-50 border-amber-300 text-amber-800',
  [ConfirmationStatus.CONFIRMED]: 'bg-emerald-50 border-emerald-300 text-emerald-800',
  [ConfirmationStatus.DECLINED]: 'bg-rose-50 border-rose-300 text-rose-800'
}

const statusOptions: { value: ConfirmationStatus; label: string; icon: JSX.Element }[] = [
  {
    value: ConfirmationStatus.PENDING,
    label: 'غير مؤكد',
    icon: <RefreshCw className="h-4 w-4 mr-1" />
  },
  {
    value: ConfirmationStatus.CONFIRMED,
    label: 'تم التأكيد',
    icon: <Check className="h-4 w-4 mr-1" />
  },
  {
    value: ConfirmationStatus.DECLINED,
    label: 'مرفوض',
    icon: <XCircle className="h-4 w-4 mr-1" />
  }
]

const ConfirmationStatusPickerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  currentStatus = ConfirmationStatus.PENDING,
  loading = false,
  customerName,
  customerArea
}) => {
  const [selected, setSelected] = useState<ConfirmationStatus>(currentStatus ?? ConfirmationStatus.PENDING)

  // مزامنة الاختيار مع الحالة الحالية عند فتح المودال أو تغيّرها
  React.useEffect(() => {
    if (isOpen) {
      setSelected(currentStatus ?? ConfirmationStatus.PENDING)
    }
  }, [isOpen, currentStatus])

  if (!isOpen) return null

  return (
    <SmartModal
      isOpen={isOpen}
      onClose={onClose}
      title="تعديل حالة التأكيد"
      subtitle={customerName ? `${customerName}${customerArea ? ' - ' + customerArea : ''}` : undefined}
      size="sm"
    >
      <div className="p-6 space-y-6">
        <div className="space-y-3">
          {statusOptions.map(opt => (
            <label
              key={opt.value}
              className={`flex items-center px-4 py-3 rounded-lg cursor-pointer border transition-all duration-200 ${colorClasses[opt.value]} ${selected === opt.value ? 'ring-2 ring-blue-600' : ''} hover:brightness-95`}
            >
              <input
                type="radio"
                name="confirmationStatus"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                className="form-radio text-blue-600 mr-3"
              />
              {opt.icon}
              <span className="font-medium text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all duration-200 font-medium"
            onClick={onClose}
            disabled={loading}
          >
            تراجع
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
            onClick={() => onConfirm(selected)}
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

export default ConfirmationStatusPickerModal
