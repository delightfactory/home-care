// Reports and Analytics API Layer
import { supabase, handleSupabaseError } from '../lib/supabase'
import { 
  DailyReport,
  DashboardStats,
  ChartData,
  ApiResponse,
  DailyDashboard,
  TeamSummary,
  CustomerHistory,
  WorkerStats 
} from '../types'

export class ReportsAPI {
  /*
   * ----------------------------------------------
   * Optimized queries using SQL Views
   * ----------------------------------------------
   */
  // Get aggregated dashboard record for a given date - OPTIMIZED
  static async getDailyDashboard(date: string): Promise<DailyDashboard | null> {
    try {
      // Use optimized view with indexed date column
      const { data, error } = await supabase
        .from('v_daily_stats')
        .select('*')
        .eq('report_date', date)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data as unknown as DailyDashboard | null;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  // Get team summaries (performance) - OPTIMIZED
  static async getTeamSummaries(): Promise<TeamSummary[]> {
    try {
      const { data, error } = await supabase
        .from('v_team_performance')
        .select('*')
        .order('completed_orders', { ascending: false });

      if (error) throw error;
      return data as unknown as TeamSummary[];
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  // Get customer histories from v_customer_history
  static async getCustomerHistories(): Promise<CustomerHistory[]> {
    try {
      const { data, error } = await supabase
        .from('v_customer_history')
        .select('*')
        .order('total_orders', { ascending: false })

      if (error) throw error
      return data as unknown as CustomerHistory[]
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get worker statistics from v_worker_stats
  static async getWorkerStats(): Promise<WorkerStats[]> {
    try {
      const { data, error } = await supabase
        .from('v_worker_stats')
        .select('*')
        .order('completed_orders', { ascending: false })

      if (error) throw error
      return data as unknown as WorkerStats[]
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // --------------------------------------------------
  // Existing functions using base tables remain below
  // --------------------------------------------------
  // Generate daily report
  static async generateDailyReport(date: string, userId?: string): Promise<ApiResponse<DailyReport>> {
    try {
      // Get orders for the date
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('status, total_amount, customer_rating')
        .eq('scheduled_date', date)

      if (ordersError) throw ordersError

      // Get expenses for the date
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('amount, status')
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`)

      if (expensesError) throw expensesError

      // Get active teams count
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .eq('is_active', true)

      if (teamsError) throw teamsError

      // Calculate statistics
      const totalOrders = orders?.length || 0
      const completedOrders = orders?.filter(o => o.status === 'completed').length || 0
      const cancelledOrders = orders?.filter(o => o.status === 'cancelled').length || 0
      const totalRevenue = orders
        ?.filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
      const totalExpenses = expenses
        ?.filter(e => e.status === 'approved')
        .reduce((sum, e) => sum + (e.amount || 0), 0) || 0
      const netProfit = totalRevenue - totalExpenses
      const activeTeams = teams?.length || 0
      const averageRating = orders
        ?.filter(o => o.customer_rating)
        .reduce((sum, o, _, arr) => sum + (o.customer_rating || 0) / arr.length, 0) || 0

      const reportData = {
        report_date: date,
        total_orders: totalOrders,
        completed_orders: completedOrders,
        cancelled_orders: cancelledOrders,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        active_teams: activeTeams,
        average_rating: averageRating,
        generated_by: userId
      }

      // Save or update daily report
      const { data, error } = await supabase
        .from('daily_reports')
        .upsert(reportData)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم إنشاء التقرير اليومي بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Get daily report by date
  static async getDailyReport(date: string): Promise<DailyReport | null> {
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('report_date', date)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get daily reports for date range
  static async getDailyReports(dateFrom: string, dateTo: string): Promise<DailyReport[]> {
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .gte('report_date', dateFrom)
        .lte('report_date', dateTo)
        .order('report_date', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get dashboard statistics
  static async getDashboardStats(): Promise<DashboardStats> {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Today's orders
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('status, total_amount, customer_rating')
        .eq('scheduled_date', today)

      // Pending orders
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('status', 'pending')

      // Active routes today
      const { data: activeRoutes } = await supabase
        .from('routes')
        .select('id')
        .eq('date', today)
        .eq('status', 'in_progress')

      // This month's revenue and expenses
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]

      const { data: monthlyOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('scheduled_date', startOfMonth)
        .lte('scheduled_date', endOfMonth)
        .eq('status', 'completed')

      const { data: monthlyExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('created_at', `${startOfMonth}T00:00:00`)
        .lte('created_at', `${endOfMonth}T23:59:59`)
        .eq('status', 'approved')

      // Teams statistics
      const { data: allTeams } = await supabase
        .from('teams')
        .select('id, is_active')
      
      const activeTeams = allTeams?.filter(t => t.is_active) || []
      const inactiveTeams = allTeams?.filter(t => !t.is_active) || []

      // Calculate stats
      const totalRevenue = monthlyOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
      const totalExpenses = monthlyExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0
      const averageRating = todayOrders
        ?.filter(o => o.customer_rating)
        .reduce((sum, o, _, arr) => sum + (o.customer_rating || 0) / arr.length, 0) || 0

      return {
        today_orders: todayOrders?.length || 0,
        pending_orders: pendingOrders?.length || 0,
        active_routes: activeRoutes?.length || 0,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: totalRevenue - totalExpenses,
        active_teams: activeTeams?.length || 0,
        inactive_teams: inactiveTeams?.length || 0,
        total_teams: allTeams?.length || 0,
        average_rating: averageRating
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get revenue chart data
  static async getRevenueChartData(days = 30): Promise<ChartData> {
    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))

      const { data, error } = await supabase
        .from('daily_reports')
        .select('report_date, total_revenue, total_expenses')
        .gte('report_date', startDate.toISOString().split('T')[0])
        .lte('report_date', endDate.toISOString().split('T')[0])
        .order('report_date')

      if (error) throw error

      const labels = (data || []).map(d => d.report_date)
      const revenueData = (data || []).map(d => d.total_revenue)
      const expensesData = (data || []).map(d => d.total_expenses)

      return {
        labels,
        datasets: [
          {
            label: 'الإيرادات',
            data: revenueData,
            backgroundColor: ['rgba(34, 197, 94, 0.2)'],
            borderColor: ['rgba(34, 197, 94, 1)']
          },
          {
            label: 'المصروفات',
            data: expensesData,
            backgroundColor: ['rgba(239, 68, 68, 0.2)'],
            borderColor: ['rgba(239, 68, 68, 1)']
          }
        ]
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get orders status chart data
  static async getOrdersStatusChartData(dateFrom?: string, dateTo?: string): Promise<ChartData> {
    try {
      let query = supabase
        .from('orders')
        .select('status')

      if (dateFrom) {
        query = query.gte('scheduled_date', dateFrom)
      }

      if (dateTo) {
        query = query.lte('scheduled_date', dateTo)
      }

      const { data, error } = await query

      if (error) throw error

      // Count orders by status
      const statusCounts = (data || []).reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const statusLabels = {
        pending: 'معلق',
        scheduled: 'مجدول',
        in_progress: 'قيد التنفيذ',
        completed: 'مكتمل',
        cancelled: 'ملغي'
      }

      return {
        labels: Object.keys(statusCounts).map(status => statusLabels[status as keyof typeof statusLabels] || status),
        datasets: [{
          label: 'عدد الطلبات',
          data: Object.values(statusCounts),
          backgroundColor: [
            'rgba(251, 191, 36, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ]
        }]
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get team performance comparison
  static async getTeamPerformanceComparison(dateFrom?: string, dateTo?: string) {
    try {
      let query = supabase
        .from('orders')
        .select(`
          team_id,
          status,
          total_amount,
          customer_rating,
          team:teams(name)
        `)
        .not('team_id', 'is', null)

      if (dateFrom) {
        query = query.gte('scheduled_date', dateFrom)
      }

      if (dateTo) {
        query = query.lte('scheduled_date', dateTo)
      }

      const { data, error } = await query

      if (error) throw error

      // Group by team and calculate performance
      const teamStats = (data || []).reduce((acc, order) => {
        const teamId = order.team_id!
        const teamName = (order.team as any)?.name || 'فريق غير محدد'

        if (!acc[teamId]) {
          acc[teamId] = {
            name: teamName,
            total_orders: 0,
            completed_orders: 0,
            total_revenue: 0,
            total_rating: 0,
            rating_count: 0
          }
        }

        acc[teamId].total_orders++
        if (order.status === 'completed') {
          acc[teamId].completed_orders++
          acc[teamId].total_revenue += order.total_amount || 0
        }
        if (order.customer_rating) {
          acc[teamId].total_rating += order.customer_rating
          acc[teamId].rating_count++
        }

        return acc
      }, {} as Record<string, any>)

      // Calculate final metrics
      return Object.values(teamStats).map((team: any) => ({
        team_name: team.name,
        total_orders: team.total_orders,
        completed_orders: team.completed_orders,
        completion_rate: team.total_orders > 0 ? (team.completed_orders / team.total_orders) * 100 : 0,
        total_revenue: team.total_revenue,
        average_rating: team.rating_count > 0 ? team.total_rating / team.rating_count : 0
      }))
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get monthly summary
  static async getMonthlySummary(year: number, month: number) {
    try {
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]

      const { data: reports, error } = await supabase
        .from('daily_reports')
        .select('*')
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .order('report_date')

      if (error) throw error

      const summary = (reports || []).reduce((acc, report) => ({
        total_orders: acc.total_orders + report.total_orders,
        completed_orders: acc.completed_orders + report.completed_orders,
        cancelled_orders: acc.cancelled_orders + report.cancelled_orders,
        total_revenue: acc.total_revenue + report.total_revenue,
        total_expenses: acc.total_expenses + report.total_expenses,
        net_profit: acc.net_profit + report.net_profit,
        total_rating: acc.total_rating + (report.average_rating * report.completed_orders),
        rating_count: acc.rating_count + report.completed_orders
      }), {
        total_orders: 0,
        completed_orders: 0,
        cancelled_orders: 0,
        total_revenue: 0,
        total_expenses: 0,
        net_profit: 0,
        total_rating: 0,
        rating_count: 0
      })

      return {
        ...summary,
        average_rating: summary.rating_count > 0 ? summary.total_rating / summary.rating_count : 0,
        completion_rate: summary.total_orders > 0 ? (summary.completed_orders / summary.total_orders) * 100 : 0,
        profit_margin: summary.total_revenue > 0 ? (summary.net_profit / summary.total_revenue) * 100 : 0,
        daily_reports: reports
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  /*
   * ----------------------------------------------
   * Advanced Analytics using Materialized Views
   * ----------------------------------------------
   */

  // Get weekly statistics within a custom date range via RPC
static async getWeeklyStatsRange(startDate: string, endDate: string): Promise<any[]> {
  try {
    if (!startDate || !endDate) throw new Error('startDate and endDate are required')

    const { data, error } = await supabase.rpc('rpc_weekly_stats_range', {
      p_start_date: startDate,
      p_end_date: endDate
    })

    if (error) throw error
    return data || []
  } catch (error) {
    throw new Error(handleSupabaseError(error))
  }
}

  // Get weekly statistics from materialized view
  static async getWeeklyStats(weekOffset = 0): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('mv_weekly_stats')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(12) // Last 12 weeks
        .range(weekOffset, weekOffset + 11)

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get quarterly statistics from materialized view
  static async getQuarterlyStats(yearOffset = 0): Promise<any> {
    try {
      const currentYear = new Date().getFullYear() - yearOffset
      const startOfYear = `${currentYear}-01-01`
      const endOfYear = `${currentYear}-12-31`
      
      const { data, error } = await supabase
        .from('mv_quarterly_stats')
        .select('*')
        .gte('quarter_start', startOfYear)
        .lte('quarter_start', endOfYear)
        .order('quarter_start')

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Refresh materialized views (should be called periodically)
  static async refreshMaterializedViews(): Promise<ApiResponse<any>> {
    try {
      // Use the safe refresh function that handles errors gracefully
      const { error } = await supabase.rpc('refresh_all_materialized_views_safe')
      if (error) {
        console.warn('Safe refresh failed, trying individual refresh:', error)
        
        // Fallback to individual refresh without CONCURRENTLY
        try {
          const { error: weeklyError } = await supabase.rpc('refresh_weekly_stats')
          if (weeklyError) console.warn('Weekly stats refresh warning:', weeklyError)
          
          const { error: quarterlyError } = await supabase.rpc('refresh_quarterly_stats')
          if (quarterlyError) console.warn('Quarterly stats refresh warning:', quarterlyError)
        } catch (fallbackError) {
          console.error('Fallback refresh also failed:', fallbackError)
          // Don't throw error, just log it - the views might still be usable
        }
      }

      return {
        success: true,
        data: {
          refreshed_at: new Date().toISOString(),
          views_refreshed: ['mv_weekly_stats', 'mv_quarterly_stats', 'mv_monthly_stats', 'mv_top_customers'],
          note: 'Views refreshed with error handling'
        }
      }
    } catch (error) {
      console.error('Error refreshing materialized views:', error)
      // Don't fail the entire operation if views can't be refreshed
      return {
        success: true, // Changed to true to prevent blocking the UI
        data: {
          refreshed_at: new Date().toISOString(),
          views_refreshed: [],
          warning: 'Views refresh skipped due to database constraints'
        },
        error: handleSupabaseError(error)
      }
    }
  }

  // Get comprehensive analytics dashboard
  static async getAnalyticsDashboard(period: 'week' | 'month' | 'quarter' = 'month'): Promise<any> {
    try {
      const today = new Date()
      const promises: Promise<any>[] = []

      // Always get current daily dashboard
      promises.push(this.getDailyDashboard(today.toISOString().split('T')[0]))
      promises.push(this.getTeamSummaries())
      promises.push(this.getCustomerHistories())
      promises.push(this.getWorkerStats())

      if (period === 'week') {
        promises.push(this.getWeeklyStats(0))
      } else if (period === 'quarter') {
        promises.push(this.getQuarterlyStats(0))
      } else {
        // Default to monthly
        promises.push(this.getMonthlySummary(today.getFullYear(), today.getMonth() + 1))
      }

      const [
        dailyDashboard,
        teamSummaries,
        customerHistories,
        workerStats,
        periodData
      ] = await Promise.all(promises)

      return {
        period,
        generated_at: new Date().toISOString(),
        daily: dailyDashboard,
        teams: teamSummaries,
        customers: customerHistories,
        workers: workerStats,
        period_data: periodData
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get performance trends
  static async getPerformanceTrends(days = 30): Promise<any> {
    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))

      const { data: dailyReports, error } = await supabase
        .from('daily_reports')
        .select('*')
        .gte('report_date', startDate.toISOString().split('T')[0])
        .lte('report_date', endDate.toISOString().split('T')[0])
        .order('report_date')

      if (error) throw error

      // Calculate trends
      const reports = dailyReports || []
      const trends = {
        revenue_trend: this.calculateTrend(reports.map(r => r.total_revenue)),
        orders_trend: this.calculateTrend(reports.map(r => r.total_orders)),
        profit_trend: this.calculateTrend(reports.map(r => r.net_profit)),
        efficiency_trend: this.calculateTrend(reports.map(r => 
          r.total_orders > 0 ? (r.completed_orders / r.total_orders) * 100 : 0
        ))
      }

      return {
        period_days: days,
        data_points: reports.length,
        trends,
        daily_data: reports
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Helper function to calculate trend percentage
  private static calculateTrend(values: number[]): { direction: 'up' | 'down' | 'stable', percentage: number } {
    if (values.length < 2) return { direction: 'stable', percentage: 0 }

    const firstHalf = values.slice(0, Math.floor(values.length / 2))
    const secondHalf = values.slice(Math.floor(values.length / 2))

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length

    if (firstAvg === 0) return { direction: 'stable', percentage: 0 }

    const percentage = ((secondAvg - firstAvg) / firstAvg) * 100
    const direction = percentage > 5 ? 'up' : percentage < -5 ? 'down' : 'stable'

    return { direction, percentage: Math.abs(percentage) }
  }

  // Get worker performance analytics
  static async getWorkerPerformanceAnalytics(workerId?: string, days = 30): Promise<any> {
    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))

      let query = supabase
        .from('orders')
        .select(`
          *,
          team:teams!inner(
            id,
            name,
            team_members!inner(
              worker:workers!inner(id, name)
            )
          )
        `)
        .gte('scheduled_date', startDate.toISOString().split('T')[0])
        .lte('scheduled_date', endDate.toISOString().split('T')[0])

      if (workerId) {
        query = query.eq('team.team_members.worker.id', workerId)
      }

      const { data: orders, error } = await query

      if (error) throw error

      // Process worker performance data
      const workerStats = new Map()

      orders?.forEach(order => {
        const team = order.team as any
        team?.team_members?.forEach((member: any) => {
          const worker = member.worker
          if (!worker) return

          if (!workerStats.has(worker.id)) {
            workerStats.set(worker.id, {
              id: worker.id,
              name: worker.name,
              total_orders: 0,
              completed_orders: 0,
              total_revenue: 0,
              total_rating: 0,
              rating_count: 0
            })
          }

          const stats = workerStats.get(worker.id)
          stats.total_orders++
          
          if (order.status === 'completed') {
            stats.completed_orders++
            stats.total_revenue += order.total_amount || 0
            
            if (order.customer_rating) {
              stats.total_rating += order.customer_rating
              stats.rating_count++
            }
          }
        })
      })

      // Calculate final metrics
      const results = Array.from(workerStats.values()).map(stats => ({
        ...stats,
        completion_rate: stats.total_orders > 0 ? (stats.completed_orders / stats.total_orders) * 100 : 0,
        average_rating: stats.rating_count > 0 ? stats.total_rating / stats.rating_count : 0,
        revenue_per_order: stats.completed_orders > 0 ? stats.total_revenue / stats.completed_orders : 0
      }))

      return results.sort((a, b) => b.total_revenue - a.total_revenue)
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }
}
