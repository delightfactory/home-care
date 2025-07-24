import React from 'react'
import { TrendingUp, AlertTriangle, Info, AlertCircle, Award, Clock, Star } from 'lucide-react'

interface TopPerformer {
  name: string
  metric: string
  value: number
}

interface Improvement {
  area: string
  suggestion: string
  impact: 'high' | 'medium' | 'low'
}

interface Alert {
  type: 'warning' | 'info' | 'error'
  message: string
}

interface PerformanceInsightsProps {
  insights: {
    topPerformers: TopPerformer[]
    improvements: Improvement[]
    alerts: Alert[]
  }
}

const PerformanceInsights: React.FC<PerformanceInsightsProps> = ({ insights }) => {
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
    }
  }

  const getAlertBgColor = (type: Alert['type']) => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'info':
        return 'bg-blue-50 border-blue-200'
      case 'error':
        return 'bg-red-50 border-red-200'
    }
  }

  const getImpactColor = (impact: Improvement['impact']) => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
    }
  }

  const getPerformerIcon = (metric: string) => {
    if (metric.includes('إيرادات')) return <TrendingUp className="h-5 w-5 text-green-500" />
    if (metric.includes('تقييم')) return <Star className="h-5 w-5 text-yellow-500" />
    if (metric.includes('إنجاز')) return <Clock className="h-5 w-5 text-blue-500" />
    return <Award className="h-5 w-5 text-purple-500" />
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Top Performers */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center mb-4">
          <Award className="h-6 w-6 text-yellow-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">أفضل الأداءات</h3>
        </div>
        
        <div className="space-y-4">
          {insights.topPerformers.map((performer, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                {getPerformerIcon(performer.metric)}
                <div className="mr-3">
                  <p className="font-medium text-gray-900">{performer.name}</p>
                  <p className="text-sm text-gray-600">{performer.metric}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg text-gray-900">
                  {typeof performer.value === 'number' && performer.value > 100 
                    ? `${performer.value.toLocaleString()}` 
                    : performer.value}
                  {performer.metric.includes('تقييم') && '%'}
                  {performer.metric.includes('إيرادات') && ' ج.م'}
                  {performer.metric.includes('إنجاز') && '%'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Improvement Suggestions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-6 w-6 text-blue-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">اقتراحات التحسين</h3>
        </div>
        
        <div className="space-y-4">
          {insights.improvements.map((improvement, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{improvement.area}</h4>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getImpactColor(improvement.impact)}`}>
                  {improvement.impact === 'high' ? 'تأثير عالي' : 
                   improvement.impact === 'medium' ? 'تأثير متوسط' : 'تأثير منخفض'}
                </span>
              </div>
              <p className="text-sm text-gray-600">{improvement.suggestion}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts and Notifications */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-6 w-6 text-orange-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">التنبيهات والإشعارات</h3>
        </div>
        
        <div className="space-y-3">
          {insights.alerts.map((alert, index) => (
            <div key={index} className={`border rounded-lg p-4 ${getAlertBgColor(alert.type)}`}>
              <div className="flex items-start">
                <div className="flex-shrink-0 mr-3 mt-0.5">
                  {getAlertIcon(alert.type)}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{alert.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PerformanceInsights