import React, { useState, useEffect } from 'react';
import { Bell, X, AlertTriangle, Info, CheckCircle, Clock } from 'lucide-react';

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  source: string;
  acknowledged: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface RealTimeAlertsProps {
  maxAlerts?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const RealTimeAlerts: React.FC<RealTimeAlertsProps> = ({ 
  maxAlerts = 10, 
  autoRefresh = true, 
  refreshInterval = 30000 
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'all' | 'unacknowledged' | 'critical'>('unacknowledged');
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    loadAlerts();
    
    if (autoRefresh) {
      const interval = setInterval(loadAlerts, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const loadAlerts = async () => {
    try {
      // Simulate API call - replace with actual API
      const mockAlerts: Alert[] = [
        {
          id: '1',
          type: 'error',
          title: 'فشل في الاتصال بقاعدة البيانات',
          message: 'تعذر الاتصال بقاعدة البيانات الرئيسية. يتم المحاولة مرة أخرى...',
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          source: 'Database',
          acknowledged: false,
          priority: 'critical'
        },
        {
          id: '2',
          type: 'warning',
          title: 'استهلاك ذاكرة مرتفع',
          message: 'استهلاك الذاكرة وصل إلى 85% من السعة المتاحة',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          source: 'Memory Monitor',
          acknowledged: false,
          priority: 'high'
        },
        {
          id: '3',
          type: 'warning',
          title: 'زمن استجابة بطيء',
          message: 'متوسط زمن الاستجابة تجاوز 500ms في آخر 10 دقائق',
          timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
          source: 'Performance Monitor',
          acknowledged: true,
          priority: 'medium'
        },
        {
          id: '4',
          type: 'info',
          title: 'تحديث النظام',
          message: 'تم تطبيق تحديث أمني جديد بنجاح',
          timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          source: 'System',
          acknowledged: true,
          priority: 'low'
        },
        {
          id: '5',
          type: 'success',
          title: 'تم حل مشكلة الكاش',
          message: 'تم إصلاح مشكلة انخفاض كفاءة الكاش وعاد الأداء للمستوى الطبيعي',
          timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
          source: 'Cache Manager',
          acknowledged: true,
          priority: 'medium'
        }
      ];

      // Apply filters
      let filteredAlerts = mockAlerts;
      
      if (filter === 'unacknowledged') {
        filteredAlerts = filteredAlerts.filter(alert => !alert.acknowledged);
      } else if (filter === 'critical') {
        filteredAlerts = filteredAlerts.filter(alert => alert.priority === 'critical');
      }

      // Limit to maxAlerts
      filteredAlerts = filteredAlerts.slice(0, maxAlerts);

      setAlerts(filteredAlerts);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  };

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, acknowledged: true }
        : alert
    ));
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getAlertColor = (type: string, acknowledged: boolean) => {
    const opacity = acknowledged ? 'opacity-60' : '';
    switch (type) {
      case 'error':
        return `bg-red-50 border-red-200 ${opacity}`;
      case 'warning':
        return `bg-yellow-50 border-yellow-200 ${opacity}`;
      case 'info':
        return `bg-blue-50 border-blue-200 ${opacity}`;
      case 'success':
        return `bg-green-50 border-green-200 ${opacity}`;
      default:
        return `bg-gray-50 border-gray-200 ${opacity}`;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    
    const labels = {
      critical: 'حرج',
      high: 'عالي',
      medium: 'متوسط',
      low: 'منخفض'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
        colors[priority as keyof typeof colors]
      }`}>
        {labels[priority as keyof typeof labels]}
      </span>
    );
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

  const unacknowledgedCount = alerts.filter(alert => !alert.acknowledged).length;
  const criticalCount = alerts.filter(alert => alert.priority === 'critical' && !alert.acknowledged).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="relative">
              <Bell className="h-6 w-6 text-gray-700" />
              {unacknowledgedCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unacknowledgedCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">التنبيهات الفورية</h3>
              <p className="text-sm text-gray-600">
                {criticalCount > 0 && (
                  <span className="text-red-600 font-medium">{criticalCount} تنبيه حرج</span>
                )}
                {criticalCount > 0 && unacknowledgedCount > criticalCount && ' • '}
                {unacknowledgedCount > criticalCount && (
                  <span>{unacknowledgedCount - criticalCount} تنبيه غير مقروء</span>
                )}
                {unacknowledgedCount === 0 && 'لا توجد تنبيهات جديدة'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">جميع التنبيهات</option>
              <option value="unacknowledged">غير مقروءة</option>
              <option value="critical">حرجة فقط</option>
            </select>
            
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isMinimized ? '▼' : '▲'}
            </button>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      {!isMinimized && (
        <div className="max-h-96 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد تنبيهات حاليًا</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {alerts.map((alert) => (
                <div key={alert.id} className={`p-4 border-l-4 ${
                  getAlertColor(alert.type, alert.acknowledged)
                } ${alert.priority === 'critical' ? 'border-l-red-500' : 
                     alert.priority === 'high' ? 'border-l-orange-500' :
                     alert.priority === 'medium' ? 'border-l-yellow-500' : 'border-l-gray-500'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 rtl:space-x-reverse flex-1">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse mb-1">
                          <h4 className="text-sm font-medium text-gray-900">{alert.title}</h4>
                          {getPriorityBadge(alert.priority)}
                          {alert.acknowledged && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                              مقروء
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                        <div className="flex items-center space-x-4 rtl:space-x-reverse text-xs text-gray-500">
                          <span className="flex items-center space-x-1 rtl:space-x-reverse">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimeAgo(alert.timestamp)}</span>
                          </span>
                          <span>المصدر: {alert.source}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      {!alert.acknowledged && (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          تم القراءة
                        </button>
                      )}
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {!isMinimized && alerts.length > 0 && (
        <div className="p-3 bg-gray-50 border-t border-gray-200 text-center">
          <button
            onClick={loadAlerts}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            تحديث التنبيهات
          </button>
        </div>
      )}
    </div>
  );
};

export default RealTimeAlerts;