// Orders API Layer
import { supabase, handleSupabaseError, generateOrderNumber } from '../lib/supabase'
import { 
  Order, 
  OrderInsert, 
  OrderUpdate,
  OrderWithDetails,
  OrderItemInsert,
  OrderFilters,
  PaginatedResponse,
  ApiResponse,
  OrderStatus 
} from '../types'

export class OrdersAPI {
  // Get orders with filters and pagination
  static async getOrders(
    filters?: OrderFilters,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<OrderWithDetails>> {
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
        `, { count: 'exact' })
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters?.status?.length) {
        query = query.in('status', filters.status)
      }

      if (filters?.payment_status?.length) {
        query = query.in('payment_status', filters.payment_status)
      }

      if (filters?.date_from) {
        query = query.gte('scheduled_date', filters.date_from)
      }

      if (filters?.date_to) {
        query = query.lte('scheduled_date', filters.date_to)
      }

      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id)
      }

      if (filters?.team_id) {
        query = query.eq('team_id', filters.team_id)
      }

      if (filters?.search) {
        query = query.or(`order_number.ilike.%${filters.search}%`)
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

  // Get order by ID with full details
  static async getOrderById(id: string): Promise<OrderWithDetails> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          team:teams(
            *,
            leader:workers!teams_leader_id_fkey(*),
            members:team_members(
              worker:workers(*)
            )
          ),
          items:order_items(
            *,
            service:services(*)
          ),
          status_logs:order_status_logs(
            *,
            created_by_user:users(full_name)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) throw new Error('الطلب غير موجود')

      return data
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Create new order
  static async createOrder(
    orderData: Omit<OrderInsert, 'order_number'>,
    items: Omit<OrderItemInsert, 'order_id'>[]
  ): Promise<ApiResponse<OrderWithDetails>> {
    try {
      // Generate order number
      const orderNumber = await generateOrderNumber()

      // Calculate total amount
      const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0)

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          ...orderData,
          order_number: orderNumber,
          total_amount: totalAmount
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const orderItems = items.map(item => ({
        ...item,
        order_id: order.id
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      // Create initial status log
      await supabase
        .from('order_status_logs')
        .insert({
          order_id: order.id,
          status: 'pending',
          notes: 'تم إنشاء الطلب',
          created_by: orderData.created_by
        })

      // Get complete order data
      const completeOrder = await this.getOrderById(order.id)

      return {
        success: true,
        data: completeOrder,
        message: 'تم إنشاء الطلب بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Update order
  static async updateOrder(
    id: string,
    updates: OrderUpdate
  ): Promise<ApiResponse<Order>> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم تحديث الطلب بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Update order status
  static async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    notes?: string,
    userId?: string,
    images?: string[]
  ): Promise<ApiResponse<void>> {
    try {
      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          status, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId)

      if (orderError) throw orderError

      // Add status log
      const { error: logError } = await supabase
        .from('order_status_logs')
        .insert({
          order_id: orderId,
          status,
          notes,
          images: images || [],
          created_by: userId
        })

      if (logError) throw logError

      return {
        success: true,
        message: 'تم تحديث حالة الطلب بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Assign team to order
  static async assignTeamToOrder(
    orderId: string,
    teamId: string,
    userId?: string
  ): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          team_id: teamId,
          status: 'scheduled',
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId)

      if (error) throw error

      // Add status log
      await supabase
        .from('order_status_logs')
        .insert({
          order_id: orderId,
          status: 'scheduled',
          notes: 'تم تعيين فريق للطلب',
          created_by: userId
        })

      return {
        success: true,
        message: 'تم تعيين الفريق للطلب بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Get today's orders
  static async getTodayOrders(): Promise<OrderWithDetails[]> {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          team:teams(*),
          items:order_items(
            *,
            service:services(*)
          )
        `)
        .eq('scheduled_date', today)
        .order('scheduled_time')

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get pending orders
  static async getPendingOrders(): Promise<OrderWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          items:order_items(
            *,
            service:services(*)
          )
        `)
        .eq('status', 'pending')
        .order('created_at')

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Cancel order
  static async cancelOrder(
    orderId: string,
    reason: string,
    userId?: string
  ): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId)

      if (error) throw error

      // Add status log
      await supabase
        .from('order_status_logs')
        .insert({
          order_id: orderId,
          status: 'cancelled',
          notes: `تم إلغاء الطلب: ${reason}`,
          created_by: userId
        })

      return {
        success: true,
        message: 'تم إلغاء الطلب بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Complete order
  static async completeOrder(
    orderId: string,
    paymentStatus: string,
    paymentMethod?: string,
    customerRating?: number,
    customerFeedback?: string,
    userId?: string
  ): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'completed',
          payment_status: paymentStatus,
          payment_method: paymentMethod,
          customer_rating: customerRating,
          customer_feedback: customerFeedback,
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId)

      if (error) throw error

      // Add status log
      await supabase
        .from('order_status_logs')
        .insert({
          order_id: orderId,
          status: 'completed',
          notes: 'تم إنهاء الطلب بنجاح',
          created_by: userId
        })

      return {
        success: true,
        message: 'تم إنهاء الطلب بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Get order statistics
  static async getOrderStats(dateFrom?: string, dateTo?: string) {
    try {
      let query = supabase
        .from('orders')
        .select('status, total_amount, customer_rating')

      if (dateFrom) {
        query = query.gte('scheduled_date', dateFrom)
      }

      if (dateTo) {
        query = query.lte('scheduled_date', dateTo)
      }

      const { data, error } = await query

      if (error) throw error

      const orders = data || []
      const totalOrders = orders.length
      const completedOrders = orders.filter(o => o.status === 'completed').length
      const cancelledOrders = orders.filter(o => o.status === 'cancelled').length
      const pendingOrders = orders.filter(o => o.status === 'pending').length
      const totalRevenue = orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0)
      const averageRating = orders
        .filter(o => o.customer_rating)
        .reduce((sum, o, _, arr) => sum + (o.customer_rating || 0) / arr.length, 0)

      return {
        total_orders: totalOrders,
        completed_orders: completedOrders,
        cancelled_orders: cancelledOrders,
        pending_orders: pendingOrders,
        total_revenue: totalRevenue,
        average_rating: averageRating,
        completion_rate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }
}
