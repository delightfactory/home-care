// Orders API Layer
import type { OrderCounts } from '../types'
import { supabase, handleSupabaseError, generateOrderNumber } from '../lib/supabase'
import { getToday } from '../api'
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
  // Get orders with filters and pagination - OPTIMIZED
  static async getOrders(
    filters?: OrderFilters,
    page = 1,
    limit = 20,
    includeDetails = false
  ): Promise<PaginatedResponse<OrderWithDetails>> {
    try {
      const offset = (page - 1) * limit;
      
      // Use optimized view for basic listing
      let query = supabase
        .from('v_orders_summary')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters using indexed columns
      if (filters?.status?.length) {
        query = query.in('status', filters.status);
      }

      if (filters?.payment_status?.length) {
        query = query.in('payment_status', filters.payment_status);
      }

      if (filters?.date_from) {
        query = query.gte('scheduled_date', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('scheduled_date', filters.date_to);
      }

      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }

      if (filters?.team_id) {
        query = query.eq('team_id', filters.team_id);
      }

      if (filters?.search) {
        query = query.or(`order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`);
      }

      const { data: orders, error, count } = await query;

      if (error) throw error;

      let confirmationMap: Record<string, string> = {};

      let ordersWithDetails: OrderWithDetails[] = [];

      // Ensure confirmation_status is loaded (view may not include it)
      if (orders?.length) {
        const orderIds = orders.map(o => o.id)
        // Fetch confirmation statuses from base orders table (lightweight)
        const { data: confirms } = await supabase
          .from('orders')
          .select('id, confirmation_status')
          .in('id', orderIds)

        if (confirms) {
          confirmationMap = confirms.reduce((acc: Record<string, string>, cur) => {
            acc[cur.id] = (cur as any).confirmation_status || 'pending'
            return acc
          }, {})
        }
      }

      // Build initial list with confirmation_status merged
      ordersWithDetails = (orders || []).map(order => ({
        ...order,
        // إنشاء كائن عميل مبسط ليحتوي المنطقة لاستخدامه في الواجهة
        customer: order.customer_id ? {
          id: order.customer_id,
          name: order.customer_name,
          phone: order.customer_phone,
          area: (order as any).customer_area || null
        } : null,
        confirmation_status: confirmationMap[order.id] || (order as any).confirmation_status || 'pending'
      }));

      // Load detailed data only when requested
      if (includeDetails && orders?.length) {
        const orderIds = orders.map(o => o.id);
        
        // Load order items separately for better performance
        const { data: items } = await supabase
          .from('order_items')
          .select(`
            *,
            service:services(id, name, name_ar, price, unit, estimated_duration)
          `)
          .in('order_id', orderIds);
        
        // Attach items to orders
        ordersWithDetails = orders.map(order => ({
          ...order,
          customer: order.customer_id ? {
            id: order.customer_id,
            name: order.customer_name,
            phone: order.customer_phone,
            area: (order as any).customer_area || null
          } : null,
          confirmation_status: confirmationMap[order.id] || (order as any).confirmation_status || 'pending',
          items: items?.filter(item => item.order_id === order.id) || []
        }));
      }

      // Apply confirmation_status filter if provided
      if (filters?.confirmation_status?.length) {
        ordersWithDetails = ordersWithDetails.filter(o => filters.confirmation_status!.includes(o.confirmation_status as any))
      }

      return {
        data: ordersWithDetails,
        total: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  // Get aggregated order counts by status (fast count queries)
  static async getCounts(): Promise<OrderCounts> {
    try {
      const { count: total, error: totalError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
      if (totalError) throw totalError

      const statuses = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const
      const counts: OrderCounts = {
        total: total || 0,
        pending: 0,
        scheduled: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0
      }

      for (const status of statuses) {
        const { count, error } = await supabase
          .from('orders')
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

  // Get single order by ID with full details - OPTIMIZED
  static async getOrderById(id: string): Promise<OrderWithDetails | undefined> {
    try {
      // First get basic order info from optimized view
      const { data: orderData, error: orderError } = await supabase
        .from('v_orders_summary')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!orderData) return undefined;

      // Load detailed data in parallel for better performance
      const [itemsResult, statusLogsResult, workersResult, teamDetailsResult, customerResult] = await Promise.all([
        // Load order items
        supabase
          .from('order_items')
          .select(`
            *,
            service:services(*)
          `)
          .eq('order_id', id),
        
        // Load status logs
        supabase
          .from('order_status_logs')
          .select(`
            *,
            created_by_user:users(full_name)
          `)
          .eq('order_id', id)
          .order('created_at', { ascending: false }),
        
        // Load order workers with worker details
        supabase
          .from('order_workers')
          .select(`
            *,
            worker:workers(*)
          `)
          .eq('order_id', id),
        // Load team details if team exists
        orderData.team_id ? supabase
          .from('teams')
          .select(`
            *,
            leader:workers!teams_leader_id_fkey(*),
            members:team_members(
              worker:workers(*)
            )
          `)
          .eq('id', orderData.team_id)
          .maybeSingle() : Promise.resolve({ data: null, error: null }),
        
        // Load customer details
        supabase
          .from('customers')
          .select('*')
          .eq('id', orderData.customer_id)
          .maybeSingle()
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (statusLogsResult.error) throw statusLogsResult.error;
      if (workersResult.error) throw workersResult.error;
      if (teamDetailsResult.error) throw teamDetailsResult.error;
      if (customerResult.error) throw customerResult.error;

      // Combine all data
      const orderWithDetails: OrderWithDetails = {
        ...orderData,
        customer: customerResult.data || null,
        items: itemsResult.data || [],
        status_logs: statusLogsResult.data || [],
        workers: workersResult.data || [],
        team: teamDetailsResult.data
          ? {
              ...teamDetailsResult.data,
              members: (teamDetailsResult.data.members || []).filter((m: any) => !m.left_at)
            }
          : null
      };

      return orderWithDetails;
    } catch (error) {
      throw handleSupabaseError(error);
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
      // Exclude fields that do not belong to the `orders` table schema (e.g. services list)
      const { services: _services, ...orderUpdates } = updates as Record<string, any>

      // Convert empty strings to null to satisfy DB constraints
      const sanitizedUpdates = Object.fromEntries(
        Object.entries(orderUpdates).map(([key, value]) => [key, value === '' ? null : value])
      ) as Record<string, any>

      const { data, error } = await supabase
        .from('orders')
        .update({ ...sanitizedUpdates, updated_at: new Date().toISOString() })
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

  // Update order confirmation status
  static async updateOrderConfirmationStatus(
    orderId: string,
    confirmationStatus: 'pending' | 'confirmed' | 'declined',
    notes?: string,
    userId?: string
  ): Promise<ApiResponse<void>> {
    try {
      const updates: any = {
        confirmation_status: confirmationStatus,
        confirmation_notes: notes || null,
        updated_at: new Date().toISOString()
      };
      if (confirmationStatus !== 'pending') {
        updates.confirmed_at = new Date().toISOString();
        updates.confirmed_by = userId || null;
      } else {
        updates.confirmed_at = null;
        updates.confirmed_by = null;
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);
      if (orderError) throw orderError;

      return { success: true, message: 'تم تحديث حالة التأكيد بنجاح' };
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) };
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

  // Replace all order items (delete then insert new list) and update total_amount
  static async replaceOrderItems(
    orderId: string,
    items: Omit<OrderItemInsert, 'order_id'>[]
  ): Promise<ApiResponse<void>> {
    try {
      // Begin transaction via a Postgres function – Supabase doesn't support multi-statement tx client-side, so run sequentially.
      // Delete existing items
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId)
      if (deleteError) throw deleteError

      // Insert new items with order_id
      const itemsWithOrder = items.map(item => ({ ...item, order_id: orderId }))
      const { error: insertError } = await supabase
        .from('order_items')
        .insert(itemsWithOrder)
      if (insertError) throw insertError

      // Recalculate total amount
      const totalAmount = items.reduce((sum, it) => sum + it.total_price, 0)
      const { error: updateError } = await supabase
        .from('orders')
        .update({ total_amount: totalAmount, updated_at: new Date().toISOString() })
        .eq('id', orderId)
      if (updateError) throw updateError

      return { success: true, message: 'تم تحديث عناصر الطلب بنجاح' }
    } catch (error) {
      return { success: false, error: handleSupabaseError(error) }
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
      const today = getToday()

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

  // Update order rating
  static async updateOrderRating(
    orderId: string,
    customerRating: number,
    customerFeedback: string,
    userId?: string
  ): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          customer_rating: customerRating,
          customer_feedback: customerFeedback,
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId)
        .eq('status', 'completed') // Only allow rating for completed orders

      if (error) throw error

      // Add status log for rating
      await supabase
        .from('order_status_logs')
        .insert({
          order_id: orderId,
          status: 'completed',
          notes: `تم إضافة تقييم العميل: ${customerRating}/5 نجوم`,
          created_by: userId
        })

      return {
        success: true,
        message: 'تم حفظ التقييم بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Delete order
  static async deleteOrder(orderId: string): Promise<ApiResponse<void>> {
    try {
      // First delete related order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId)

      if (itemsError) throw itemsError

      // Delete order status logs
      const { error: logsError } = await supabase
        .from('order_status_logs')
        .delete()
        .eq('order_id', orderId)

      if (logsError) throw logsError

      // Finally delete the order
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)

      if (orderError) throw orderError

      return {
        success: true,
        message: 'تم حذف الطلب بنجاح'
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
