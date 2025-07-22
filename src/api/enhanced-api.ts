// Enhanced API Integration with Full Performance Optimization
// تكامل شامل لـ API مع تحسينات الأداء الكاملة

import { 
  performanceMonitor, 
  CacheManager, 
  BatchProcessor,
  ConnectionManager,
  MemoryMonitor 
} from '../utils/performance';

// Import all optimized APIs
import { OrdersAPI } from './orders';
import { CustomersAPI } from './customers';
import { ReportsAPI } from './reports';
import { WorkersAPI, TeamsAPI } from './workers';
import { ExpensesAPI } from './expenses';
import { ServicesAPI } from './services';
import { RoutesAPI } from './routes';

import { 
  PaginatedResponse, 
  OrderWithDetails, 
  CustomerWithOrders,
  WorkerWithTeam,
  TeamWithMembers,
  ExpenseWithDetails,
  ServiceWithCategory,
  OrderFilters,
  CustomerFilters,
  WorkerFilters,
  ExpenseFilters,
  ApiResponse,
  RouteWithOrders,
  RouteStatus,
  CustomerCounts,
  OrderCounts,
  RouteCounts,
  ExpenseCounts
} from '../types';

// Enhanced API wrapper with comprehensive optimization
export class EnhancedAPI {
  
  // ===== ORDERS API =====
  static async getOrders(
    filters?: OrderFilters,
    page = 1,
    limit = 20,
    includeDetails = false,
    useCache = true
  ): Promise<PaginatedResponse<OrderWithDetails>> {
    const cacheKey = `enhanced:orders:${JSON.stringify(filters)}:${page}:${limit}:${includeDetails}`;
    
    if (useCache) {
      const cached = CacheManager.get<PaginatedResponse<OrderWithDetails>>(cacheKey);
      if (cached) return cached;
    }

    return performanceMonitor.monitorQuery(
      'enhanced.orders.getOrders',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          OrdersAPI.getOrders(filters, page, limit, includeDetails)
        );
        
        if (useCache) {
          // Cache based on data sensitivity
          const ttl = includeDetails ? 120000 : 60000; // 2min for details, 1min for basic
          CacheManager.set(cacheKey, result, ttl);
        }
        
        return result;
      }
    );
  }

  static async getOrderById(id: string, useCache = true): Promise<OrderWithDetails | undefined> {
    const cacheKey = `enhanced:order:${id}`;
    
    if (useCache) {
      const cached = CacheManager.get<OrderWithDetails>(cacheKey);
      if (cached) return cached;
    }

    return performanceMonitor.monitorQuery(
      'enhanced.orders.getOrderById',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          OrdersAPI.getOrderById(id)
        );
        
        if (result && useCache) {
          CacheManager.set(cacheKey, result, 300000); // 5 minutes
        }
        
        return result;
      }
    );
  }

  static async createOrder(orderData: any, items: any[]): Promise<ApiResponse<OrderWithDetails>> {
    return performanceMonitor.monitorQuery(
      'enhanced.orders.create',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          OrdersAPI.createOrder(orderData, items)
        ) as ApiResponse<OrderWithDetails>;
        
        // Clear related caches
        this.clearCache('enhanced:orders');
        this.clearCache('enhanced:dashboard');
        
        return result;
      }
    );
  }

  static async updateOrder(id: string, orderData: any): Promise<ApiResponse<OrderWithDetails>> {
    return performanceMonitor.monitorQuery(
      'enhanced.orders.update',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          OrdersAPI.updateOrder(id, orderData)
        );
        
        // Clear related caches
        this.clearCache('enhanced:orders');
        this.clearCache(`enhanced:order:${id}`);
        this.clearCache('enhanced:dashboard');
        
        return result;
      }
    );
  }

  static async updateOrderStatus(id: string, status: string, notes?: string, userId?: string): Promise<ApiResponse<any>> {
    return performanceMonitor.monitorQuery(
      'enhanced.orders.updateStatus',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          OrdersAPI.updateOrderStatus(id, status as any, notes, userId)
        );
        
        // Clear related caches
        this.clearCache('enhanced:orders');
        this.clearCache(`enhanced:order:${id}`);
        this.clearCache('enhanced:dashboard');
        
        return result;
      }
    );
  }

  static async deleteOrder(id: string): Promise<ApiResponse<any>> {
    return performanceMonitor.monitorQuery(
      'enhanced.orders.delete',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          OrdersAPI.deleteOrder(id)
        );
        
        // Clear related caches
        this.clearCache('enhanced:orders');
        this.clearCache(`enhanced:order:${id}`);
        this.clearCache('enhanced:dashboard');
        
        return result;
      }
    );
  }

  // ===== ROUTES COUNTS =====
  static async getRouteCounts(useCache = true): Promise<RouteCounts> {
    const cacheKey = 'enhanced:routes:counts';
    if (useCache) {
      const cached = CacheManager.get<RouteCounts>(cacheKey);
      if (cached) return cached;
    }
    return performanceMonitor.monitorQuery(
      'enhanced.routes.getCounts',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() => RoutesAPI.getCounts());
        if (useCache) {
          CacheManager.set(cacheKey, result, 60000); // 1 دقيقة
        }
        return result;
      }
    );
  }

  // ===== EXPENSES COUNTS =====
  static async getExpenseCounts(useCache = true): Promise<ExpenseCounts> {
    const cacheKey = 'enhanced:expenses:counts';
    if (useCache) {
      const cached = CacheManager.get<ExpenseCounts>(cacheKey);
      if (cached) return cached;
    }
    return performanceMonitor.monitorQuery(
      'enhanced.expenses.getCounts',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() => ExpensesAPI.getCounts());
        if (useCache) {
          CacheManager.set(cacheKey, result, 60000); // 1 minute
        }
        return result;
      }
    );
  }

  // ===== CUSTOMERS API =====
  static async getCustomerCounts(useCache = true): Promise<CustomerCounts> {

    const cacheKey = 'enhanced:customers:counts';
    if (useCache) {
      const cached = CacheManager.get<CustomerCounts>(cacheKey);
      if (cached) return cached;
    }

    return performanceMonitor.monitorQuery(
      'enhanced.customers.getCounts',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() => CustomersAPI.getCounts());
        if (useCache) {
          CacheManager.set(cacheKey, result, 60000); // 1 دقيقة
        }
        return result;
      }
    );
  }

  // ===== ORDERS COUNTS =====
  static async getOrderCounts(useCache = true): Promise<OrderCounts> {
    const cacheKey = 'enhanced:orders:counts';
    if (useCache) {
      const cached = CacheManager.get<OrderCounts>(cacheKey);
      if (cached) return cached;
    }

    return performanceMonitor.monitorQuery(
      'enhanced.orders.getCounts',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() => OrdersAPI.getCounts());
        if (useCache) {
          CacheManager.set(cacheKey, result, 60000); // 1 دقيقة
        }
        return result;
      }
    );
  }

