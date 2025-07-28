import React, { useState, useCallback, useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { eventBus } from '../../utils/EventBus'
import { EnhancedAPI } from '../../api/enhanced-api'
import { ReportsAPI } from '../../api/reports'
import { ViewOptimizer } from '../../api/view-optimizer'
import FloatingRefreshSettings, { RefreshSettings } from './FloatingRefreshSettings'

interface FloatingRefreshButtonProps {
  className?: string
}

const FloatingRefreshButton: React.FC<FloatingRefreshButtonProps> = ({ className = '' }) => {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showTooltip, setShowTooltip] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<RefreshSettings>({
    autoRefresh: false,
    refreshInterval: 5,
    showNotifications: true,
    refreshOnFocus: true
  })
  const location = useLocation()
  const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null)
  const lastActivityTime = useRef<number>(Date.now())
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const [isLongPressing, setIsLongPressing] = useState(false)

  // تحميل الإعدادات من localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('floatingRefreshSettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings(prev => ({ ...prev, ...parsed }))
      } catch (error) {
        console.warn('Failed to parse refresh settings:', error)
      }
    }
  }, [])

  // مراقبة حالة الاتصال
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // مراقبة تغيير الإعدادات
  useEffect(() => {
    const handleSettingsChange = (event: CustomEvent<RefreshSettings>) => {
      setSettings(event.detail)
    }

    window.addEventListener('refreshSettingsChanged', handleSettingsChange as EventListener)
    return () => {
      window.removeEventListener('refreshSettingsChanged', handleSettingsChange as EventListener)
    }
  }, [])

  // التحديث التلقائي
  useEffect(() => {
    if (settings.autoRefresh && isOnline && !isRefreshing) {
      autoRefreshInterval.current = setInterval(() => {
        const timeSinceLastActivity = Date.now() - lastActivityTime.current
        // تحديث تلقائي فقط إذا لم يكن هناك نشاط حديث (آخر 30 ثانية)
        if (timeSinceLastActivity > 30000) {
          handleRefresh(true) // true يعني تحديث صامت
        }
      }, settings.refreshInterval * 60 * 1000)
    } else {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current)
        autoRefreshInterval.current = null
      }
    }

    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current)
      }
    }
  }, [settings.autoRefresh, settings.refreshInterval, isOnline, isRefreshing])

  // مراقبة التركيز على النافذة
  useEffect(() => {
    if (!settings.refreshOnFocus) return

    const handleFocus = () => {
      const timeSinceLastRefresh = lastRefresh ? Date.now() - lastRefresh.getTime() : Infinity
      // تحديث عند التركيز إذا مر أكثر من دقيقتين على آخر تحديث
      if (timeSinceLastRefresh > 2 * 60 * 1000) {
        handleRefresh(true) // تحديث صامت
      }
    }

    const handleActivity = () => {
      lastActivityTime.current = Date.now()
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('click', handleActivity)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('click', handleActivity)
    }
  }, [settings.refreshOnFocus, lastRefresh])

  // تحديد نوع البيانات المطلوب تحديثها حسب الصفحة الحالية
  const getRefreshEvents = useCallback(() => {
    const path = location.pathname
    const events: string[] = []

    switch (path) {
      case '/dashboard':
        events.push('orders:changed', 'routes:changed', 'expenses:changed', 'customers:changed', 'teams:changed', 'workers:changed')
        break
      case '/customers':
        events.push('customers:changed')
        break
      case '/services':
        events.push('services:changed')
        break
      case '/orders':
        events.push('orders:changed', 'customers:changed')
        break
      case '/workers':
        events.push('workers:changed')
        break
      case '/teams':
        events.push('teams:changed', 'workers:changed')
        break
      case '/routes':
        events.push('routes:changed', 'orders:changed', 'workers:changed')
        break
      case '/expenses':
        events.push('expenses:changed')
        break
      case '/operations':
        events.push('routes:changed', 'orders:changed', 'expenses:changed', 'teams:changed', 'workers:changed')
        break
      case '/reports':
        events.push('orders:changed', 'routes:changed', 'expenses:changed', 'customers:changed', 'teams:changed', 'workers:changed')
        break
      case '/settings':
        events.push('teams:changed', 'workers:changed')
        break
      default:
        // للصفحات الأخرى، تحديث جميع البيانات
        events.push('orders:changed', 'routes:changed', 'expenses:changed', 'customers:changed', 'teams:changed', 'workers:changed', 'services:changed')
    }

    return events
  }, [location.pathname])

  // وظيفة التحديث الذكي
  const handleRefresh = useCallback(async (silent = false) => {
    if (isRefreshing) return

    setIsRefreshing(true)
    lastActivityTime.current = Date.now()
    
    try {
      const path = location.pathname
      const events = getRefreshEvents()

      // مسح الكاش أولاً للحصول على بيانات محدثة
      EnhancedAPI.clearCache()

      // تحديث خاص للتقارير
      if (path === '/reports') {
        try {
          await ReportsAPI.refreshMaterializedViews()
          await ViewOptimizer.refreshAllViews()
        } catch (error) {
          console.warn('Reports refresh warning:', error)
        }
      }

      // إرسال أحداث التحديث للمكونات المختلفة
      events.forEach(event => {
        eventBus.emit(event, { source: 'floating-refresh', timestamp: Date.now() })
      })

      // رسالة نجاح مخصصة حسب الصفحة
      const pageNames: Record<string, string> = {
        '/dashboard': 'لوحة التحكم',
        '/customers': 'العملاء',
        '/services': 'الخدمات',
        '/orders': 'الطلبات',
        '/workers': 'العمال',
        '/teams': 'الفرق',
        '/routes': 'خطوط السير',
        '/expenses': 'المصروفات',
        '/operations': 'العمليات',
        '/reports': 'التقارير',
        '/settings': 'الإعدادات'
      }

      const pageName = pageNames[path] || 'الصفحة'
      
      // إظهار الإشعار فقط إذا لم يكن التحديث صامتاً والإعدادات تسمح بذلك
      if (!silent && settings.showNotifications) {
        toast.success(`تم تحديث بيانات ${pageName} بنجاح`)
      }
      
      setLastRefresh(new Date())

    } catch (error) {
      console.error('Refresh error:', error)
      
      // إظهار رسالة الخطأ دائماً (حتى في التحديث الصامت)
      if (settings.showNotifications) {
        toast.error('حدث خطأ أثناء تحديث البيانات')
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, location.pathname, getRefreshEvents, settings.showNotifications])

  // تنسيق وقت آخر تحديث
  const formatLastRefresh = useCallback(() => {
    if (!lastRefresh) return 'لم يتم التحديث بعد'
    
    const now = new Date()
    const diff = now.getTime() - lastRefresh.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'منذ لحظات'
    if (minutes < 60) return `منذ ${minutes} دقيقة`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `منذ ${hours} ساعة`
    
    return lastRefresh.toLocaleDateString('ar-SA')
  }, [lastRefresh])

  // وظائف الضغط الطويل
  const handleMouseDown = useCallback(() => {
    setIsLongPressing(true)
    longPressTimer.current = setTimeout(() => {
      setShowSettings(true)
      setIsLongPressing(false)
    }, 800) // 800ms للضغط الطويل
  }, [])

  const handleMouseUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
      
      // إذا كان المؤقت ما زال يعمل، فهذا يعني أنه لم يكن ضغط طويل
      // لذا يجب تنفيذ التحديث الصامت
      if (isLongPressing && !showSettings) {
        handleRefresh(true) // التحديث الصامت
      }
    }
    
    setIsLongPressing(false)
  }, [isLongPressing, showSettings, handleRefresh])

  const handleMouseLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    setIsLongPressing(false)
    setShowTooltip(false)
  }, [])

  // تنظيف المؤقتات عند إلغاء المكون
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
      }
    }
  }, [])

  // إخفاء الزر في صفحات المصادقة
  if (location.pathname === '/login' || location.pathname === '/signup') {
    return null
  }

  return (
    <>
      <div className="fixed bottom-4 left-4 z-50">
        {/* Main Refresh Button */}
        <div className="relative">
          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute bottom-12 left-0 bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl border border-gray-700">
              <div className="font-medium text-xs">تحديث البيانات</div>
              <div className="text-gray-300 text-xs">{formatLastRefresh()}</div>
              {settings.autoRefresh && (
                <div className="text-green-300 text-xs">تلقائي: {settings.refreshInterval}د</div>
              )}
              <div className="text-blue-300 text-xs mt-0.5">ضغط طويل للإعدادات</div>
              <div className="absolute -bottom-1 left-3 w-1.5 h-1.5 bg-gray-900 transform rotate-45 border-r border-b border-gray-700"></div>
            </div>
          )}
      
      <button
        disabled={isRefreshing || !isOnline}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        className={`
          relative
          w-10 h-10 
          ${isOnline 
            ? isLongPressing 
              ? 'bg-gradient-to-br from-purple-500 to-purple-600 shadow-purple-500/25' 
              : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/25'
            : 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-500/25'
          }
          text-white 
          rounded-full 
          shadow-lg hover:shadow-xl 
          transition-all duration-200 
          transform hover:scale-105 
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center
          group
          border border-white/20
          ${className}
          ${isLongPressing ? 'scale-95' : ''}
        `}
        title={isOnline ? "تحديث البيانات (اضغط مطولاً للإعدادات)" : "غير متصل بالإنترنت"}
        aria-label={isOnline ? "تحديث البيانات (اضغط مطولاً للإعدادات)" : "غير متصل بالإنترنت"}
      >
        <RefreshCw 
          className={`
            h-4 w-4 
            transition-transform duration-200
            ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180'}
          `} 
        />
        
        {/* مؤشر حالة الاتصال */}
        <div className="absolute -top-0.5 -right-0.5">
          {isOnline ? (
            <div className="w-2.5 h-2.5 bg-green-400 rounded-full border border-white shadow-sm" />
          ) : (
            <div className="w-2.5 h-2.5 bg-red-400 rounded-full border border-white shadow-sm" />
          )}
        </div>
        
        {/* مؤشر التحديث التلقائي */}
        {settings.autoRefresh && (
          <div className="absolute -bottom-0.5 -right-0.5">
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse border border-white shadow-sm" title="التحديث التلقائي مفعل" />
          </div>
        )}
        
        {/* مؤشر التحميل */}
        {isRefreshing && (
          <div className="absolute inset-0 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        )}
         </button>
        </div>
      </div>
      
      {/* Settings Modal */}
      <FloatingRefreshSettings 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </>
  )
}

export default FloatingRefreshButton