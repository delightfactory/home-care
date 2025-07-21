// Settings and System Configuration API Layer
import { supabase, handleSupabaseError } from '../lib/supabase'
import { 
  SystemSetting,
  AppSettings,
  ApiResponse 
} from '../types'

export class SettingsAPI {
  // Get all system settings
  static async getSystemSettings(): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')

      if (error) throw error

      // Convert array to object
      return (data || []).reduce((acc, setting) => {
        acc[setting.key] = setting.value
        return acc
      }, {} as Record<string, any>)
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get specific setting by key
  static async getSetting(key: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', key)
        .single()

      if (error) throw error
      return data?.value
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Update system setting
  static async updateSetting(
    key: string,
    value: any,
    description?: string,
    userId?: string
  ): Promise<ApiResponse<SystemSetting>> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .upsert({
          key,
          value,
          description,
          updated_by: userId,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم تحديث الإعداد بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Get app settings (formatted for frontend)
  static async getAppSettings(): Promise<AppSettings> {
    try {
      const settings = await this.getSystemSettings()

      return {
        transport_rates: settings.transport_rates || {
          company_car: 0.5,
          taxi: 2.0,
          uber: 1.8,
          public_transport: 0.3
        },
        working_hours: settings.working_hours || {
          start: '08:00',
          end: '18:00'
        },
        order_number_prefix: settings.order_number_prefix || 'ORD',
        company_info: settings.company_info || {
          name: 'شركة التنظيف المنزلي',
          phone: '',
          address: ''
        }
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Update transport rates
  static async updateTransportRates(
    rates: Record<string, number>,
    userId?: string
  ): Promise<ApiResponse<void>> {
    try {
      await this.updateSetting(
        'transport_rates',
        rates,
        'تكلفة المواصلات لكل كيلومتر',
        userId
      )

      return {
        success: true,
        message: 'تم تحديث أسعار المواصلات بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Update working hours
  static async updateWorkingHours(
    workingHours: { start: string; end: string },
    userId?: string
  ): Promise<ApiResponse<void>> {
    try {
      await this.updateSetting(
        'working_hours',
        workingHours,
        'ساعات العمل',
        userId
      )

      return {
        success: true,
        message: 'تم تحديث ساعات العمل بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Update company information
  static async updateCompanyInfo(
    companyInfo: { name: string; phone: string; address: string },
    userId?: string
  ): Promise<ApiResponse<void>> {
    try {
      await this.updateSetting(
        'company_info',
        companyInfo,
        'معلومات الشركة',
        userId
      )

      return {
        success: true,
        message: 'تم تحديث معلومات الشركة بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Update order number prefix
  static async updateOrderPrefix(
    prefix: string,
    userId?: string
  ): Promise<ApiResponse<void>> {
    try {
      await this.updateSetting(
        'order_number_prefix',
        prefix,
        'بادئة رقم الطلب',
        userId
      )

      return {
        success: true,
        message: 'تم تحديث بادئة رقم الطلب بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }
}
