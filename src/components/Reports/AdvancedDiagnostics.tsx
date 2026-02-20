import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Zap, Server, Cpu, Wifi } from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PerformanceMetric {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  responseTime: number;
  activeConnections: number;
}

interface AdvancedDiagnosticsProps {
  timeRange?: '1h' | '6h' | '24h' | '7d';
}

const AdvancedDiagnostics: React.FC<AdvancedDiagnosticsProps> = ({ timeRange = '24h' }) => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'cpu' | 'memory' | 'disk' | 'network' | 'responseTime'>('cpu');

  useEffect(() => {
    loadMetrics();
  }, [timeRange]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      // Simulate API call - replace with actual API
      const mockMetrics: PerformanceMetric[] = [];
      const now = Date.now();
      const interval = timeRange === '1h' ? 60000 : timeRange === '6h' ? 360000 : timeRange === '24h' ? 1440000 : 10080000;
      const points = timeRange === '1h' ? 60 : timeRange === '6h' ? 60 : timeRange === '24h' ? 60 : 168;

      for (let i = points; i >= 0; i--) {
        const timestamp = new Date(now - (i * interval)).toISOString();
        mockMetrics.push({
          timestamp,
          cpu: Math.random() * 100,
          memory: 60 + Math.random() * 30,
          disk: 40 + Math.random() * 20,
          network: Math.random() * 100,
          responseTime: 100 + Math.random() * 200,
          activeConnections: Math.floor(10 + Math.random() * 50)
        });
      }

      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChartData = () => {
    const labels = metrics.map(m => {
      const date = new Date(m.timestamp);
      if (timeRange === '1h') {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      } else if (timeRange === '6h' || timeRange === '24h') {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    });

    const getColor = (metric: string) => {
      const colors = {
        cpu: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgb(59, 130, 246)' },
        memory: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgb(16, 185, 129)' },
        disk: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgb(245, 158, 11)' },
        network: { bg: 'rgba(139, 92, 246, 0.1)', border: 'rgb(139, 92, 246)' },
        responseTime: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgb(239, 68, 68)' }
      };
      return colors[metric as keyof typeof colors];
    };

    const color = getColor(selectedMetric);

    return {
      labels,
      datasets: [
        {
          label: getMetricLabel(selectedMetric),
          data: metrics.map(m => m[selectedMetric]),
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }
      ]
    };
  };

  const getMetricLabel = (metric: string) => {
    const labels = {
      cpu: 'استخدام المعالج (%)',
      memory: 'استخدام الذاكرة (%)',
      disk: 'استخدام القرص (%)',
      network: 'استخدام الشبكة (%)',
      responseTime: 'زمن الاستجابة (ms)'
    };
    return labels[metric as keyof typeof labels];
  };

  const getResourceUsageData = () => {
    const latest = metrics[metrics.length - 1];
    if (!latest) return null;

    return {
      labels: ['المعالج', 'الذاكرة', 'القرص', 'الشبكة'],
      datasets: [
        {
          data: [latest.cpu, latest.memory, latest.disk, latest.network],
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(139, 92, 246, 0.8)'
          ],
          borderColor: [
            'rgb(59, 130, 246)',
            'rgb(16, 185, 129)',
            'rgb(245, 158, 11)',
            'rgb(139, 92, 246)'
          ],
          borderWidth: 2
        }
      ]
    };
  };

  const getAverageMetrics = () => {
    if (metrics.length === 0) return null;

    const avg = {
      cpu: metrics.reduce((sum, m) => sum + m.cpu, 0) / metrics.length,
      memory: metrics.reduce((sum, m) => sum + m.memory, 0) / metrics.length,
      disk: metrics.reduce((sum, m) => sum + m.disk, 0) / metrics.length,
      network: metrics.reduce((sum, m) => sum + m.network, 0) / metrics.length,
      responseTime: metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length,
      activeConnections: metrics.reduce((sum, m) => sum + m.activeConnections, 0) / metrics.length
    };

    return avg;
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        rtl: true
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxTicksLimit: 10
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        rtl: true
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.label}: ${context.parsed.toFixed(1)}%`;
          }
        }
      }
    }
  };

  const averageMetrics = getAverageMetrics();
  const resourceUsageData = getResourceUsageData();

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-500 mt-2 text-center">جاري تحميل التحليلات المتقدمة...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">التحليلات المتقدمة للأداء</h3>
        <p className="text-sm text-gray-600">مراقبة مفصلة لأداء النظام والموارد</p>
      </div>

      {/* Metrics Overview */}
      {averageMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">متوسط استخدام المعالج</p>
                <p className="text-2xl font-bold text-blue-600">{averageMetrics.cpu.toFixed(1)}%</p>
              </div>
              <Cpu className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">متوسط استخدام الذاكرة</p>
                <p className="text-2xl font-bold text-green-600">{averageMetrics.memory.toFixed(1)}%</p>
              </div>
              <Server className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">متوسط زمن الاستجابة</p>
                <p className="text-2xl font-bold text-red-600">{averageMetrics.responseTime.toFixed(0)}ms</p>
              </div>
              <Zap className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">متوسط الاتصالات النشطة</p>
                <p className="text-2xl font-bold text-purple-600">{averageMetrics.activeConnections.toFixed(0)}</p>
              </div>
              <Wifi className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">مراقبة الأداء</h4>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="cpu">استخدام المعالج</option>
              <option value="memory">استخدام الذاكرة</option>
              <option value="disk">استخدام القرص</option>
              <option value="network">استخدام الشبكة</option>
              <option value="responseTime">زمن الاستجابة</option>
            </select>
          </div>
          <div className="h-64">
            <Line data={getChartData()} options={chartOptions} />
          </div>
        </div>

        {/* Resource Usage */}
        {resourceUsageData && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">استخدام الموارد الحالي</h4>
            <div className="h-64">
              <Doughnut data={resourceUsageData} options={doughnutOptions} />
            </div>
          </div>
        )}
      </div>

      {/* Performance Recommendations */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">توصيات تحسين الأداء</h4>
        <div className="space-y-3">
          {averageMetrics && averageMetrics.cpu > 80 && (
            <div className="flex items-start space-x-3 rtl:space-x-reverse p-3 bg-red-50 border border-red-200 rounded-lg">
              <TrendingUp className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">استخدام مرتفع للمعالج</p>
                <p className="text-xs text-red-600">يُنصح بمراجعة العمليات النشطة وتحسين الاستعلامات</p>
              </div>
            </div>
          )}

          {averageMetrics && averageMetrics.memory > 85 && (
            <div className="flex items-start space-x-3 rtl:space-x-reverse p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <TrendingUp className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">استخدام مرتفع للذاكرة</p>
                <p className="text-xs text-yellow-600">يُنصح بتنظيف الكاش وإعادة تشغيل الخدمات غير الضرورية</p>
              </div>
            </div>
          )}

          {averageMetrics && averageMetrics.responseTime > 200 && (
            <div className="flex items-start space-x-3 rtl:space-x-reverse p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <TrendingDown className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800">زمن استجابة بطيء</p>
                <p className="text-xs text-orange-600">يُنصح بتحسين قاعدة البيانات وتحديث فهارس الجداول</p>
              </div>
            </div>
          )}

          {averageMetrics && averageMetrics.cpu < 50 && averageMetrics.memory < 70 && averageMetrics.responseTime < 150 && (
            <div className="flex items-start space-x-3 rtl:space-x-reverse p-3 bg-green-50 border border-green-200 rounded-lg">
              <Activity className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">أداء ممتاز</p>
                <p className="text-xs text-green-600">النظام يعمل بكفاءة عالية ولا يحتاج إلى تحسينات فورية</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedDiagnostics;