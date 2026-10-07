import { LifecycleAPI, RouteSnapshot, DesiredLink } from './lifecycle'
// Routes API Layer
import { supabase, handleSupabaseError } from '../lib/supabase'
import { 
  Route, 
  RouteInsert, 
  RouteUpdate,
  RouteWithOrders,
  RouteOrder,
OrderWithDetails,
  PaginatedResponse,
  ApiResponse,
  RouteStatus,
  RouteCounts 
} from '../types'

export class RoutesAPI {
  // Aggregate counts by status
  static async getCounts(): Promise<RouteCounts> {
    try {
      const { count: total, error: totalError } = await supabase
        .from('routes')
        .select('*', { count: 'exact', head: true })
      if (totalError) throw totalError

      const statuses = ['planned', 'in_progress', 'completed'] as const
      const counts: RouteCounts = {
        total: total || 0,
        planned: 0,
        in_progress: 0,
        completed: 0
      }

      for (const status of statuses) {
        const { count, error } = await supabase
          .from('routes')
          .select('*', { count: 'exact', head: true })
          .eq('status', status)
        if (error) throw error
        counts[status] = count || 0
      }
      return counts
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get routes with filters and pagination
  static async getRoutes(
    filters?: {
      date?: string
      team_id?: string
      status?: RouteStatus[]
    },
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<RouteWithOrders>> {
    try {
      let query = supabase
        .from('routes')
        .select(`
          *,
          team:teams(
            *,
            leader:workers!teams_leader_id_fkey(*),
            members:team_members(
              *,
              worker:workers(*)
            )
          ),
          route_orders(
            *,
            order:orders(
              *,
              customer:customers(*),
              items:order_items(
                *,
                service:services(*)
              )
            )
          )
        `, { count: 'exact' })
        .order('date', { ascending: false })
        .order('start_time', { ascending: true })

      // Apply filters
      if (filters?.date) {
        query = query.eq('date', filters.date)
      }

      if (filters?.team_id) {
        query = query.eq('team_id', filters.team_id)
      }

      if (filters?.status?.length) {
        query = query.in('status', filters.status)
      }

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error

      const sanitized = (data || []).map(route => {
        if (route.team && route.team.members) {
          route.team.members = route.team.members.filter((m: any) => !m.left_at);
        }
        return route;
      });
      return {
        data: sanitized,
        total: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit)
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get single route by ID
  static async getRoute(id: string): Promise<RouteWithOrders | null> {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select(`
          *,
          team:teams(
            *,
            leader:workers!teams_leader_id_fkey(*),
            members:team_members(
              *,
              worker:workers(*)
            )
          ),
          route_orders(
            *,
            order:orders(
              *,
              customer:customers(*),
              items:order_items(
                *,
                service:services(*)
              )
            )
          )
        `)
        .eq('id', id)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      if (data && data.team && data.team.members) {
        data.team.members = data.team.members.filter((m: any) => !m.left_at);
      }
      return data
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Create new route
  static async createRoute(routeData: RouteInsert): Promise<ApiResponse<Route>> {
    try {
      const { data, error } = await supabase
        .from('routes')
        .insert(routeData)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم إنشاء خط السير بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Lifecycle writes are one server transaction, with an original snapshot.
  static async updateRoute(id: string, routeData: RouteUpdate, expected?: RouteSnapshot): Promise<ApiResponse<Route>> {
    try {
      const result = await LifecycleAPI.execute({ op: 'route_update', route_id: id, data: routeData, expected }, async () => ({
        op: 'route_update', route_id: id, data: routeData, expected: expected ?? await LifecycleAPI.snapshot('route', id),
      }))
      return result.success ? { success: true, data: result.data?.route, message: 'تم تحديث خط السير بنجاح' } : { success: false, error: result.error }
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : handleSupabaseError(error) } }
  }

  static async deleteRoute(id: string): Promise<ApiResponse<void>> {
    try {
      const result = await LifecycleAPI.execute({ op: 'delete_route', route_id: id }, async () => ({
        op: 'delete_route', route_id: id, expected: await LifecycleAPI.snapshot('route', id),
      }))
      return { success: result.success, error: result.error, message: result.success ? 'تم حذف خط السير بنجاح' : undefined }
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : handleSupabaseError(error) } }
  }

  static async saveRouteOrders(expected: RouteSnapshot, desired: DesiredLink[]): Promise<ApiResponse<void>> {
    try {
      const result = await LifecycleAPI.save(expected, desired)
      return { success: result.success, error: result.error, message: result.success ? 'تم حفظ طلبات خط السير' : undefined }
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : handleSupabaseError(error) } }
  }

  static async addOrderToRoute(routeId: string, orderId: string, sequenceOrder?: number,
    estimatedArrivalTime?: string, estimatedCompletionTime?: string): Promise<ApiResponse<RouteOrder>> {
    try {
      const result = await LifecycleAPI.execute({ op: 'add', routeId, orderId, sequenceOrder, estimatedArrivalTime, estimatedCompletionTime }, async () => {
        const expected = await LifecycleAPI.snapshot('route', routeId)
        const desired: DesiredLink[] = expected.links.map(link => ({ order_id: link.order_id, sequence_order: link.sequence_order }))
        if (!desired.some(link => link.order_id === orderId)) desired.push({
          order_id: orderId, sequence_order: sequenceOrder ?? Math.max(0, ...desired.map(link => link.sequence_order)) + 1,
          expected: await LifecycleAPI.snapshot('order', orderId), estimated_arrival_time: estimatedArrivalTime,
          estimated_completion_time: estimatedCompletionTime,
        })
        return { op: 'save', route_id: routeId, expected, desired }
      })
      if (!result.success) return { success: false, error: result.error }
      const route = await this.getRoute(routeId)
      return { success: true, data: route?.route_orders?.find(link => link.order_id === orderId), message: 'تم إضافة الطلب إلى خط السير' }
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : handleSupabaseError(error) } }
  }

  static async removeOrderFromRoute(routeId: string, orderId: string): Promise<ApiResponse<void>> {
    try {
      const result = await LifecycleAPI.execute({ op: 'remove', routeId, orderId }, async () => {
        const expected = await LifecycleAPI.snapshot('route', routeId)
        return { op: 'save', route_id: routeId, expected, desired: expected.links.filter(link => link.order_id !== orderId)
          .map(link => ({ order_id: link.order_id, sequence_order: link.sequence_order })) }
      })
      return { success: result.success, error: result.error, message: result.success ? 'تم حفظ التعديل' : undefined }
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : handleSupabaseError(error) } }
  }

  static async reorderRouteOrders(routeId: string, orderSequences: { order_id: string; sequence_order: number }[]): Promise<ApiResponse<void>> {
    try {
      const result = await LifecycleAPI.execute({ op: 'reorder', routeId, orderSequences }, async () => {
        const expected = await LifecycleAPI.snapshot('route', routeId)
        if (orderSequences.length !== expected.links.length || orderSequences.some(link => !expected.links.some(current => current.order_id === link.order_id)))
          throw new Error('تغيرت قائمة الطلبات. حدّث البيانات قبل تغيير الترتيب')
        return { op: 'save', route_id: routeId, expected, desired: orderSequences }
      })
      return { success: result.success, error: result.error }
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : handleSupabaseError(error) } }
  }

  static async transferOrder(source: RouteSnapshot, destination: RouteSnapshot, orderId: string): Promise<ApiResponse<void>> {
    const link = source.links.find(item => item.order_id === orderId)
    if (!link) return { success: false, error: 'تغير ارتباط الطلب. حدّث البيانات' }
    const result = await LifecycleAPI.mutate({ op: 'transfer', route_id: source.id, destination_id: destination.id,
      order_id: orderId, link_id: link.id, expected: source, destination_expected: destination, order_expected: link.order })
    return { success: result.success, error: result.error }
  }

  // Start route
  static async startRoute(routeId: string): Promise<ApiResponse<Route>> {
    try {
      const { data, error } = await supabase
        .from('routes')
        .update({
          status: 'in_progress',
          actual_start_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', routeId)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم بدء خط السير بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Complete route
  static async completeRoute(routeId: string): Promise<ApiResponse<Route>> {
    try {
      const { data, error } = await supabase
        .from('routes')
        .update({
          status: 'completed',
          actual_end_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', routeId)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم إكمال خط السير بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Get available orders for route assignment
  static async getAvailableOrders(date?: string): Promise<OrderWithDetails[]> {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          team:teams(
            *,
            leader:workers!teams_leader_id_fkey(*)
          ),
          items:order_items(
            *,
            service:services(*)
          )
        `)
        .eq('status', 'pending')
        .order('scheduled_date')
        .order('scheduled_time')

      if (date) {
        query = query.eq('scheduled_date', date)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get routes for specific date
  static async getRoutesByDate(date: string): Promise<RouteWithOrders[]> {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select(`
          *,
          team:teams(
            *,
            leader:workers!teams_leader_id_fkey(*),
            members:team_members(
              *,
              worker:workers(*)
            )
          ),
          route_orders(
            *,
            order:orders(
              *,
              customer:customers(*),
              items:order_items(
                *,
                service:services(*)
              )
            )
          )
        `)
        .eq('date', date)
        .order('start_time')

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Calculate route statistics
  static async getRouteStatistics(routeId: string) {
    try {
      const route = await this.getRoute(routeId)
      if (!route) throw new Error('Route not found')

      const orders = route.route_orders || []
      const totalOrders = orders.length
      const completedOrders = orders.filter(ro => 
        ro.order?.status === 'completed'
      ).length

      const totalAmount = orders.reduce((sum, ro) => 
        sum + (ro.order?.total_amount || 0), 0
      )

      const averageRating = orders
        .filter(ro => ro.order?.customer_rating)
        .reduce((sum, ro, _, arr) => 
          sum + (ro.order?.customer_rating || 0) / arr.length, 0
        ) || 0

      return {
        total_orders: totalOrders,
        completed_orders: completedOrders,
        completion_rate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
        total_amount: totalAmount,
        average_rating: averageRating,
        estimated_duration: route.total_estimated_time || 0,
        total_distance: route.total_distance || 0
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }
}
