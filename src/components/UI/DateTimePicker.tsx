import React, { useState, useRef, useEffect } from 'react'
import { Calendar, Clock, ChevronLeft, ChevronRight, X, ChevronUp, ChevronDown } from 'lucide-react'

// Helper functions to ensure local-timezone ISO strings (avoid previous-day bug)
const toLocalDateISO = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000 // ms
  return new Date(date.getTime() - tzOffset).toISOString().split('T')[0]
}

const toLocalDateTimeISO = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString()
}

interface DateTimePickerProps {
  value?: string
  onChange: (value: string) => void
  type?: 'date' | 'time' | 'datetime'
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  label?: string
  error?: string
  minDate?: string
  maxDate?: string
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value = '',
  onChange,
  type = 'date',
  placeholder,
  disabled = false,
  required = false,
  className = '',
  label,
  error,
  minDate,
  maxDate
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState({ hours: 12, minutes: 0 })
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isMobile, setIsMobile] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (value) {
      if (type === 'date' || type === 'datetime') {
        const date = new Date(value)
        if (!isNaN(date.getTime())) {
          setSelectedDate(date)
          setCurrentMonth(date)
        }
      }
      if (type === 'time' || type === 'datetime') {
        const timeMatch = value.match(/T?(\d{2}):(\d{2})/)
        if (timeMatch) {
          setSelectedTime({ hours: parseInt(timeMatch[1]), minutes: parseInt(timeMatch[2]) })
        }
      }
    }
  }, [value, type])

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

  const formatDisplayValue = () => {
    if (!value) return ''
    
    if (type === 'date') {
      return new Date(value).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }
    if (type === 'time') {
      return value
    }
    if (type === 'datetime') {
      const date = new Date(value)
      return `${date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })} ${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
    }
    return value
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    
    if (type === 'date') {
      onChange(toLocalDateISO(date))
      setIsOpen(false)
    } else if (type === 'datetime') {
      const datetime = new Date(date)
      datetime.setHours(selectedTime.hours, selectedTime.minutes)
      onChange(toLocalDateTimeISO(datetime))
    }
  }

  const handleTimeChange = (hours: number, minutes: number) => {
    setSelectedTime({ hours, minutes })
    
    if (type === 'time') {
      onChange(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`)
      if (!isMobile) setIsOpen(false)
    } else if (type === 'datetime' && selectedDate) {
      const datetime = new Date(selectedDate)
      datetime.setHours(hours, minutes)
      onChange(toLocalDateTimeISO(datetime))
    }
  }

  const incrementTime = (unit: 'hours' | 'minutes', increment: number) => {
    const newTime = { ...selectedTime }
    
    if (unit === 'hours') {
      newTime.hours = (newTime.hours + increment + 24) % 24
    } else {
      newTime.minutes = (newTime.minutes + increment + 60) % 60
    }
    
    handleTimeChange(newTime.hours, newTime.minutes)
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  const isDateDisabled = (date: Date) => {
    // Compare using local-date ISO strings to avoid timezone shift issues
    const dateISO = toLocalDateISO(date)
    if (minDate && dateISO < minDate) return true
    if (maxDate && dateISO > maxDate) return true
    return false
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev)
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1)
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1)
      }
      return newMonth
    })
  }

  const renderCalendar = () => {
    const days = getDaysInMonth(currentMonth)
    const weekDays = ['أح', 'إث', 'ث', 'أر', 'خ', 'ج', 'س']
    
    return (
      <div className={`${isMobile ? 'p-4' : 'p-6'}`}>
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => navigateMonth('prev')}
            className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all duration-200"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          
          <h3 className="text-lg font-bold text-gray-900">
            {currentMonth.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
          </h3>
          
          <button
            type="button"
            onClick={() => navigateMonth('next')}
            className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all duration-200"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
        
        {/* Week Days */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-semibold text-gray-500 p-2">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            if (!day) {
              return <div key={index} className="p-3" />
            }
            
            const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString()
            const isToday = day.toDateString() === new Date().toDateString()
            const disabled = isDateDisabled(day)
            
            return (
              <button
                key={index}
                type="button"
                onClick={() => !disabled && handleDateSelect(day)}
                disabled={disabled}
                className={`
                  ${isMobile ? 'p-3 text-base' : 'p-3 text-sm'} 
                  rounded-xl transition-all duration-200 font-medium relative
                  ${isSelected
                    ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg transform scale-105'
                    : isToday
                    ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                    : disabled
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-primary-50 hover:text-primary-600'
                  }
                `}
              >
                {day.getDate()}
                {isToday && !isSelected && (
                  <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary-500 rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const renderEnhancedTimePicker = () => {
    return (
      <div className={`${isMobile ? 'p-4' : 'p-6'} border-t border-gray-200`}>
        <div className="text-center mb-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">اختر الوقت</h4>
          
          {/* Time Display */}
          <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-2xl p-6 mb-6">
            <div className="text-4xl font-bold text-primary-700 mb-2">
              {selectedTime.hours.toString().padStart(2, '0')}:{selectedTime.minutes.toString().padStart(2, '0')}
            </div>
            <div className="text-sm text-primary-600">
              {selectedTime.hours < 12 ? 'صباحاً' : 'مساءً'}
            </div>
          </div>
        </div>
        
        {/* Enhanced Time Controls */}
        <div className="flex items-center justify-center space-x-8 space-x-reverse">
          {/* Hours Control */}
          <div className="text-center">
            <label className="block text-sm font-semibold text-gray-700 mb-3">الساعة</label>
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 shadow-sm">
              <button
                type="button"
                onClick={() => incrementTime('hours', 1)}
                className="w-full p-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-all duration-200 mb-2"
              >
                <ChevronUp className="h-5 w-5 mx-auto" />
              </button>
              
              <div className="text-2xl font-bold text-gray-800 py-2 px-4 bg-gray-50 rounded-xl min-w-[60px]">
                {selectedTime.hours.toString().padStart(2, '0')}
              </div>
              
              <button
                type="button"
                onClick={() => incrementTime('hours', -1)}
                className="w-full p-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-all duration-200 mt-2"
              >
                <ChevronDown className="h-5 w-5 mx-auto" />
              </button>
            </div>
          </div>
          
          {/* Separator */}
          <div className="text-3xl font-bold text-gray-400 mt-8">:</div>
          
          {/* Minutes Control */}
          <div className="text-center">
            <label className="block text-sm font-semibold text-gray-700 mb-3">الدقيقة</label>
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 shadow-sm">
              <button
                type="button"
                onClick={() => incrementTime('minutes', 5)}
                className="w-full p-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-all duration-200 mb-2"
              >
                <ChevronUp className="h-5 w-5 mx-auto" />
              </button>
              
              <div className="text-2xl font-bold text-gray-800 py-2 px-4 bg-gray-50 rounded-xl min-w-[60px]">
                {selectedTime.minutes.toString().padStart(2, '0')}
              </div>
              
              <button
                type="button"
                onClick={() => incrementTime('minutes', -5)}
                className="w-full p-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-all duration-200 mt-2"
              >
                <ChevronDown className="h-5 w-5 mx-auto" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Quick Time Presets */}
        <div className="mt-6">
          <div className="text-sm font-semibold text-gray-700 mb-3 text-center">أوقات سريعة</div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '9:00', hours: 9, minutes: 0 },
              { label: '12:00', hours: 12, minutes: 0 },
              { label: '15:00', hours: 15, minutes: 0 },
              { label: '18:00', hours: 18, minutes: 0 }
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleTimeChange(preset.hours, preset.minutes)}
                className={`
                  py-2 px-3 text-sm rounded-xl transition-all duration-200 font-medium
                  ${selectedTime.hours === preset.hours && selectedTime.minutes === preset.minutes
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-primary-100 hover:text-primary-700'
                  }
                `}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderMobileModal = () => (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-t-3xl shadow-2xl w-full max-h-[85vh] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-primary-100">
          <h3 className="text-xl font-bold text-gray-900">
            {type === 'date' ? 'اختر التاريخ' : type === 'time' ? 'اختر الوقت' : 'اختر التاريخ والوقت'}
          </h3>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-full transition-all duration-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto max-h-[65vh]">
          {(type === 'date' || type === 'datetime') && renderCalendar()}
          {(type === 'time' || type === 'datetime') && renderEnhancedTimePicker()}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold py-4 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
          >
            تأكيد
          </button>
        </div>
      </div>
    </div>
  )

  const renderDesktopDropdown = () => (
    <div className="absolute left-0 top-full z-50 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl min-w-[400px] overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-primary-100">
        <h4 className="font-semibold text-gray-900">
          {type === 'date' ? 'اختر التاريخ' : type === 'time' ? 'اختر الوقت' : 'اختر التاريخ والوقت'}
        </h4>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-white transition-all duration-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      {/* Content */}
      <div className="max-h-[500px] overflow-y-auto">
        {(type === 'date' || type === 'datetime') && renderCalendar()}
        {(type === 'time' || type === 'datetime') && renderEnhancedTimePicker()}
      </div>
      
      {/* Footer for datetime */}
      {type === 'datetime' && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold py-3 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            تأكيد
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      {label && (
        <label className={`flex items-center label text-gray-700 font-medium ${
          required ? 'label-required' : ''
        }`}>
          {type === 'time' ? (
            <Clock className="h-4 w-4 ml-2 text-primary-500" />
          ) : (
            <Calendar className="h-4 w-4 ml-2 text-primary-500" />
          )}
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={formatDisplayValue()}
          onClick={() => !disabled && setIsOpen(true)}
          onChange={() => {}} // Controlled by picker
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          readOnly
          className={`
            input transition-all duration-200 focus:ring-4 focus:ring-primary-100 
            focus:border-primary-500 hover:border-primary-300 pl-12 pr-12 cursor-pointer
            ${error ? 'border-red-500 focus:ring-red-100 focus:border-red-500' : ''}
            ${value ? 'border-green-500 bg-green-50' : ''}
            ${className}
          `}
        />
        
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          {type === 'time' ? (
            <Clock className={`h-5 w-5 ${value ? 'text-green-500' : 'text-gray-400'}`} />
          ) : (
            <Calendar className={`h-5 w-5 ${value ? 'text-green-500' : 'text-gray-400'}`} />
          )}
        </div>
        
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
              setSelectedDate(null)
              setSelectedTime({ hours: 12, minutes: 0 })
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
          <X className="h-4 w-4 ml-1" />
          {error}
        </p>
      )}
      
      {/* Render picker based on device */}
      {isOpen && (isMobile ? renderMobileModal() : renderDesktopDropdown())}
    </div>
  )
}

export default DateTimePicker