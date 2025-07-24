import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Filter, Download, RefreshCw } from 'lucide-react';

interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  component: string;
  message: string;
  details?: string;
  resolved: boolean;
}

interface SystemErrorLogProps {
  onExport?: (format: 'csv' | 'json') => void;
}

const SystemErrorLog: React.FC<SystemErrorLogProps> = ({ onExport }) => {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    loadErrorLog();
  }, [filter, timeRange, showResolved]);

  const loadErrorLog = async () => {
    setLoading(true);
    try {
      // Simulate API call - replace with actual API
      const mockErrors: ErrorLogEntry[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          level: 'error',
          component: 'Database',
          message: 'فشل في الاتصال بقاعدة البيانات',
          details: 'Connection timeout after 30 seconds. Server may be overloaded.',
          resolved: false
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          level: 'warning',
          component: 'Memory',
          message: 'استهلاك ذاكرة مرتفع',
          details: 'Memory usage reached 85% of available capacity.',
          resolved: true
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
          level: 'warning',
          component: 'Cache',
          message: 'انخفاض في كفاءة الكاش',
          details: 'Cache hit rate dropped to 45%. Consider reviewing cache strategy.',
          resolved: false
        },
        {
          id: '4',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
          level: 'info',
          component: 'System',
          message: 'تم تحديث النظام بنجاح',
          details: 'System updated to version 2.1.0 with performance improvements.',
          resolved: true
        }
      ];

      // Apply filters
      let filteredErrors = mockErrors;
      
      if (filter !== 'all') {
        filteredErrors = filteredErrors.filter(error => error.level === filter);
      }
      
      if (!showResolved) {
        filteredErrors = filteredErrors.filter(error => !error.resolved);
      }

      // Apply time range filter
      const now = Date.now();
      const timeRangeMs = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      }[timeRange];

      filteredErrors = filteredErrors.filter(error => 
        now - new Date(error.timestamp).getTime() <= timeRangeMs
      );

      setErrors(filteredErrors);
    } catch (error) {
      console.error('Failed to load error log:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'info':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return '🔴';
      case 'warning':
        return '🟡';
      case 'info':
        return '🔵';
      default:
        return '⚪';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `منذ ${days} يوم`;
    if (hours > 0) return `منذ ${hours} ساعة`;
    if (minutes > 0) return `منذ ${minutes} دقيقة`;
    return 'الآن';
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (onExport) {
      onExport(format);
    } else {
      // Default export logic
      const data = format === 'json' 
        ? JSON.stringify(errors, null, 2)
        : errors.map(error => 
            `${error.timestamp},${error.level},${error.component},"${error.message}","${error.details || ''}",${error.resolved}`
          ).join('\n');
      
      const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-errors.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const toggleResolved = async (errorId: string) => {
    setErrors(prev => prev.map(error => 
      error.id === errorId 
        ? { ...error, resolved: !error.resolved }
        : error
    ));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">سجل أخطاء النظام</h3>
            <p className="text-sm text-gray-600">تتبع ومراقبة جميع أخطاء وتحذيرات النظام</p>
          </div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <button
              onClick={loadErrorLog}
              disabled={loading}
              className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              تصدير CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="flex items-center px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Download className="h-4 w-4 mr-2" />
              تصدير JSON
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">جميع المستويات</option>
              <option value="error">أخطاء فقط</option>
              <option value="warning">تحذيرات فقط</option>
              <option value="info">معلومات فقط</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Clock className="h-4 w-4 text-gray-500" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="1h">آخر ساعة</option>
              <option value="24h">آخر 24 ساعة</option>
              <option value="7d">آخر 7 أيام</option>
              <option value="30d">آخر 30 يوم</option>
            </select>
          </div>

          <label className="flex items-center space-x-2 rtl:space-x-reverse">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">إظهار المحلولة</span>
          </label>
        </div>
      </div>

      {/* Error List */}
      <div className="divide-y divide-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">جاري تحميل السجل...</p>
          </div>
        ) : errors.length === 0 ? (
          <div className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">لا توجد أخطاء في الفترة المحددة</p>
          </div>
        ) : (
          errors.map((error) => (
            <div key={error.id} className={`p-4 hover:bg-gray-50 transition-colors ${
              error.resolved ? 'opacity-60' : ''
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 rtl:space-x-reverse flex-1">
                  <div className="text-lg">{getLevelIcon(error.level)}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse mb-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                        getLevelColor(error.level)
                      }`}>
                        {error.level === 'error' ? 'خطأ' :
                         error.level === 'warning' ? 'تحذير' : 'معلومات'}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{error.component}</span>
                      <span className="text-xs text-gray-500">{formatTimeAgo(error.timestamp)}</span>
                      {error.resolved && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          محلول
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 mb-2">{error.message}</p>
                    {error.details && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border-r-2 border-gray-300">
                        {error.details}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <button
                    onClick={() => toggleResolved(error.id)}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      error.resolved
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {error.resolved ? 'إعادة فتح' : 'تم الحل'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {!loading && errors.length > 0 && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>إجمالي الأخطاء: {errors.length}</span>
            <span>
              غير محلولة: {errors.filter(e => !e.resolved).length} |
              محلولة: {errors.filter(e => e.resolved).length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemErrorLog;