// React Hooks for Enhanced API with Performance Optimization
// React Hooks للـ API المحسن مع تحسينات الأداء

import { useState, useEffect, useCallback } from 'react';
import EnhancedAPI from '../api/enhanced-api';
import { 
  PaginatedResponse, 
  OrderWithDetails, 
  CustomerWithOrders,
  WorkerWithTeam,
  TeamWithMembers,
  RouteWithOrders,
  RouteStatus,
  ExpenseWithDetails,
  ServiceWithCategory,
  OrderFilters,
  CustomerFilters,
  WorkerFilters,
  ExpenseFilters,
  CustomerCounts,
  OrderCounts,
  RouteCounts,
  ExpenseCounts
} from '../types';

// Generic hook for paginated data
function usePaginatedData<T>(
  fetchFunction: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
  initialPage = 1,
  initialLimit = 20,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: initialPage,
    limit: initialLimit,
    total: 0,
    total_pages: 0
  });

  const fetchData = useCallback(async (page: number, limit: number, append = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchFunction(page, limit);
      
      if (append) {
        setData(prev => {
          // Avoid duplicating items when appending more pages (based on `id` property)
          const existingIds = new Set(prev.map((item: any) => (item as any)?.id))
          const deduped = result.data.filter((item: any) => {
            const id = (item as any)?.id
            return id === undefined || !existingIds.has(id)
          })
          return [...prev, ...deduped]
        })
      } else {
        setData(result.data)
      }
      
      setPagination({
        page: result.page,
        limit: result.limit,
        total: result.total,
        total_pages: result.total_pages
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [fetchFunction]);

  useEffect(() => {
    fetchData(initialPage, initialLimit);
  }, [fetchData, initialPage, initialLimit, JSON.stringify(dependencies)]);

  const loadMore = useCallback(() => {
    if (pagination.page < pagination.total_pages && !loading) {
      fetchData(pagination.page + 1, pagination.limit, true);
    }
  }, [fetchData, pagination, loading]);

  const refresh = useCallback(() => {
    fetchData(pagination.page, pagination.limit);
  }, [fetchData, pagination.page, pagination.limit]);

  const goToPage = useCallback((page: number) => {
    fetchData(page, pagination.limit);
  }, [fetchData, pagination.limit]);

  return {
    data,
    loading,
    error,
    pagination,
    loadMore,
    refresh,
    goToPage,
    hasMore: pagination.page < pagination.total_pages
  };
}

// Orders hooks
export function useOrders(
  filters?: OrderFilters,
  page = 1,
  limit = 20,
  includeDetails = false
) {
  const filtersString = JSON.stringify(filters);
  
  const fetchFunction = useCallback(
    (p: number, l: number) => EnhancedAPI.getOrders(filters, p, l, includeDetails),
    [filtersString, includeDetails]
  );

  return usePaginatedData<OrderWithDetails>(
    fetchFunction,
    page,
    limit,
    [filtersString, includeDetails]
  );
}

export function useOrder(id: string) {
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedAPI.getOrderById(id);
      setOrder(result || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  return { order, loading, error, refresh: fetchOrder };
}

// Customers hooks
export function useCustomers(
  filters?: CustomerFilters,
  page = 1,
  limit = 20
) {
  const filtersString = JSON.stringify(filters);
  
  const fetchFunction = useCallback(
    (p: number, l: number) => EnhancedAPI.getCustomers(filters, p, l),
    [filtersString]
  );

  return usePaginatedData<CustomerWithOrders>(
    fetchFunction,
    page,
    limit,
    [filtersString]
  );
}

export function useCustomerSearch(searchTerm: string, limit = 10) {
  const [customers, setCustomers] = useState<CustomerWithOrders[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setCustomers([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedAPI.searchCustomers(term, limit);
      setCustomers(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في البحث');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      search(searchTerm);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [search, searchTerm]);

  return { customers, loading, error };
}

// Workers hooks
export function useWorkers(filters?: WorkerFilters) {
  const [workers, setWorkers] = useState<WorkerWithTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const filtersString = JSON.stringify(filters);

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedAPI.getWorkers(filters);
      setWorkers(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [filtersString]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  return { workers, loading, error, refresh: fetchWorkers };
}

// Teams hooks
export function useTeams() {
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedAPI.getTeams();
      setTeams(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return { teams, loading, error, refresh: fetchTeams };
}

// Routes hooks
export function useRoutes(
  filters?: {
    date?: string;
    team_id?: string;
    status?: RouteStatus[];
  },
  page = 1,
  limit = 20
) {
  const filtersString = JSON.stringify(filters);
  
  const fetchFunction = useCallback(
    (p: number, l: number) => EnhancedAPI.getRoutes(filters, p, l),
    [filtersString]
  );

  // Re-use generic paginated hook but keep same outer API (routes instead of data) for backward compatibility
  const {
    data,
    loading,
    error,
    pagination,
    loadMore,
    refresh,
    goToPage,
    hasMore
  } = usePaginatedData<RouteWithOrders>(fetchFunction, page, limit, [filtersString]);

  return {
    routes: data,
    loading,
    error,
    pagination,
    loadMore,
    refresh,
    goToPage,
    hasMore
  };
}

// Expenses hooks
export function useExpenses(
  filters?: ExpenseFilters,
  page = 1,
  limit = 20,
  includeDetails = false
) {
  const filtersString = JSON.stringify(filters);
  
  const fetchFunction = useCallback(
    (p: number, l: number) => EnhancedAPI.getExpenses(filters, p, l, includeDetails),
    [filtersString, includeDetails]
  );

  return usePaginatedData<ExpenseWithDetails>(
    fetchFunction,
    page,
    limit,
    [filtersString, includeDetails]
  );
}

// Services hooks
export function useServices() {
  const [services, setServices] = useState<ServiceWithCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedAPI.getServices();
      setServices(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return { services, loading, error, refresh: fetchServices };
}

// Dashboard hooks
export function useDashboard(date: string) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedAPI.getDashboardData(date);
      setDashboard(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { dashboard, loading, error, refresh: fetchDashboard };
}

// Advanced Analytics Dashboard hook
export function useAnalyticsDashboard(period: 'week' | 'month' | 'quarter' = 'month') {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedAPI.getAnalyticsDashboard(period);
      setAnalytics(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في تحميل التحليلات');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { analytics, loading, error, refresh: fetchAnalytics };
}

// Weekly Statistics hook
export function useWeeklyStats(weekOffset = 0) {
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeeklyStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedAPI.getWeeklyStats(weekOffset);
      setWeeklyStats(result as any[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في تحميل الإحصائيات الأسبوعية');
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useEffect(() => {
    fetchWeeklyStats();
  }, [fetchWeeklyStats]);

  return { weeklyStats, loading, error, refresh: fetchWeeklyStats };
}

// Weekly Statistics Range hook
export function useWeeklyStatsRange(startDate?: string, endDate?: string) {
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depsKey = `${startDate ?? ''}:${endDate ?? ''}`;

  const fetchWeeklyStats = useCallback(async () => {
    if (!startDate || !endDate) {
      setWeeklyStats([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await EnhancedAPI.getWeeklyStatsRange(startDate, endDate);
      setWeeklyStats(result as any[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في تحميل الإحصائيات للفترة');
    } finally {
      setLoading(false);
    }
  }, [depsKey]);

  useEffect(() => {
    fetchWeeklyStats();
  }, [fetchWeeklyStats]);

  return { weeklyStats, loading, error, refresh: fetchWeeklyStats };
}

// Quarterly Statistics hook
export function useQuarterlyStats(yearOffset = 0) {
  const [quarterlyStats, setQuarterlyStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuarterlyStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedAPI.getQuarterlyStats(yearOffset);
      setQuarterlyStats(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في تحميل الإحصائيات الربع سنوية');
    } finally {
      setLoading(false);
    }
  }, [yearOffset]);

  useEffect(() => {
    fetchQuarterlyStats();
  }, [fetchQuarterlyStats]);

  return { quarterlyStats, loading, error, refresh: fetchQuarterlyStats };
}

// Performance Trends hook
export function usePerformanceTrends(days = 30) {
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedAPI.getPerformanceTrends(days);
      setTrends(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في تحميل اتجاهات الأداء');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  return { trends, loading, error, refresh: fetchTrends };
}

// Worker Performance Analytics hook
export function useWorkerPerformanceAnalytics(workerId?: string, days = 30) {
  const [workerAnalytics, setWorkerAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkerAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedAPI.getWorkerPerformanceAnalytics(workerId, days);
      setWorkerAnalytics(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في تحميل تحليلات أداء العمال');
    } finally {
      setLoading(false);
    }
  }, [workerId, days]);

  useEffect(() => {
    fetchWorkerAnalytics();
  }, [fetchWorkerAnalytics]);

  return { workerAnalytics, loading, error, refresh: fetchWorkerAnalytics };
}

// System health hook
export function useSystemHealth() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedAPI.getSystemHealth();
      setHealth(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في فحص النظام');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return { health, loading, error, refresh: checkHealth };
}

// Performance monitoring hook
export function usePerformanceStats(days = 7) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedAPI.getPerformanceStats(days);
      setStats(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في جلب إحصائيات الأداء');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}

// Cache management hook
// Hook to get customer counts
export function useCustomerCounts(refreshInterval = 60000) {
  const [counts, setCounts] = useState<CustomerCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await EnhancedAPI.getCustomerCounts();
      setCounts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في جلب الإحصائيات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    // Auto refresh every refreshInterval ms
    const id = setInterval(fetchCounts, refreshInterval);
    return () => clearInterval(id);
  }, [fetchCounts, refreshInterval]);

  return { counts, loading, error, refresh: fetchCounts };
}

// Hook to get route counts
export function useRouteCounts(refreshInterval = 60000) {
  const [counts, setCounts] = useState<RouteCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await EnhancedAPI.getRouteCounts();
      setCounts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في جلب الإحصائيات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const id = setInterval(fetchCounts, refreshInterval);
    return () => clearInterval(id);
  }, [fetchCounts, refreshInterval]);

  return { counts, loading, error, refresh: fetchCounts };
}

// Hook to get order counts
export function useOrderCounts(refreshInterval = 60000) {
  const [counts, setCounts] = useState<OrderCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await EnhancedAPI.getOrderCounts();
      setCounts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في جلب الإحصائيات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const id = setInterval(fetchCounts, refreshInterval);
    return () => clearInterval(id);
  }, [fetchCounts, refreshInterval]);

  return { counts, loading, error, refresh: fetchCounts };
}

// Hook to get expense counts
export function useExpenseCounts(refreshInterval = 60000) {
  const [counts, setCounts] = useState<ExpenseCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await EnhancedAPI.getExpenseCounts();
      setCounts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في جلب الإحصائيات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const id = setInterval(fetchCounts, refreshInterval);
    return () => clearInterval(id);
  }, [fetchCounts, refreshInterval]);

  return { counts, loading, error, refresh: fetchCounts };
}

export function useCacheManager() {
  const [cacheStats, setCacheStats] = useState<any>(null);

  const getCacheStats = useCallback(() => {
    const stats = EnhancedAPI.getCacheStats();
    setCacheStats(stats);
    return stats;
  }, []);

  const clearCache = useCallback((pattern?: string) => {
    EnhancedAPI.clearCache(pattern);
    getCacheStats(); // Update stats after clearing
  }, [getCacheStats]);

  const optimizeCache = useCallback(async () => {
    const result = await EnhancedAPI.optimizeCache();
    getCacheStats(); // Update stats after optimization
    return result;
  }, [getCacheStats]);

  useEffect(() => {
    getCacheStats();
  }, [getCacheStats]);

  return {
    cacheStats,
    getCacheStats,
    clearCache,
    optimizeCache
  };
}

// Bulk operations hook
export function useBulkOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const bulkUpdateOrderStatus = useCallback(async (
    orderIds: string[],
    status: string,
    batchSize = 50
  ) => {
    setLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      await EnhancedAPI.bulkUpdateOrderStatus(orderIds, status, batchSize);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في التحديث المجمع');
    } finally {
      setLoading(false);
    }
  }, []);

  const bulkCreateExpenses = useCallback(async (
    expenses: any[],
    batchSize = 100
  ) => {
    setLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      await EnhancedAPI.bulkCreateExpenses(expenses, batchSize);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في الإنشاء المجمع');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    progress,
    bulkUpdateOrderStatus,
    bulkCreateExpenses
  };
}

// Auto-refresh hook for real-time data
export function useAutoRefresh<T>(
  fetchFunction: () => Promise<T>,
  interval = 30000, // 30 seconds default
  enabled = true
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchFunction();
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [fetchFunction]);

  useEffect(() => {
    if (!enabled) return;

    fetch(); // Initial fetch
    
    const intervalId = setInterval(fetch, interval);
    return () => clearInterval(intervalId);
  }, [fetch, interval, enabled]);

  return { data, loading, error, lastUpdated, refresh: fetch };
}
