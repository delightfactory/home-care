// Supabase Client Configuration
import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/database.types'

// Get environment variables directly from import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// -- Dynamic survey token header to comply with RLS policies for public access
let __surveyTokenHeader: string | null = null

export const setSurveyTokenHeader = (token?: string | null) => {
  __surveyTokenHeader = token || null
}

export async function withSurveyTokenHeader<T> (token: string, fn: () => Promise<T>): Promise<T> {
  const prev = __surveyTokenHeader
  __surveyTokenHeader = token
  try {
    return await fn()
  } finally {
    __surveyTokenHeader = prev
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    // Inject custom headers (survey-token) into every REST request when set
    fetch: (input: any, init?: any) => {
      const headers = new Headers(init?.headers || {})
      if (__surveyTokenHeader) {
        headers.set('survey-token', __surveyTokenHeader)
      }
      return fetch(input as any, { ...init, headers })
    }
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Helper function to handle Supabase errors
export const handleSupabaseError = (error: any) => {
  console.error('Supabase Error:', error)
  
  if (error?.code === 'PGRST116') {
    return 'لا توجد بيانات متطابقة مع البحث'
  }
  
  if (error?.code === '23505') {
    return 'البيانات موجودة بالفعل'
  }
  
  if (error?.code === '23503') {
    return 'لا يمكن حذف هذا العنصر لأنه مرتبط ببيانات أخرى'
  }
  
  if (error?.message?.includes('JWT')) {
    return 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى'
  }
  
  return error?.message || 'حدث خطأ غير متوقع'
}

// Helper function to generate sequential order number
export const generateOrderNumber = async (): Promise<string> => {
  // 1) الحصول على البادئة من الإعدادات
  const { data: settings } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'order_number_prefix')
    .single()
  const prefix = settings?.value || 'ORD'

  // 2) جلب أعلى رقم حالى يبدأ بالبادئة نفسها
  const { data: lastOrder } = await supabase
    .from('orders')
    .select('order_number')
    .ilike('order_number', `${prefix}%`)
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3) استخراج الجزء الرقمى وزيادته بمقدار واحد
  let nextNumber = 1
  if (lastOrder?.order_number) {
    const numericPart = parseInt(lastOrder.order_number.replace(prefix, ''))
    if (!isNaN(numericPart)) {
      nextNumber = numericPart + 1
    }
  }

  // 4) تنسيق الرقم ليكون بطول ثابت (6 أرقام مثلاً)
  const numericStr = nextNumber.toString().padStart(6, '0')
  return `${prefix}${numericStr}`
}

// Helper function to calculate transport cost
export const calculateTransportCost = async (
  method: string,
  distance: number
): Promise<number> => {
  const { data: settings } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'transport_rates')
    .single()
  
  const rates = settings?.value || {
    company_car: 0.5,
    taxi: 2.0,
    uber: 1.8,
    public_transport: 0.3
  }
  
  return (rates[method] || 1.5) * distance
}
