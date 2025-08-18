// API Layer Index - Home Cleaning Service Management System
// Export all API classes and functions

export { CustomersAPI } from './customers'
export { ServicesAPI } from './services'
export { OrdersAPI } from './orders'
export { WorkersAPI, TeamsAPI } from './workers'
export { ExpensesAPI } from './expenses'
export { ReportsAPI } from './reports'
export { RoutesAPI } from './routes'
export { SettingsAPI } from './settings'
export { SurveysAPI } from './surveys'

// Re-export Supabase client and utilities
export { supabase, handleSupabaseError, generateOrderNumber, calculateTransportCost } from '../lib/supabase'

// API Response wrapper for consistent error handling
export const apiCall = async <T>(
  apiFunction: () => Promise<T>
): Promise<{ data?: T; error?: string; success: boolean }> => {
  try {
    const data = await apiFunction()
    return { data, success: true }
  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
      success: false 
    }
  }
}

// Common API utilities
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}

export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString()
}

export const formatCurrency = (amount: number): string => {
  // تنسيق الأرقام مع فاصلة الآلاف فقط
  return new Intl.NumberFormat('ar-EG').format(amount)
}

export const formatTime = (time: string): string => {
  return new Date(`2000-01-01T${time}`).toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

// Validation utilities
export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^(\+966|966|0)?[5][0-9]{8}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validateRequired = (value: any): boolean => {
  return value !== null && value !== undefined && value !== ''
}

// File upload utilities
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const maxSize = 2 * 1024 * 1024 // 2MB

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPG أو PNG أو WebP' }
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'حجم الملف كبير جداً. الحد الأقصى 2 ميجابايت' }
  }

  return { valid: true }
}

// Date utilities
export const toLocalDateISO = (date: Date): string => {
  const tzOffset = date.getTimezoneOffset() * 60000; // compensate local timezone
  return new Date(date.getTime() - tzOffset).toISOString().split('T')[0];
};

export const getToday = (): string => {
  return toLocalDateISO(new Date())
}

export const getTomorrow = (): string => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return toLocalDateISO(tomorrow)
}

export const getStartOfMonth = (): string => {
  const date = new Date()
  return toLocalDateISO(new Date(date.getFullYear(), date.getMonth(), 1))
}

export const getEndOfMonth = (): string => {
  const date = new Date()
  return toLocalDateISO(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export const getDateRange = (days: number): { start: string; end: string } => {
  const end = new Date()
  const start = new Date(end.getTime() - (days * 24 * 60 * 60 * 1000))
  
  return {
    start: toLocalDateISO(start),
    end: toLocalDateISO(end)
  }
}

// Status utilities
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'yellow',
    scheduled: 'blue',
    in_progress: 'purple',
    completed: 'green',
    cancelled: 'red',
    approved: 'green',
    rejected: 'red',
    active: 'green',
    inactive: 'gray',
    vacation: 'orange'
  }
  
  return colors[status] || 'gray'
}

export const getStatusText = (status: string): string => {
  const texts: Record<string, string> = {
    pending: 'معلق',
    scheduled: 'مجدول',
    in_progress: 'قيد التنفيذ',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    approved: 'موافق عليه',
    rejected: 'مرفوض',
    active: 'نشط',
    inactive: 'غير نشط',
    vacation: 'إجازة',
    paid_cash: 'مدفوع نقداً',
    paid_card: 'مدفوع بالبطاقة',
    unpaid: 'غير مدفوع'
  }
  
  return texts[status] || status
}

// Export all types
export * from '../types'
