import React from 'react'
import { Download } from 'lucide-react'

interface ExportButtonProps {
  onClick: () => void
  disabled?: boolean
  className?: string
  title?: string
}

/**
 * زر تصدير موحّد وصغير متجاوب مع جميع الشاشات.
 * - يُظهر الأيقونة فقط على الشاشات الصغيرة ويُظهر النص ابتداءً من حجم sm.
 * - يدعم تمرير كلاس إضافي والتعطيل.
 */
const ExportButton: React.FC<ExportButtonProps> = ({
  onClick,
  disabled = false,
  className = '',
  title = 'تصدير Excel'
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 ${className}`}
      title={title}
    >
      <Download className="w-4 h-4" />
      <span className="hidden sm:inline text-sm sm:text-base">{title}</span>
    </button>
  )
}

export default ExportButton
