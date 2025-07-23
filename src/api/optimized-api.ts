// Optimized API Layer with Performance Monitoring
// شركةHOME CARE - طبقة API محسنة للأداء

import { 
  performanceMonitor, 
  CacheManager, 
  BatchProcessor,
  ConnectionManager 
} from '../utils/performance';
import { OrdersAPI } from './orders';
import { CustomersAPI } from './customers';
import { ReportsAPI } from './reports';
import { 
  PaginatedResponse, 
  OrderWithDetails, 
  CustomerWithOrders,
  OrderFilters,
  CustomerFilters 
} from '../types';

// Optimized Orders API with caching and monitoring
export class OptimizedOrdersAPI {
  // Get orders with performance monitoring and caching
  static async getOrders(
    filters?: OrderFilters,
    page = 1,
    limit = 20,
    includeDetails = false
  ): Promise<PaginatedResponse<OrderWithDetails>> {
    const cacheKey = `orders:${JSON.stringify(filters)}:${page}:${limit}:${includeDetails}`;
    
    // Try cache first
    const cached = CacheManager.get<PaginatedResponse<OrderWithDetails>>(cacheKey);
    if (cached) {
      return cached;
    }

    return performanceMonitor.monitorQuery(
      'orders.getOrders',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          OrdersAPI.getOrders(filters, page, limit, includeDetails)
        );
        
        // Cache for 2 minutes
        CacheManager.set(cacheKey, result, 120000);
        return result;
      }
    );
  }

  // Get single order with caching
  static async getOrderById(id: string): Promise<OrderWithDetails | undefined> {
    const cacheKey = `order:${id}`;
    
    const cached = CacheManager.get<OrderWithDetails>(cacheKey);
    if (cached) {
      return cached;
    }

    return performanceMonitor.monitorQuery(
      'orders.getOrderById',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          OrdersAPI.getOrderById(id)
        );
        
        if (result) {
          // Cache for 5 minutes
          CacheManager.set(cacheKey, result, 300000);
        }
        
        return result;
      }
    );
  }

  // Bulk operations for large datasets
  static async bulkUpdateOrderStatus(
    orderIds: string[],
    status: string,
    batchSize = 50
  ): Promise<void> {
    return performanceMonitor.monitorQuery(
      'orders.bulkUpdateStatus',
      async () => {
        await BatchProcessor.processBatch(
          orderIds,
          batchSize,
          async (batch) => {
            const updates = batch.map(id => ({ id, status }));
            await BatchProcessor.bulkInsert('orders', updates);
            
            // Clear related cache entries
            batch.forEach(id => {
              CacheManager.set(`order:${id}`, null, 0); // Invalidate cache
            });
            
            return updates;
          }
        );
      }
    );
  }
}

// Optimized Customers API
export class OptimizedCustomersAPI {
  // Get customers with performance monitoring
  static async getCustomers(
    filters?: CustomerFilters,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<CustomerWithOrders>> {
    const cacheKey = `customers:${JSON.stringify(filters)}:${page}:${limit}`;
    
    const cached = CacheManager.get<PaginatedResponse<CustomerWithOrders>>(cacheKey);
    if (cached) {
      return cached;
    }

    return performanceMonitor.monitorQuery(
      'customers.getCustomers',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          CustomersAPI.getCustomers(filters, page, limit)
        );
        
        // Cache for 3 minutes
        CacheManager.set(cacheKey, result, 180000);
        return result;
      }
    );
  }

  // Search customers with text search optimization
  static async searchCustomers(
    searchTerm: string,
    limit = 10
  ): Promise<CustomerWithOrders[]> {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    const cacheKey = `customers:search:${searchTerm}:${limit}`;
    
    const cached = CacheManager.get<CustomerWithOrders[]>(cacheKey);
    if (cached) {
      return cached;
    }

    return performanceMonitor.monitorQuery(
      'customers.searchCustomers',
      async () => {
        const result = await CustomersAPI.getCustomers(
          { search: searchTerm },
          1,
          limit
        );
        
        // Cache search results for 1 minute
        CacheManager.set(cacheKey, result.data, 60000);
        return result.data;
      }
    );
  }
}

