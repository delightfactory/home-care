import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info, ChevronDown, ChevronUp, Activity, Database, HardDrive, Wifi, FileText, BarChart3 } from 'lucide-react';
import SystemErrorLog from './SystemErrorLog';
import AdvancedDiagnostics from './AdvancedDiagnostics';

interface SystemHealthData {
  status: 'healthy' | 'warning' | 'error';
  last_updated: string;
  database: {
    status: 'healthy' | 'warning' | 'error';
    response_time_ms: number;
    connection_count: number;
    error_message?: string;
  };
  memory: {
    used: number;
    threshold: number;
    warning: boolean;
    percentage: number;
  };
  cache: {
    stats: {
      size: number;
      hit_rate: number;
      keys: string[];
    };
    status: 'healthy' | 'warning' | 'error';
  };
  connections: {
    active: number;
    max: number;
    status: 'healthy' | 'warning' | 'error';
  };
}

interface SystemHealthDetailsProps {
  health: SystemHealthData;
  onRefresh?: () => void;
}

const SystemHealthDetails: React.FC<SystemHealthDetailsProps> = ({ health, onRefresh }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'database' | 'memory' | 'cache' | 'connections'>('database');
  const [showErrorLog, setShowErrorLog] = useState(false);
  const [showAdvancedDiagnostics, setShowAdvancedDiagnostics] = useState(false);

  // التأكد من وجود البيانات المطلوبة
  if (!health || !health.database || !health.memory || !health.cache || !health.connections) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-center text-gray-500">
          <Info className="h-5 w-5 mr-2" />
          جاري تحميل بيانات حالة النظام...
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDatabaseStatusMessage = () => {
    const { database } = health;
    if (database.status === 'healthy') {
      return `قاعدة البيانات تعمل بشكل طبيعي (${database.response_time_ms}ms)`;
    } else if (database.status === 'warning') {
      return `استجابة بطيئة من قاعدة البيانات (${database.response_time_ms}ms)`;
    } else {
      return database.error_message || 'خطأ في الاتصال بقاعدة البيانات';
    }
  };

  const getMemoryStatusMessage = () => {
    const { memory } = health;
    const percentage = memory.percentage || 0;
    if (memory.warning) {
      return `استهلاك ذاكرة مرتفع: ${formatBytes(memory.used || 0)} (${percentage.toFixed(1)}%)`;
    }
    return `استهلاك الذاكرة طبيعي: ${formatBytes(memory.used || 0)} (${percentage.toFixed(1)}%)`;
  };

  const getCacheStatusMessage = () => {
    const { cache } = health;
    const hitRate = cache.stats?.hit_rate ? (cache.stats.hit_rate * 100).toFixed(1) : '0';
    if (cache.status === 'healthy') {
      return `الكاش يعمل بكفاءة (معدل النجاح: ${hitRate}%)`;
    } else if (cache.status === 'warning') {
      return `كفاءة الكاش منخفضة (معدل النجاح: ${hitRate}%)`;
    }
    return 'مشكلة في نظام الكاش';
  };

  const getConnectionsStatusMessage = () => {
    const { connections } = health;
    const active = connections.active || 0;
    const max = connections.max || 1;
    const percentage = ((active / max) * 100).toFixed(1);
    if (connections.status === 'healthy') {
      return `الاتصالات طبيعية: ${active}/${max} (${percentage}%)`;
    } else if (connections.status === 'warning') {
      return `اتصالات مرتفعة: ${active}/${max} (${percentage}%)`;
    }
    return `تجاوز الحد الأقصى للاتصالات: ${active}/${max}`;
  };

  const tabs = [
    {
      id: 'database' as const,
      label: 'قاعدة البيانات',
      icon: Database,
      status: health.database.status,
      message: getDatabaseStatusMessage()
    },
    {
      id: 'memory' as const,
      label: 'الذاكرة',
      icon: HardDrive,
      status: health.memory.warning ? 'warning' : 'healthy',
      message: getMemoryStatusMessage()
    },
    {
      id: 'cache' as const,
      label: 'الكاش',
      icon: Activity,
      status: health.cache.status,
      message: getCacheStatusMessage()
    },
    {
      id: 'connections' as const,
      label: 'الاتصالات',
      icon: Wifi,
      status: health.connections.status,
      message: getConnectionsStatusMessage()
    }
  ];

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'database':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">وقت الاستجابة</div>
                <div className="text-lg font-semibold">{health.database.response_time_ms}ms</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">عدد الاتصالات</div>
                <div className="text-lg font-semibold">{health.database.connection_count}</div>
              </div>
            </div>
            {health.database.error_message && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-sm text-red-700">
                  <strong>رسالة الخطأ:</strong> {health.database.error_message}
                </div>
              </div>
            )}
            <div className="text-sm text-gray-600">
              <strong>التوصيات:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {health.database.response_time_ms > 1000 && (
                  <li>تحسين استعلامات قاعدة البيانات</li>
                )}
                {health.database.connection_count > 8 && (
                  <li>مراجعة إدارة الاتصالات</li>
                )}
                <li>مراقبة أداء الخادم</li>
              </ul>
            </div>
          </div>
        );

      case 'memory':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">الذاكرة المستخدمة</div>
                <div className="text-lg font-semibold">{formatBytes(health.memory.used || 0)}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">الحد الأقصى</div>
                <div className="text-lg font-semibold">{formatBytes(health.memory.threshold || 0)}</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-300 ${
                  (health.memory.percentage || 0) > 80 ? 'bg-red-500' :
                  (health.memory.percentage || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(health.memory.percentage || 0, 100)}%` }}
              />
            </div>
            <div className="text-sm text-gray-600">
              <strong>التوصيات:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {health.memory.warning && (
                  <>
                    <li>تنظيف الكاش المؤقت</li>
                    <li>إعادة تشغيل التطبيق إذا لزم الأمر</li>
                  </>
                )}
                <li>مراقبة استهلاك الذاكرة بانتظام</li>
              </ul>
            </div>
          </div>
        );

      case 'cache':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">عدد العناصر</div>
                <div className="text-lg font-semibold">{health.cache.stats?.size || 0}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">معدل النجاح</div>
                <div className="text-lg font-semibold">{health.cache.stats?.hit_rate ? (health.cache.stats.hit_rate * 100).toFixed(1) : '0'}%</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">المفاتيح النشطة</div>
                <div className="text-lg font-semibold">{health.cache.stats?.keys?.length || 0}</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <strong>التوصيات:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {(health.cache.stats?.hit_rate || 0) < 0.7 && (
                  <li>مراجعة استراتيجية التخزين المؤقت</li>
                )}
                {(health.cache.stats?.size || 0) > 1000 && (
                  <li>تنظيف العناصر المنتهية الصلاحية</li>
                )}
                <li>تحسين مدة صلاحية الكاش</li>
              </ul>
            </div>
          </div>
        );

      case 'connections':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">الاتصالات النشطة</div>
                <div className="text-lg font-semibold">{health.connections.active || 0}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">الحد الأقصى</div>
                <div className="text-lg font-semibold">{health.connections.max || 0}</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-300 ${
                  ((health.connections.active || 0) / (health.connections.max || 1)) > 0.8 ? 'bg-red-500' :
                  ((health.connections.active || 0) / (health.connections.max || 1)) > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${((health.connections.active || 0) / (health.connections.max || 1)) * 100}%` }}
              />
            </div>
            <div className="text-sm text-gray-600">
              <strong>التوصيات:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {((health.connections.active || 0) / (health.connections.max || 1)) > 0.8 && (
                  <>
                    <li>زيادة الحد الأقصى للاتصالات</li>
                    <li>تحسين إدارة pool الاتصالات</li>
                  </>
                )}
                <li>مراقبة أنماط الاستخدام</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${
              health.status === 'healthy' ? 'bg-green-500' :
              health.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <div>
              <h4 className="font-medium text-gray-900 flex items-center">
                حالة النظام
                {getStatusIcon(health.status)}
              </h4>
              <p className="text-sm text-gray-600">
                {health.status === 'healthy' ? 'النظام يعمل بشكل طبيعي' :
                 health.status === 'warning' ? 'تحذير: يوجد مشاكل طفيفة' :
                 'خطأ: يوجد مشاكل في النظام'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="text-sm text-gray-500">
              آخر تحديث: {new Date(health.last_updated).toLocaleTimeString('ar-SA')}
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                تحديث
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-gray-600"
            >
              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Status Overview */}
      <div className="p-4 bg-gray-50">
        <div className="grid grid-cols-4 gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <div
                key={tab.id}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTab === tab.id ? 'bg-white border-blue-200' : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedTab(tab.id)}
              >
                <Icon className="h-4 w-4 mr-2 text-gray-600" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{tab.label}</div>
                  <div className="flex items-center mt-1">
                    {getStatusIcon(tab.status)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="p-6 border-t border-gray-200">
          {/* Tab Navigation */}
          <div className="flex space-x-1 rtl:space-x-reverse mb-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTab === tab.id
                      ? `${getStatusColor(tab.status)} border`
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                  {getStatusIcon(tab.status)}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="mb-4">
              <h5 className="font-medium text-gray-900 mb-2">
                {tabs.find(tab => tab.id === selectedTab)?.label}
              </h5>
              <p className="text-sm text-gray-600">
                {tabs.find(tab => tab.id === selectedTab)?.message}
              </p>
            </div>
            {renderTabContent()}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
            <button
              onClick={() => setShowErrorLog(!showErrorLog)}
              className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <FileText className="h-4 w-4 mr-2" />
              {showErrorLog ? 'إخفاء سجل الأخطاء' : 'عرض سجل الأخطاء التفصيلي'}
            </button>
            
            <button
              onClick={() => setShowAdvancedDiagnostics(!showAdvancedDiagnostics)}
              className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {showAdvancedDiagnostics ? 'إخفاء التحليلات المتقدمة' : 'عرض التحليلات المتقدمة'}
            </button>
          </div>
        </div>
      )}

      {/* Error Log Section */}
      {showErrorLog && (
        <div className="mt-6">
          <SystemErrorLog />
        </div>
      )}

      {/* Advanced Diagnostics Section */}
      {showAdvancedDiagnostics && (
        <div className="mt-6">
          <AdvancedDiagnostics />
        </div>
      )}
    </div>
  );
};

export default SystemHealthDetails;