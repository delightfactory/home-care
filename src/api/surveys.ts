// Surveys API Layer – التعامل مع استبيانات العملاء
// --------------------------------------------------
import { supabase, handleSupabaseError, withSurveyTokenHeader } from '../lib/supabase'
import {
  CustomerSurvey,
  CustomerSurveyInsert,
  CustomerSurveyUpdate,
  ApiResponse,
  PaginatedResponse,
  SurveyWithOrder
} from '../types'

export class SurveysAPI {
  /**
   * إنشاء استبيان جديد لطلب معين (يُستخدم من لوحة التحكم)
   * @param surveyData بيانات الإدراج، يجب أن تتضمن order_id و survey_token على الأقل
   */
  static async createSurvey (
    surveyData: CustomerSurveyInsert
  ): Promise<ApiResponse<CustomerSurvey>> {
    try {
      const { data, error } = await supabase
        .from('customer_surveys')
        .insert(surveyData)
        .select()
        .single()

      if (error) throw error

      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }

  /**
   * جلب استبيان باستخدام التوكن (للعميل أو الزائر)
   */
  static async getSurveyByToken (
    token: string
  ): Promise<ApiResponse<CustomerSurvey | null>> {
    try {
      const { data, error } = await withSurveyTokenHeader(token, async () => {
        return await supabase
          .from('customer_surveys')
          .select('*')
          .eq('survey_token', token)
          .maybeSingle()
      })

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }

  /**
   * إرسال / تحديث الاستبيان من العميل (مرة واحدة فقط قبل submitted_at)
   * updateData يجب أن يحتوى على الحقول المسموح تحديثها فقط من RLS
   */
  static async submitSurvey (
    token: string,
    updateData: CustomerSurveyUpdate
  ): Promise<ApiResponse<CustomerSurvey>> {
    try {
      const { data, error } = await withSurveyTokenHeader(token, async () => {
        return await supabase
          .from('customer_surveys')
          .update({ ...updateData, submitted_at: new Date().toISOString() })
          .eq('survey_token', token)
          .is('submitted_at', null) // يضمن الإرسال مرة واحدة فقط
          .select()
          .single()
      })

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }

  /**
   * جلب الاستبيان المرتبط بأمر محدد
   */
  static async getSurveyByOrder (
    orderId: string
  ): Promise<ApiResponse<CustomerSurvey | null>> {
    try {
      const { data, error } = await supabase
        .from('customer_surveys')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle()

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }

  /**
   * جلب قائمة الاستبيانات مع التصفح والتصفية حسب الحالة (مكتمل/غير مكتمل)
   * الحالة: 'completed' تعني submitted_at ليس NULL، 'pending' تعني NULL
   */
  static async getSurveys (
    status: 'all' | 'completed' | 'pending' = 'all',
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<SurveyWithOrder>> {
    try {
      const offset = (page - 1) * limit

      let query = supabase
        .from('customer_surveys')
        .select(
          `
            *,
            order:orders(
              *,
              customer:customers(*)
            )
          `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (status === 'completed') {
        query = query.not('submitted_at', 'is', null)
      } else if (status === 'pending') {
        query = query.is('submitted_at', null)
      }

      const { data, error, count } = await query
      if (error) throw error

      return {
        data: (data || []) as unknown as SurveyWithOrder[],
        total: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit)
      }
    } catch (error) {
      throw handleSupabaseError(error)
    }
  }

  /**
   * تحديث الاستبيان (للمشرفين) — RLS يسمح بتحديث أعمدة محددة للمستخدمين المصادقين
   */
  static async updateSurvey (
    id: string,
    updates: CustomerSurveyUpdate
  ): Promise<ApiResponse<CustomerSurvey>> {
    try {
      const { data, error } = await supabase
        .from('customer_surveys')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
    }
  }
}
