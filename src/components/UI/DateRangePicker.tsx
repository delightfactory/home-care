import React, { useState, useRef, useEffect } from 'react'
import { Calendar, X } from 'lucide-react'
import DateTimePicker from './DateTimePicker'

interface DateRangePickerProps {
  startDate?: string
  endDate?: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  label?: string
  error?: string
  minDate?: string
  maxDate?: string
  showPresets?: boolean
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate = '',
  endDate = '',
  onStartDateChange,
  onEndDateChange,
  placeholder = 'اختر فترة زمنية',
  disabled = false,
  className = '',
  label,
  error,
  minDate,
  maxDate,
  showPresets = true
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Detect mobile device and handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Prevent body scroll when modal is open on mobile
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, isMobile])

  // Position dropdown to stay within viewport
  useEffect(() => {
    if (isOpen && !isMobile && dropdownRef.current && containerRef.current) {
      const dropdown = dropdownRef.current
      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const dropdownRect = dropdown.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Reset position
      dropdown.style.left = '0'
      dropdown.style.right = 'auto'
      dropdown.style.top = '100%'
      dropdown.style.bottom = 'auto'

      // Check if dropdown goes beyond right edge
      if (rect.left + dropdownRect.width > viewportWidth - 20) {
        dropdown.style.left = 'auto'
        dropdown.style.right = '0'
      }

      // Check if dropdown goes beyond bottom edge
      if (rect.bottom + dropdownRect.height > viewportHeight - 20) {
        dropdown.style.top = 'auto'
        dropdown.style.bottom = '100%'
      }
    }
  }, [isOpen, isMobile])

  const formatDisplayValue = () => {
    if (!startDate && !endDate) return ''
    
    const formatDate = (dateStr: string) => {
      if (!dateStr) return ''
      return new Date(dateStr).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }

    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`
    } else if (startDate) {
      return `من ${formatDate(startDate)}`
    } else if (endDate) {
      return `إلى ${formatDate(endDate)}`
    }
    return ''
  }

  const handlePresetSelect = (preset: string) => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    
    switch (preset) {
      case 'today':
        onStartDateChange(todayStr)
        onEndDateChange(todayStr)
        break
      case 'yesterday':
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        onStartDateChange(yesterdayStr)
        onEndDateChange(yesterdayStr)
        break
      case 'thisWeek':
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay())
        onStartDateChange(startOfWeek.toISOString().split('T')[0])
        onEndDateChange(todayStr)
        break
      case 'lastWeek':
        const lastWeekEnd = new Date(today)
        lastWeekEnd.setDate(today.getDate() - today.getDay() - 1)
        const lastWeekStart = new Date(lastWeekEnd)
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6)
        onStartDateChange(lastWeekStart.toISOString().split('T')[0])
        onEndDateChange(lastWeekEnd.toISOString().split('T')[0])
        break
      case 'thisMonth':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        onStartDateChange(startOfMonth.toISOString().split('T')[0])
        onEndDateChange(todayStr)
        break
      case 'lastMonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        onStartDateChange(lastMonthStart.toISOString().split('T')[0])
        onEndDateChange(lastMonthEnd.toISOString().split('T')[0])
        break
      case 'last30Days':
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(today.getDate() - 30)
        onStartDateChange(thirtyDaysAgo.toISOString().split('T')[0])
        onEndDateChange(todayStr)
        break
      case 'last90Days':
        const ninetyDaysAgo = new Date(today)
        ninetyDaysAgo.setDate(today.getDate() - 90)
        onStartDateChange(ninetyDaysAgo.toISOString().split('T')[0])
        onEndDateChange(todayStr)
        break
    }
    setIsOpen(false)
  }

  const clearDates = () => {
    onStartDateChange('')
    onEndDateChange('')
  }

  const presets = [
    { key: 'today', label: 'اليوم' },
    { key: 'yesterday', label: 'أمس' },
    { key: 'thisWeek', label: 'هذا الأسبوع' },
    { key: 'lastWeek', label: 'الأسبوع الماضي' },
    { key: 'thisMonth', label: 'هذا الشهر' },
    { key: 'lastMonth', label: 'الشهر الماضي' },
    { key: 'last30Days', label: 'آخر 30 يوم' },
    { key: 'last90Days', label: 'آخر 90 يوم' }
  ]

  return (
    <div className="space-y-2" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          type="text"
          value={formatDisplayValue()}
          placeholder={placeholder}
          readOnly
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(true)}
          className={`
            w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl
            focus:ring-2 focus:ring-primary-500 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            cursor-pointer transition-all duration-200
            ${formatDisplayValue() ? 'border-green-500 bg-green-50' : ''}
            ${error ? 'border-red-500 bg-red-50' : ''}
            ${className}
          `}
        />
        
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          <Calendar className={`h-5 w-5 ${formatDisplayValue() ? 'text-green-500' : 'text-gray-400'}`} />
        </div>
        
        {formatDisplayValue() && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              clearDates()
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {/* Dropdown Panel - Mobile Modal */}
      {isOpen && isMobile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-t-3xl shadow-2xl w-full max-h-[90vh] overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-primary-100">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                اختر فترة زمنية
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-full transition-all duration-200"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>
            
            {/* Content */}
            <div className="overflow-y-auto max-h-[70vh] p-4 sm:p-6">
              {/* Presets */}
              {showPresets && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">فترات سريعة</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => handlePresetSelect(preset.key)}
                        className="px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-colors text-center"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Date Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ البداية</label>
                  <DateTimePicker
                    value={startDate}
                    onChange={onStartDateChange}
                    type="date"
                    placeholder="اختر تاريخ البداية"
                    minDate={minDate}
                    maxDate={endDate || maxDate}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ النهاية</label>
                  <DateTimePicker
                    value={endDate}
                    onChange={onEndDateChange}
                    type="date"
                    placeholder="اختر تاريخ النهاية"
                    minDate={startDate || minDate}
                    maxDate={maxDate}
                  />
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex space-x-3 rtl:space-x-reverse">
                <button
                  type="button"
                  onClick={clearDates}
                  className="flex-1 px-4 py-3 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:text-gray-800 hover:bg-gray-50 transition-colors"
                >
                  مسح
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-6 py-3 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                >
                  تطبيق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dropdown Panel - Desktop */}
      {isOpen && !isMobile && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg w-full sm:w-auto sm:min-w-[500px] lg:min-w-[600px] max-w-[95vw]"
        >
          <div className="flex flex-col lg:flex-row">
            {/* Presets Sidebar */}
            {showPresets && (
              <div className="w-full lg:w-48 border-b lg:border-b-0 lg:border-r border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">فترات سريعة</h4>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-1">
                  {presets.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handlePresetSelect(preset.key)}
                      className="w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Date Inputs */}
            <div className="flex-1 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ البداية</label>
                  <DateTimePicker
                    value={startDate}
                    onChange={onStartDateChange}
                    type="date"
                    placeholder="اختر تاريخ البداية"
                    minDate={minDate}
                    maxDate={endDate || maxDate}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ النهاية</label>
                  <DateTimePicker
                    value={endDate}
                    onChange={onEndDateChange}
                    type="date"
                    placeholder="اختر تاريخ النهاية"
                    minDate={startDate || minDate}
                    maxDate={maxDate}
                  />
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 rtl:space-x-reverse pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={clearDates}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors order-2 sm:order-1"
                >
                  مسح
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors order-1 sm:order-2"
                >
                  تطبيق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DateRangePicker