// Performance Utilities for Large-Scale Data Handling
// نظام إدارة شركة التنظيف المنزلي - أدوات تحسين الأداء

import { supabase } from '../lib/supabase';

// Performance monitoring interface
export interface QueryPerformance {
  query_type: string;
  execution_time_ms: number;
  query_hash?: string;
}

// Performance monitoring class
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private performanceThreshold = 1000; // 1 second threshold

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Monitor query execution time
  async monitorQuery<T>(
    queryType: string,
    queryFunction: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await queryFunction();
      const executionTime = Math.round(performance.now() - startTime);
      
      // Log slow queries
      if (executionTime > this.performanceThreshold) {
        await this.logSlowQuery(queryType, executionTime);
        console.warn(`Slow query detected: ${queryType} took ${executionTime}ms`);
      }
      
      return result;
    } catch (error) {
      const executionTime = Math.round(performance.now() - startTime);
      console.error(`Query failed: ${queryType} after ${executionTime}ms`, error);
      throw error;
    }
  }

  // Log slow queries to database
  private async logSlowQuery(queryType: string, executionTime: number): Promise<void> {
    try {
      await supabase
        .from('performance_logs')
        .insert({
          query_type: queryType,
          execution_time_ms: executionTime,
          query_hash: this.generateQueryHash(queryType)
        });
    } catch (error) {
      console.error('Failed to log performance data:', error);
    }
  }

  // Generate simple hash for query identification
  private generateQueryHash(queryType: string): string {
    let hash = 0;
    for (let i = 0; i < queryType.length; i++) {
      const char = queryType.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // Get performance statistics
  async getPerformanceStats(days = 7): Promise<QueryPerformance[]> {
    try {
      const { data, error } = await supabase
        .from('performance_logs')
        .select('query_type, execution_time_ms, created_at')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('execution_time_ms', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get performance stats:', error);
      return [] as QueryPerformance[];
    }
  }
}

// Batch processing utilities
export class BatchProcessor {
  // Process large datasets in batches
  static async processBatch<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<R[]>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<R[]> {
    const results: R[] = [];
    const total = items.length;
    
    for (let i = 0; i < total; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
      
      if (onProgress) {
        onProgress(Math.min(i + batchSize, total), total);
      }
      
      // Small delay to prevent overwhelming the database
      if (i + batchSize < total) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return results;
  }

  // Bulk insert with conflict handling
  static async bulkInsert<T>(
    tableName: string,
    data: T[],
    batchSize = 100,
    _onConflict = 'ignore'
  ): Promise<void> {
    await this.processBatch(
      data,
      batchSize,
      async (batch) => {
        const { error } = await supabase
          .from(tableName)
          .insert(batch)
          .select('id');
        
        if (error) {
          console.error(`Batch insert failed for ${tableName}:`, error);
          throw error;
        }
        
        return batch;
      }
    );
  }
}

// Caching utilities
export class CacheManager {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  // Set cache with TTL (time to live in milliseconds)
  static set(key: string, data: any, ttl = 300000): void { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  // Get from cache
  static get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }
  
  // Clear expired entries
  static cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  // Clear all cache
  static clear(): void {
    this.cache.clear();
  }
  
  // Get cache stats
  static getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Database connection pool utilities
export class ConnectionManager {
  private static maxConnections = 10;
  private static activeConnections = 0;
  
  // Execute query with connection management
  static async executeWithConnection<T>(
    queryFunction: () => Promise<T>
  ): Promise<T> {
    // Wait if too many connections
    while (this.activeConnections >= this.maxConnections) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.activeConnections++;
    
    try {
      return await queryFunction();
    } finally {
      this.activeConnections--;
    }
  }
  
  // Get connection stats
  static getStats(): { active: number; max: number } {
    return {
      active: this.activeConnections,
      max: this.maxConnections
    };
  }
}

// Memory usage monitoring
export class MemoryMonitor {
  private static memoryThreshold = 100 * 1024 * 1024; // 100MB
  
  // Check memory usage
  static checkMemoryUsage(): { used: number; threshold: number; warning: boolean } {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in window.performance) {
      const memory = (window.performance as any).memory;
      const used = memory.usedJSHeapSize;
      
      return {
        used,
        threshold: this.memoryThreshold,
        warning: used > this.memoryThreshold
      };
    }
    
    return { used: 0, threshold: this.memoryThreshold, warning: false };
  }
  
  // Force garbage collection if available
  static forceGarbageCollection(): void {
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc();
    }
  }
}

// Query optimization helpers
export class QueryOptimizer {
  // Generate optimized select fields based on usage
  static getOptimizedFields(
    baseFields: string[],
    includeRelations = false,
    customFields?: string[]
  ): string {
    let fields = [...baseFields];
    
    if (customFields) {
      fields = [...fields, ...customFields];
    }
    
    if (!includeRelations) {
      // Remove relation fields for basic queries
      fields = fields.filter(field => !field.includes(':'));
    }
    
    return fields.join(', ');
  }
  
  // Build optimized filter conditions
  static buildFilterConditions(filters: Record<string, any>): string[] {
    const conditions: string[] = [];
    
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;
      
      if (Array.isArray(value) && value.length > 0) {
        conditions.push(`${key}.in.(${value.join(',')})`);
      } else if (typeof value === 'string' && value.includes('%')) {
        conditions.push(`${key}.ilike.${value}`);
      } else {
        conditions.push(`${key}.eq.${value}`);
      }
    }
    
    return conditions;
  }
}

// Export performance monitor instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Auto cleanup cache every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    CacheManager.cleanup();
  }, 10 * 60 * 1000);
}
