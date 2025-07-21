// Customers API Layer
import { supabase, handleSupabaseError } from '../lib/supabase'
import { 
  Customer, 
  CustomerInsert, 
  CustomerUpdate, 
  CustomerWithOrders,
  CustomerFilters,
  PaginatedResponse,
  ApiResponse 
} from '../types'

export class CustomersAPI {
  // Get all customers with optional filters and pagination
  static async getCustomers(
    filters?: CustomerFilters,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<CustomerWithOrders>> {
    try {
      let query = supabase
        .from('customers')
        .select(`
          *,
          orders:orders(count)
        `, { count: 'exact' })

      // Apply filters
      if (filters?.area?.length) {
        query = query.in('area', filters.area)
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
      }

      if (filters?.is_active !== undefined) {
         query = query.eq('is_active', filters.is_active)
       }

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error

      // Transform data to include order counts
      const customers = data?.map(customer => ({
        ...customer,
        total_orders: customer.orders?.[0]?.count || 0
      })) || []

      return {
        data: customers,
        total: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit)
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get customer by ID with order history
  static async getCustomerById(id: string): Promise<CustomerWithOrders> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          orders:orders(
            *,
            team:teams(name),
            items:order_items(
              *,
              service:services(name, name_ar)
            )
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) throw new Error('العميل غير موجود')

      return {
        ...data,
        total_orders: data.orders?.length || 0,
        last_order_date: data.orders?.[0]?.created_at
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Create new customer
  static async createCustomer(customerData: CustomerInsert): Promise<ApiResponse<Customer>> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم إضافة العميل بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Update customer
  static async updateCustomer(
    id: string, 
    updates: CustomerUpdate
  ): Promise<ApiResponse<Customer>> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم تحديث بيانات العميل بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Soft delete customer (set is_active to false)
  static async deleteCustomer(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      return {
        success: true,
        message: 'تم حذف العميل بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Search customers by phone or name
  static async searchCustomers(query: string): Promise<Customer[]> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(10)

      if (error) throw error

      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get customer statistics
  static async getCustomerStats(customerId: string) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          status,
          customer_rating,
          created_at
        `)
        .eq('customer_id', customerId)

      if (error) throw error

      const orders = data || []
      const totalOrders = orders.length
      const completedOrders = orders.filter(o => o.status === 'completed').length
      const totalSpent = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
      const averageRating = orders
        .filter(o => o.customer_rating)
        .reduce((sum, o, _, arr) => sum + (o.customer_rating || 0) / arr.length, 0)

      return {
        total_orders: totalOrders,
        completed_orders: completedOrders,
        total_spent: totalSpent,
        average_rating: averageRating,
        last_order_date: orders[0]?.created_at
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get customers by area
  static async getCustomersByArea(): Promise<{ area: string; count: number }[]> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('area')
        .eq('is_active', true)
        .not('area', 'is', null)

      if (error) throw error

      // Group by area and count
      const areaCount = (data || []).reduce((acc, customer) => {
        const area = customer.area || 'غير محدد'
        acc[area] = (acc[area] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return Object.entries(areaCount).map(([area, count]) => ({
        area,
        count: count as number
      }))
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }
}
