import React, { useState, useRef, useEffect } from 'react'
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react'

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
  const [selectedTime, setSelectedTime] = useState({ hours: '12', minutes: '00' })
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
          setSelectedTime({ hours: timeMatch[1], minutes: timeMatch[2] })
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

  const formatDisplayValue = () => {
    if (!value) return ''
    
    if (type === 'date') {
      return new Date(value).toLocaleDateString('ar-EG')
    }
    if (type === 'time') {
      return value
    }
    if (type === 'datetime') {
      const date = new Date(value)
      return `${date.toLocaleDateString('ar-EG')} ${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
    }
    return value
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    
    if (type === 'date') {
      onChange(date.toISOString().split('T')[0])
      setIsOpen(false)
    } else if (type === 'datetime') {
      const datetime = new Date(date)
      datetime.setHours(parseInt(selectedTime.hours), parseInt(selectedTime.minutes))
      onChange(datetime.toISOString())
    }
  }

  const handleTimeChange = (hours: string, minutes: string) => {
    setSelectedTime({ hours, minutes })
    
    if (type === 'time') {
      onChange(`${hours}:${minutes}`)
      setIsOpen(false)
    } else if (type === 'datetime' && selectedDate) {
      const datetime = new Date(selectedDate)
      datetime.setHours(parseInt(hours), parseInt(minutes))
      onChange(datetime.toISOString())
    }
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
    if (minDate && date < new Date(minDate)) return true
    if (maxDate && date > new Date(maxDate)) return true
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
      <div className="p-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="font-medium text-gray-900">
            {currentMonth.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            type="button"
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        
        {/* Week Days */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 p-2">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            if (!day) {
              return <div key={index} className="p-2" />
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
                className={`p-2 text-sm rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-primary-500 text-white'
                    : isToday
                    ? 'bg-primary-100 text-primary-700'
                    : disabled
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const renderTimePicker = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).filter((_, i) => i % 5 === 0)
    
    return (
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-center space-x-4 space-x-reverse">
          <div className="text-center">
            <label className="block text-xs font-medium text-gray-700 mb-2">الساعة</label>
            <select
              value={selectedTime.hours}
              onChange={(e) => handleTimeChange(e.target.value, selectedTime.minutes)}
              className="w-16 p-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {hours.map(hour => (
                <option key={hour} value={hour}>{hour}</option>
              ))}
            </select>
          </div>
          <div className="text-2xl font-bold text-gray-400 mt-6">:</div>
          <div className="text-center">
            <label className="block text-xs font-medium text-gray-700 mb-2">الدقيقة</label>
            <select
              value={selectedTime.minutes}
              onChange={(e) => handleTimeChange(selectedTime.hours, e.target.value)}
              className="w-16 p-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {minutes.map(minute => (
                <option key={minute} value={minute}>{minute}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2" ref={containerRef}>
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
          className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 cursor-pointer ${
            error ? 'border-red-500 focus:ring-red-500' : ''
          } ${className}`}
        />
        
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          {type === 'time' ? (
            <Clock className="h-4 w-4 text-gray-400" />
          ) : (
            <Calendar className="h-4 w-4 text-gray-400" />
          )}
        </div>
        
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
              setSelectedDate(null)
              setSelectedTime({ hours: '12', minutes: '00' })
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
          <X className="h-3 w-3 ml-1" />
          {error}
        </p>
      )}
      
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[300px]">
          <div className="flex items-center justify-between p-3 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">
              {type === 'date' ? 'اختر التاريخ' : type === 'time' ? 'اختر الوقت' : 'اختر التاريخ والوقت'}
            </h4>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {(type === 'date' || type === 'datetime') && renderCalendar()}
          {(type === 'time' || type === 'datetime') && renderTimePicker()}
          
          {type === 'datetime' && (
            <div className="p-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full btn-primary"
              >
                تأكيد
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DateTimePicker