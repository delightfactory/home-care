// Bonuses API – التعامل مع دالة الحوافز المحسوبة فى Supabase
// -------------------------------------------------------------
import { supabase, handleSupabaseError } from '../lib/supabase'

export interface WorkerBonus {
  worker_id: string
  month: string
  days_worked: number
  monthly_contribution: number
  monthly_min: number
  net_above_min: number
  base_bonus: number
  avg_rating: number | null
  rating_factor: number
  final_bonus: number
  unrated_orders: number
  // يمكن إضافة حقول أخرى لاحقًا
}

export class BonusesAPI {
  /**
   * جلب حوافز العمال لشهر معين
   * @param month تاريخ اليوم الأول فى الشهر المطلوب بصيغة YYYY-MM-DD
   * @param minDaily الحد الأدنى اليومى (اختيارى)
   * @param commission نسبة العمولة (اختيارى)
   */
  static async getWorkerBonuses (
    month: string, // يجب أن يكون اليوم الأول فى الشهر
    minDaily?: number,
    commission?: number
  ): Promise<WorkerBonus[]> {
    try {
      const params: Record<string, any> = { p_month: month }
      if (minDaily !== undefined) params.p_min_daily = minDaily
      if (commission !== undefined) params.p_commission = commission

      const { data, error } = await supabase.rpc('calculate_worker_bonuses', params)
      if (error) throw error
      return data as WorkerBonus[]
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }
}