// ===== CUSTOMERS API =====
  static async getCustomers(
    filters?: CustomerFilters,
    page = 1,
    limit = 20,
    useCache = true
  ): Promise<PaginatedResponse<CustomerWithOrders>> {
    const cacheKey = `enhanced:customers:${JSON.stringify(filters)}:${page}:${limit}`;
    
    if (useCache) {
      const cached = CacheManager.get<PaginatedResponse<CustomerWithOrders>>(cacheKey);
      if (cached) return cached;
    }

    return performanceMonitor.monitorQuery(
      'enhanced.customers.getCustomers',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          CustomersAPI.getCustomers(filters, page, limit)
        );
        
        if (useCache) {
          CacheManager.set(cacheKey, result, 180000); // 3 minutes
        }
        
        return result;
      }
    );
  }

  static async searchCustomers(searchTerm: string, limit = 10): Promise<CustomerWithOrders[]> {
    if (!searchTerm || searchTerm.length < 2) return [];

    const cacheKey = `enhanced:customers:search:${searchTerm}:${limit}`;
    const cached = CacheManager.get<CustomerWithOrders[]>(cacheKey);
    if (cached) return cached;

    return performanceMonitor.monitorQuery(
      'enhanced.customers.search',
      async () => {
        const result = await CustomersAPI.getCustomers(
          { search: searchTerm },
          1,
          limit
        );
        
        CacheManager.set(cacheKey, result.data, 60000); // 1 minute for search
        return result.data;
      }
    );
  }

  static async getCustomerById(id: string, useCache = true): Promise<CustomerWithOrders | undefined> {
    const cacheKey = `enhanced:customer:${id}`;
    
    if (useCache) {
      const cached = CacheManager.get<CustomerWithOrders>(cacheKey);
      if (cached) return cached;
    }

    return performanceMonitor.monitorQuery(
      'enhanced.customers.getById',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          CustomersAPI.getCustomerById(id)
        );
        
        if (result && useCache) {
          CacheManager.set(cacheKey, result, 300000); // 5 minutes
        }
        
        return result;
      }
    );
  }

  static async createCustomer(customerData: any): Promise<ApiResponse<CustomerWithOrders>> {
    return performanceMonitor.monitorQuery(
      'enhanced.customers.create',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          CustomersAPI.createCustomer(customerData)
        );
        
        // Clear related caches
        this.clearCache('enhanced:customers');
        
        return result;
      }
    );
  }

  static async updateCustomer(id: string, customerData: any): Promise<ApiResponse<CustomerWithOrders>> {
    return performanceMonitor.monitorQuery(
      'enhanced.customers.update',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          CustomersAPI.updateCustomer(id, customerData)
        );
        
        // Clear related caches
        this.clearCache('enhanced:customers');
        this.clearCache(`enhanced:customer:${id}`);
        
        return result;
      }
    );
  }

  static async deleteCustomer(id: string): Promise<ApiResponse<any>> {
    return performanceMonitor.monitorQuery(
      'enhanced.customers.delete',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          CustomersAPI.deleteCustomer(id)
        );
        
        // Clear related caches
        this.clearCache('enhanced:customers');
        this.clearCache(`enhanced:customer:${id}`);
        
        return result;
      }
    );
  }

  // ===== WORKERS & TEAMS API =====
  static async getWorkers(filters?: WorkerFilters, useCache = true): Promise<WorkerWithTeam[]> {
    const cacheKey = `enhanced:workers:${JSON.stringify(filters)}`;
    
    if (useCache) {
      const cached = CacheManager.get<WorkerWithTeam[]>(cacheKey);
      if (cached) return cached;
    }

    return performanceMonitor.monitorQuery(
      'enhanced.workers.getWorkers',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          WorkersAPI.getWorkers(filters)
        );
        
        if (useCache) {
          CacheManager.set(cacheKey, result, 300000); // 5 minutes
        }
        
        return result;
      }
    );
  }

  static async getTeams(useCache = true): Promise<TeamWithMembers[]> {
    const cacheKey = 'enhanced:teams:all';
    
    if (useCache) {
      const cached = CacheManager.get<TeamWithMembers[]>(cacheKey);
      if (cached) return cached;
    }

    return performanceMonitor.monitorQuery(
      'enhanced.teams.getTeams',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          TeamsAPI.getTeams()
        );
        
        if (useCache) {
          CacheManager.set(cacheKey, result, 300000); // 5 minutes
        }
        
        return result;
      }
    );
  }

  // ===== ROUTES API =====
  static async getRoutes(
    filters?: {
      date?: string;
      team_id?: string;
      status?: RouteStatus[];
    },
    page = 1,
    limit = 20,
    useCache = true
  ): Promise<PaginatedResponse<RouteWithOrders>> {
    const cacheKey = `enhanced:routes:${JSON.stringify(filters)}:${page}:${limit}`;

    if (useCache) {
      const cached = CacheManager.get<PaginatedResponse<RouteWithOrders>>(cacheKey);
      if (cached) return cached;
    }

    return performanceMonitor.monitorQuery('enhanced.routes.getRoutes', async () => {
      const result = await ConnectionManager.executeWithConnection(() =>
        RoutesAPI.getRoutes(filters, page, limit)
      );

      if (useCache) {
        CacheManager.set(cacheKey, result, 60000); // 1 minute
      }

      return result;
    });
  }

  // ===== EXPENSES API =====
  static async getExpenses(
    filters?: ExpenseFilters,
    page = 1,
    limit = 20,
    includeDetails = false,
    useCache = true
  ): Promise<PaginatedResponse<ExpenseWithDetails>> {
    const cacheKey = `enhanced:expenses:${JSON.stringify(filters)}:${page}:${limit}:${includeDetails}`;
    
    if (useCache) {
      const cached = CacheManager.get<PaginatedResponse<ExpenseWithDetails>>(cacheKey);
      if (cached) return cached;
    }

    return performanceMonitor.monitorQuery(
      'enhanced.expenses.getExpenses',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          ExpensesAPI.getExpenses(filters, page, limit, includeDetails)
        );
        
        if (useCache) {
          const ttl = includeDetails ? 120000 : 60000;
          CacheManager.set(cacheKey, result, ttl);
        }
        
        return result;
      }
    );
  }

  // ===== SERVICES API =====
  static async getServices(useCache = true): Promise<ServiceWithCategory[]> {
    const cacheKey = 'enhanced:services:all';
    
    if (useCache) {
      const cached = CacheManager.get<ServiceWithCategory[]>(cacheKey);
      if (cached) return cached;
    }

    return performanceMonitor.monitorQuery(
      'enhanced.services.getServices',
      async () => {
        const result = await ConnectionManager.executeWithConnection(() =>
          ServicesAPI.getServices()
        );
        
        if (useCache) {
          CacheManager.set(cacheKey, result, 600000); // 10 minutes (services change rarely)
        }
        
        return result;
      }
    );
  }

  // ===== REPORTS API =====
  static async getDashboardData(date: string, useCache = true) {
    const cacheKey = `enhanced:dashboard:${date}`;
    
    if (useCache) {
      const cached = CacheManager.get(cacheKey);
      if (cached) return cached;
    }

    return performanceMonitor.monitorQuery(
      'enhanced.reports.getDashboard',
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
        
        if (useCache) {
          CacheManager.set(cacheKey, result, 600000); // 10 minutes
        }
        
        return result;
      }
    );
  }

  // ===== BULK OPERATIONS =====
  static async bulkUpdateOrderStatus(
    orderIds: string[],
    status: string,
    batchSize = 50
  ): Promise<void> {
    return performanceMonitor.monitorQuery(
      'enhanced.orders.bulkUpdateStatus',
      async () => {
        await BatchProcessor.processBatch(
          orderIds,
          batchSize,
          async (batch) => {
            const { supabase } = await import('../lib/supabase');
            
            const { error } = await supabase
              .from('orders')
              .update({ status, updated_at: new Date().toISOString() })
              .in('id', batch);
            
            if (error) throw error;
            
            // Invalidate related cache entries
            batch.forEach(id => {
              CacheManager.set(`enhanced:order:${id}`, null, 0);
            });
            
            return batch;
          }
        );
      }
    );
  }

  static async bulkCreateExpenses(
    expenses: any[],
    batchSize = 100
  ): Promise<void> {
    return performanceMonitor.monitorQuery(
      'enhanced.expenses.bulkCreate',
      async () => {
        await BatchProcessor.bulkInsert('expenses', expenses, batchSize);
        
        // Clear expenses cache
        const cacheStats = CacheManager.getStats();
        cacheStats.keys
          .filter(key => key.startsWith('enhanced:expenses:'))
          .forEach(key => CacheManager.set(key, null, 0));
      }
    );
  }

  // ===== SYSTEM UTILITIES =====
  static async getSystemHealth() {
    return performanceMonitor.monitorQuery(
      'enhanced.system.health',
      async () => {
        const { supabase } = await import('../lib/supabase');
        
        // Test database connectivity
        const dbStart = performance.now();
        const { error: dbError } = await supabase
          .from('system_settings')
          .select('id')
          .limit(1);
        const dbTime = Math.round(performance.now() - dbStart);

        // Check memory usage
        const memoryStatus = MemoryMonitor.checkMemoryUsage();
        
        // Get cache stats
        const cacheStats = CacheManager.getStats();
        
        // Get connection stats
        const connectionStats = ConnectionManager.getStats();

        return {
          database: {
            status: dbError ? 'error' : 'healthy',
            response_time_ms: dbTime,
            error: dbError?.message
          },
          memory: memoryStatus,
          cache: cacheStats,
          connections: connectionStats,
          timestamp: new Date().toISOString()
        };
      }
    );
  }

  static async optimizeCache() {
    return performanceMonitor.monitorQuery(
      'enhanced.cache.optimize',
      async () => {
        // Clean up expired entries
        CacheManager.cleanup();
        
        // Force garbage collection if available
        MemoryMonitor.forceGarbageCollection();
        
        // Get updated stats
        const stats = CacheManager.getStats();
        
        return {
          cache_cleaned: true,
          remaining_entries: stats.size,
          memory_optimized: true,
          timestamp: new Date().toISOString()
        };
      }
    );
  }

  static async preloadCriticalData() {
    return performanceMonitor.monitorQuery(
      'enhanced.preload.critical',
      async () => {
        // Preload frequently accessed data
        const today = new Date().toISOString().split('T')[0];
        
        await Promise.all([
          this.getServices(true), // Services (rarely change)
          this.getTeams(true), // Teams
          this.getDashboardData(today, true), // Today's dashboard
          this.getOrders({ date_from: today }, 1, 20, false, true) // Today's orders
        ]);
        
        return {
          preloaded: ['services', 'teams', 'dashboard', 'recent_orders'],
          timestamp: new Date().toISOString()
        };
      }
    );
  }

  // ===== CACHE MANAGEMENT =====
  static clearCache(pattern?: string) {
    if (pattern) {
      const stats = CacheManager.getStats();
      stats.keys
        .filter(key => key.includes(pattern))
        .forEach(key => CacheManager.set(key, null, 0));
    } else {
      CacheManager.clear();
    }
  }

  static getCacheStats() {
    return CacheManager.getStats();
  }

  static getPerformanceStats(days = 7) {
    return performanceMonitor.getPerformanceStats(days);
  }
}

// Export enhanced API as default
export default EnhancedAPI;

// Also export individual optimized APIs
export {
  OrdersAPI,
  CustomersAPI,
  ReportsAPI,
  WorkersAPI,
  TeamsAPI,
  ExpensesAPI,
  ServicesAPI,
  RoutesAPI
};
