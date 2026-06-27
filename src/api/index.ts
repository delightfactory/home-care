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
export { NotificationsAPI } from './notifications'

// Financial System
export { InvoicesAPI } from './invoices'
export { VaultsAPI } from './vaults'
export { CustodyAPI } from './custody'

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
  return new Intl.NumberFormat('en-US').format(amount)
}

// Financial utilities - shared across components
export const getPaymentMethodLabel = (method: string | null, withEmoji = false): string => {
  if (withEmoji) {
    switch (method) {
      case 'cash': return 'نقدي 💵'
      case 'instapay': return 'Instapay 📱'
      case 'bank_transfer': return 'تحويل بنكي 🏦'
      default: return '-'
    }
  }
  switch (method) {
    case 'cash': return 'نقدي'
    case 'instapay': return 'Instapay'
    case 'bank_transfer': return 'تحويل بنكي'
    default: return '-'
  }
}

export const getUserNameFromRelation = (relation: any): string => {
  if (Array.isArray(relation) && relation.length > 0) return relation[0].full_name || '-'
  if (relation && typeof relation === 'object' && 'full_name' in relation) return relation.full_name || '-'
  return '-'
}

export const formatTime = (time: string): string => {
  const d = new Date(`2000-01-01T${time}`)
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'م' : 'ص'
  const h12 = h % 12 || 12
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
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
export {
  toLocalDateISO,
  getToday,
  getTomorrow,
  getStartOfMonth,
  getEndOfMonth,
  getDateRange
} from '../utils/date'


// Status utilities
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    scheduled: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-600',
    vacation: 'bg-orange-100 text-orange-800',
    // Financial statuses
    draft: 'bg-gray-100 text-gray-600',
    partially_paid: 'bg-orange-100 text-orange-800',
    paid: 'bg-green-100 text-green-800',
    confirmed: 'bg-emerald-100 text-emerald-800',
    refunded: 'bg-purple-100 text-purple-800'
  }

  return colors[status] || 'bg-gray-100 text-gray-600'
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
    unpaid: 'غير مدفوع',
    // Financial statuses
    draft: 'مسودة',
    partially_paid: 'مدفوع جزئياً',
    paid: 'مدفوع',
    confirmed: 'مؤكد',
    refunded: 'مسترد'
  }

  return texts[status] || status
}

// Export all types
export * from '../types'
