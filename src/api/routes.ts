// Routes API Layer
import { supabase, handleSupabaseError } from '../lib/supabase'
import { 
  Route, 
  RouteInsert, 
  RouteUpdate,
  RouteWithOrders,
  RouteOrder,
  RouteOrderInsert,
  RouteOrderUpdate,
  OrderWithDetails,
  PaginatedResponse,
  ApiResponse,
  RouteStatus 
} from '../types'

export class RoutesAPI {
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

      return {
        data: data || [],
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

  // Update route
  static async updateRoute(id: string, routeData: RouteUpdate): Promise<ApiResponse<Route>> {
    try {
      const { data, error } = await supabase
        .from('routes')
        .update({
          ...routeData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم تحديث خط السير بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Delete route
  static async deleteRoute(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('routes')
        .delete()
        .eq('id', id)

      if (error) throw error

      return {
        success: true,
        message: 'تم حذف خط السير بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Add order to route
  static async addOrderToRoute(
    routeId: string, 
    orderId: string, 
    sequenceOrder: number,
    estimatedArrivalTime?: string,
    estimatedCompletionTime?: string
  ): Promise<ApiResponse<RouteOrder>> {
    try {
      const routeOrderData: RouteOrderInsert = {
        route_id: routeId,
        order_id: orderId,
        sequence_order: sequenceOrder,
        estimated_arrival_time: estimatedArrivalTime,
        estimated_completion_time: estimatedCompletionTime
      }

      const { data, error } = await supabase
        .from('route_orders')
        .insert(routeOrderData)
        .select()
        .single()

      if (error) throw error

      // Update order status to scheduled
      await supabase
        .from('orders')
        .update({ status: 'scheduled' })
        .eq('id', orderId)

      return {
        success: true,
        data,
        message: 'تم إضافة الطلب إلى خط السير بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Remove order from route
  static async removeOrderFromRoute(routeId: string, orderId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('route_orders')
        .delete()
        .eq('route_id', routeId)
        .eq('order_id', orderId)

      if (error) throw error

      // Update order status back to pending
      await supabase
        .from('orders')
        .update({ status: 'pending' })
        .eq('id', orderId)

      return {
        success: true,
        message: 'تم إزالة الطلب من خط السير بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Reorder orders in route
  static async reorderRouteOrders(
    routeId: string, 
    orderSequences: { order_id: string; sequence_order: number }[]
  ): Promise<ApiResponse<void>> {
    try {
      // Update sequence orders in batch
      const updates = orderSequences.map(({ order_id, sequence_order }) =>
        supabase
          .from('route_orders')
          .update({ sequence_order })
          .eq('route_id', routeId)
          .eq('order_id', order_id)
      )

      await Promise.all(updates)

      return {
        success: true,
        message: 'تم إعادة ترتيب الطلبات بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
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
