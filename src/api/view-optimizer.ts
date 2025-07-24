/**
 * View Optimizer - محسن استخدام الفيوز في قاعدة البيانات
 * يوفر طرق اقتصادية لاستخلاص البيانات من الفيوز المتاحة
 */

import { supabase } from '../lib/supabase'
import type { ApiResponse } from '../types'

// Define types for view data
interface ViewData {
  [key: string]: any
}

interface ViewResponse {
  success: boolean
  data?: ViewData[] | ViewData | null
  error?: string
  warning?: string
  message?: string
  count?: number
  refreshed?: number
}

export class ViewOptimizer {
  /**
   * دالة عامة لجلب البيانات من أي فيو مع تحسينات
   */
  static async getOptimizedData(
    viewName: string,
    options: {
      select?: string
      filters?: Record<string, any>
      orderBy?: { column: string; ascending?: boolean }
      limit?: number
      offset?: number
    } = {}
  ): Promise<ViewResponse> {
    try {
      const {
        select = '*',
        filters = {},
        orderBy,
        limit,
        offset
      } = options

      let query = supabase.from(viewName).select(select)

      // تطبيق الفلاتر
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            query = query.in(key, value)
          } else if (typeof value === 'object' && value !== null && 'operator' in value && 'value' in value) {
            // دعم العمليات المتقدمة مثل gte, lte, like
            const operation = value as { operator: string; value: any }
            query = (query as any)[operation.operator](key, operation.value)
          } else {
            query = query.eq(key, value)
          }
        }
      })

      // ترتيب النتائج
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false })
      }

      // تحديد عدد النتائج
      if (limit) {
        if (offset) {
          query = query.range(offset, offset + limit - 1)
        } else {
          query = query.limit(limit)
        }
      }

      const { data, error } = await query

      if (error) throw error

      return {
        success: true,
        data: data || []
      }
    } catch (error) {
      console.error(`Error fetching from view ${viewName}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: []
      }
    }
  }

  /**
   * جلب الإحصائيات اليومية من v_daily_stats
   */
  static async getDailyStats(date?: string) {
    const filters = date ? { report_date: date } : {}
    return this.getOptimizedData('v_daily_stats', {
      filters,
      orderBy: { column: 'report_date', ascending: false },
      limit: date ? 1 : 30 // يوم واحد أو آخر 30 يوم
    })
  }

  /**
   * جلب ملخص الفرق من v_team_performance
   */
  static async getTeamPerformance(teamIds?: number[]) {
    const filters = teamIds ? { team_id: teamIds } : {}
    return this.getOptimizedData('v_team_performance', {
      filters,
      orderBy: { column: 'total_revenue', ascending: false }
    })
  }

  /**
   * جلب إحصائيات العمال من v_worker_stats
   */
  static async getWorkerStats(workerIds?: number[]) {
    const filters = workerIds ? { worker_id: workerIds } : {}
    return this.getOptimizedData('v_worker_stats', {
      filters,
      orderBy: { column: 'completed_orders', ascending: false }
    })
  }

  /**
   * جلب تاريخ العملاء من v_customer_history
   */
  static async getCustomerHistory(customerIds?: number[]) {
    const filters = customerIds ? { id: customerIds } : {}
    return this.getOptimizedData('v_customer_history', {
      filters,
      orderBy: { column: 'total_orders', ascending: false }
    })
  }

  /**
   * جلب الإحصائيات الأسبوعية من mv_weekly_stats
   */
  static async getWeeklyStats(weeksCount = 12) {
    return this.getOptimizedData('mv_weekly_stats', {
      orderBy: { column: 'week_start', ascending: false },
      limit: weeksCount
    })
  }

  /**
   * جلب الإحصائيات الربعية من mv_quarterly_stats
   */
  static async getQuarterlyStats(quartersCount = 4) {
    return this.getOptimizedData('mv_quarterly_stats', {
      orderBy: { column: 'quarter_start', ascending: false },
      limit: quartersCount
    })
  }

  /**
   * جلب الإحصائيات الشهرية من mv_monthly_stats (إذا كانت متوفرة)
   */
  static async getMonthlyStats(monthsCount = 12) {
    return this.getOptimizedData('mv_monthly_stats', {
      orderBy: { column: 'month_date', ascending: false },
      limit: monthsCount
    })
  }

  /**
   * جلب أفضل العملاء من mv_top_customers (إذا كانت متوفرة)
   */
  static async getTopCustomers(limit = 50) {
    return this.getOptimizedData('mv_top_customers', {
      orderBy: { column: 'total_spent', ascending: false },
      limit
    })
  }

  /**
   * جلب البيانات المجمعة للوحة التحكم
   */
  static async getDashboardData(date?: string) {
    try {
      const [dailyStats, teamPerformance] = await Promise.all([
        this.getDailyStats(date),
        this.getTeamPerformance()
      ])

      return {
        success: true,
        data: {
          daily: Array.isArray(dailyStats.data) ? dailyStats.data[0] || null : dailyStats.data,
          teams: Array.isArray(teamPerformance.data) ? teamPerformance.data : []
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: { daily: null, teams: [] }
      }
    }
  }

  /**
   * جلب البيانات التحليلية المتقدمة
   */
  static async getAdvancedAnalytics() {
    try {
      const [weeklyStats, quarterlyStats, monthlyStats, topCustomers] = await Promise.allSettled([
        this.getWeeklyStats(),
        this.getQuarterlyStats(),
        this.getMonthlyStats(),
        this.getTopCustomers()
      ])

      return {
        success: true,
        data: {
          weekly: weeklyStats.status === 'fulfilled' ? weeklyStats.value.data : [],
          quarterly: quarterlyStats.status === 'fulfilled' ? quarterlyStats.value.data : [],
          monthly: monthlyStats.status === 'fulfilled' ? monthlyStats.value.data : [],
          topCustomers: topCustomers.status === 'fulfilled' ? topCustomers.value.data : []
        }
      }
    } catch (error) {
      console.error('Error fetching advanced analytics:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: { weekly: [], quarterly: [], monthly: [], topCustomers: [] }
      }
    }
  }

  /**
   * تحديث جميع الفيوز المادية بشكل آمن
   */
  static async refreshAllViews(): Promise<ViewResponse> {
    try {
      // محاولة التحديث باستخدام الدالة الآمنة أولاً
      const { data, error } = await supabase.rpc('refresh_all_materialized_views_safe')
      
      if (error) {
        console.warn('Safe refresh failed, trying individual refresh:', error)
        
        // البديل: تحديث الفيوز بشكل فردي
        const refreshPromises = [
          supabase.rpc('refresh_weekly_stats'),
          supabase.rpc('refresh_quarterly_stats'),
          supabase.rpc('refresh_monthly_stats'),
          supabase.rpc('refresh_top_customers')
        ]
        
        const results = await Promise.allSettled(refreshPromises)
        const failures = results.filter(r => r.status === 'rejected')
        
        if (failures.length > 0) {
          console.warn('Some view refreshes failed:', failures)
          return {
            success: true,
            warning: `${failures.length} views failed to refresh`,
            refreshed: results.length - failures.length
          }
        }
      }
      
      return {
        success: true,
        message: 'All materialized views refreshed successfully',
        data
      }
    } catch (error) {
      console.error('Error refreshing materialized views:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * التحقق من توفر فيو معين
   */
  static async checkViewExists(viewName: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(viewName)
        .select('*')
        .limit(1)

      return !error
    } catch {
      return false
    }
  }

  /**
   * جلب قائمة الفيوز المتاحة
   */
  static async getAvailableViews(): Promise<string[]> {
    const commonViews = [
      'v_daily_stats',
      'v_team_performance', 
      'v_worker_stats',
      'v_customer_history',
      'mv_weekly_stats',
      'mv_quarterly_stats',
      'mv_monthly_stats',
      'mv_top_customers'
    ]

    const availableViews: string[] = []

    for (const viewName of commonViews) {
      if (await this.checkViewExists(viewName)) {
        availableViews.push(viewName)
      }
    }

    return availableViews
  }

  /**
   * تحسين استعلام مخصص للفيوز
   */
  static async executeOptimizedQuery<T = any>(
    viewName: string,
    customQuery: (query: any) => any
  ): Promise<ApiResponse<T[]>> {
    try {
      const baseQuery = supabase.from(viewName)
      const optimizedQuery = customQuery(baseQuery)
      const { data, error } = await optimizedQuery

      if (error) throw error

      return {
        success: true,
        data: data || []
      }
    } catch (error) {
      console.error(`Error executing optimized query on ${viewName}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: []
      }
    }
  }

  /**
   * جلب الإحصائيات اليومية ضمن نطاق تاريخي
   */
  static async getDailyStatsInRange(startDate: string, endDate: string): Promise<ViewResponse> {
    try {
      const { data, error } = await supabase
        .from('v_daily_dashboard')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
      
      if (error) throw error
      
      return {
        success: true,
        data: data || [],
        count: data?.length || 0
      }
    } catch (error) {
      console.error('Error getting daily stats in range:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: []
      }
    }
  }
}

export default ViewOptimizer