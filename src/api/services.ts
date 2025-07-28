// Services API Layer
import { supabase, handleSupabaseError } from '../lib/supabase'
import { eventBus } from '../utils/EventBus'
import { 
  Service, 
  ServiceCategory,
  ServiceInsert, 
  ServiceUpdate,
  ServiceWithCategory,
  ApiResponse 
} from '../types'

export class ServicesAPI {
  // Get all service categories
  static async getServiceCategories(): Promise<ServiceCategory[]> {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('name_ar')

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get all services with categories - OPTIMIZED
  static async getServices(): Promise<ServiceWithCategory[]> {
    try {
      // Get services using indexed columns
      const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true) // Uses idx_services_active
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!services?.length) return [];

      // Get categories separately for better performance
      const categoryIds = [...new Set(services.map(s => s.category_id).filter(Boolean))];
      
      let categoriesMap = new Map();
      if (categoryIds.length) {
        const { data: categories } = await supabase
          .from('service_categories')
          .select('*')
          .in('id', categoryIds);
        
        categories?.forEach(cat => {
          categoriesMap.set(cat.id, cat);
        });
      }

      // Combine data efficiently
      return services.map(service => ({
        ...service,
        category: categoriesMap.get(service.category_id) || null
      }));
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  // Get services by category
  static async getServicesByCategory(categoryId: string): Promise<Service[]> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('name_ar')

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get service by ID
  static async getServiceById(id: string): Promise<ServiceWithCategory> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          category:service_categories(*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) throw new Error('الخدمة غير موجودة')

      return data
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Create new service
  static async createService(serviceData: ServiceInsert): Promise<ApiResponse<Service>> {
    try {
      const { data, error } = await supabase
        .from('services')
        .insert(serviceData)
        .select()
        .single()

      if (error) throw error

      eventBus.emit('services:changed');
      
      return {
        success: true,
        data,
        message: 'تم إضافة الخدمة بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Update service
  static async updateService(
    id: string, 
    updates: ServiceUpdate
  ): Promise<ApiResponse<Service>> {
    try {
      const { data, error } = await supabase
        .from('services')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      eventBus.emit('services:changed');
      
      return {
        success: true,
        data,
        message: 'تم تحديث الخدمة بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Delete service (soft delete)
  static async deleteService(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      eventBus.emit('services:changed');
      
      return {
        success: true,
        message: 'تم حذف الخدمة بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Create service category
  static async createServiceCategory(
    categoryData: Omit<ServiceCategory, 'id' | 'created_at'>
  ): Promise<ApiResponse<ServiceCategory>> {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .insert(categoryData)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم إضافة فئة الخدمة بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Update service pricing
  static async updateServicePricing(
    serviceId: string,
    newPrice: number
  ): Promise<ApiResponse<Service>> {
    try {
      const { data, error } = await supabase
        .from('services')
        .update({ 
          price: newPrice, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', serviceId)
        .select()
        .single()

      if (error) throw error

      eventBus.emit('services:changed');
      
      return {
        success: true,
        data,
        message: 'تم تحديث سعر الخدمة بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Get popular services (most ordered)
  static async getPopularServices(limit = 10): Promise<ServiceWithCategory[]> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          category:service_categories(*),
          order_items(count)
        `)
        .eq('is_active', true)
        .order('order_items.count', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }
}