// Optimized Reports API
export class OptimizedReportsAPI {
  // Get dashboard data with heavy caching
  static async getDashboardData(date: string) {
    const cacheKey = `dashboard:${date}`;
    
    const cached = CacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    return performanceMonitor.monitorQuery(
      'reports.getDashboardData',
      async () => {
        const [dailyStats, teamSummaries] = await Promise.all([
          ReportsAPI.getDailyDashboard(date),
          ReportsAPI.getTeamSummaries()
        ]);

        const result = {
          daily: dailyStats,
          teams: teamSummaries,
          generated_at: new Date().toISOString()
        };
        
        // Cache dashboard data for 10 minutes
        CacheManager.set(cacheKey, result, 600000);
        return result;
      }
    );
  }

  // Get monthly reports with materialized views
  static async getMonthlyReport(year: number, month: number) {
    const cacheKey = `monthly:${year}:${month}`;
    
    const cached = CacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    return performanceMonitor.monitorQuery(
      'reports.getMonthlyReport',
      async () => {
        // Use materialized view for better performance
        const { data, error } = await ConnectionManager.executeWithConnection(async () => {
          const { supabase } = await import('../lib/supabase');
          return supabase
            .from('mv_monthly_stats')
            .select('*')
            .eq('month_date', `${year}-${month.toString().padStart(2, '0')}-01`)
            .maybeSingle();
        });

        if (error) throw error;
        
        // Cache monthly reports for 1 hour
        CacheManager.set(cacheKey, data, 3600000);
        return data;
      }
    );
  }
}

// Performance Analytics API
export class PerformanceAPI {
  // Get system performance metrics
  static async getPerformanceMetrics(days = 7) {
    return performanceMonitor.monitorQuery(
      'performance.getMetrics',
      async () => {
        const [performanceStats, cacheStats, connectionStats] = await Promise.all([
          performanceMonitor.getPerformanceStats(days),
          Promise.resolve(CacheManager.getStats()),
          Promise.resolve(ConnectionManager.getStats())
        ]);

        return {
          performance: performanceStats,
          cache: cacheStats,
          connections: connectionStats,
          timestamp: new Date().toISOString()
        };
      }
    );
  }

  // Get slow queries report
  static async getSlowQueriesReport(limit = 20) {
    const { supabase } = await import('../lib/supabase');
    
    return performanceMonitor.monitorQuery(
      'performance.getSlowQueries',
      async () => {
        const { data, error } = await supabase
          .from('performance_logs')
          .select('*')
          .gte('execution_time_ms', 1000) // Queries slower than 1 second
          .order('execution_time_ms', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data || [];
      }
    );
  }

  // Clear performance logs older than specified days
  static async cleanupPerformanceLogs(days = 30) {
    const { supabase } = await import('../lib/supabase');
    
    return performanceMonitor.monitorQuery(
      'performance.cleanup',
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const { error } = await supabase
          .from('performance_logs')
          .delete()
          .lt('created_at', cutoffDate.toISOString());

        if (error) throw error;
        
        // Also clear cache
        CacheManager.clear();
        
        return { success: true, cleaned_before: cutoffDate.toISOString() };
      }
    );
  }
}

// Health Check API
export class HealthCheckAPI {
  // Comprehensive system health check
  static async getSystemHealth() {
    return performanceMonitor.monitorQuery(
      'health.systemCheck',
      async () => {
        const { supabase } = await import('../lib/supabase');
        
        // Test database connectivity
        const dbStart = performance.now();
        const { error: dbError } = await supabase
          .from('system_settings')
          .select('id')
          .limit(1);
        const dbTime = Math.round(performance.now() - dbStart);

        // Check cache performance
        const cacheStart = performance.now();
        CacheManager.set('health_test', { test: true }, 1000);
        const cacheTest = CacheManager.get('health_test');
        const cacheTime = Math.round(performance.now() - cacheStart);

        // Get system stats
        const stats = await PerformanceAPI.getPerformanceMetrics(1);

        return {
          database: {
            status: dbError ? 'error' : 'healthy',
            response_time_ms: dbTime,
            error: dbError?.message
          },
          cache: {
            status: cacheTest ? 'healthy' : 'error',
            response_time_ms: cacheTime,
            stats: stats.cache
          },
          connections: stats.connections,
          timestamp: new Date().toISOString()
        };
      }
    );
  }
}

// Export optimized APIs
export {
  OptimizedOrdersAPI as Orders,
  OptimizedCustomersAPI as Customers,
  OptimizedReportsAPI as Reports,
  PerformanceAPI as Performance,
  HealthCheckAPI as Health
};
