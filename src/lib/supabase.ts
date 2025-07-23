// Supabase Client Configuration
import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/database.types'

// Get environment variables directly from import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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

// Helper function to generate order number
export const generateOrderNumber = async (): Promise<string> => {
  const { data: settings } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'order_number_prefix')
    .single()
  
  const prefix = settings?.value || 'ORD'
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')
  
  return `${prefix}${timestamp}${random}`
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
