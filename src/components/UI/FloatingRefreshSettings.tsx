import React, { useState, useEffect } from 'react'
import { Settings, Check } from 'lucide-react'
import SmartModal from './SmartModal'

interface FloatingRefreshSettingsProps {
  isOpen: boolean
  onClose: () => void
}

interface RefreshSettings {
  autoRefresh: boolean
  refreshInterval: number // بالدقائق
  showNotifications: boolean
  refreshOnFocus: boolean
}

const defaultSettings: RefreshSettings = {
  autoRefresh: false,
  refreshInterval: 5,
  showNotifications: true,
  refreshOnFocus: true
}

const FloatingRefreshSettings: React.FC<FloatingRefreshSettingsProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<RefreshSettings>(defaultSettings)
  const [hasChanges, setHasChanges] = useState(false)

  // تحميل الإعدادات من localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('floatingRefreshSettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsed })
      } catch (error) {
        console.warn('Failed to parse refresh settings:', error)
      }
    }
  }, [])

  // حفظ الإعدادات
  const saveSettings = () => {
    localStorage.setItem('floatingRefreshSettings', JSON.stringify(settings))
    setHasChanges(false)
    
    // إرسال حدث لتحديث الإعدادات في المكونات الأخرى
    window.dispatchEvent(new CustomEvent('refreshSettingsChanged', { detail: settings }))
  }

  // تحديث إعداد معين
  const updateSetting = <K extends keyof RefreshSettings>(key: K, value: RefreshSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  return (
    <SmartModal
      isOpen={isOpen}
      onClose={onClose}
      title="إعدادات التحديث"
      subtitle="تخصيص سلوك زر التحديث العائم"
      icon={<Settings className="h-6 w-6" />}
      size="md"
      headerGradient="from-blue-500 via-blue-600 to-blue-700"
    >
      <div className="p-6 space-y-6">
          {/* التحديث التلقائي */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">التحديث التلقائي</label>
              <p className="text-xs text-gray-500">تحديث البيانات تلقائياً في فترات منتظمة</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                id="autoRefresh"
                checked={settings.autoRefresh}
                onChange={(e) => updateSetting('autoRefresh', e.target.checked)}
                className="sr-only"
              />
              <label
                htmlFor="autoRefresh"
                className="flex items-center cursor-pointer transition-all duration-200"
              >
                <div
                  className={`relative w-12 h-6 rounded-full transition-all duration-200 ${
                    settings.autoRefresh
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                      : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                      settings.autoRefresh ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </div>
              </label>
            </div>
          </div>

          {/* فترة التحديث */}
          {settings.autoRefresh && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                فترة التحديث (بالدقائق)
              </label>
              <select
                value={settings.refreshInterval}
                onChange={(e) => updateSetting('refreshInterval', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>كل دقيقة</option>
                <option value={2}>كل دقيقتين</option>
                <option value={5}>كل 5 دقائق</option>
                <option value={10}>كل 10 دقائق</option>
                <option value={15}>كل 15 دقيقة</option>
                <option value={30}>كل 30 دقيقة</option>
              </select>
            </div>
          )}

          {/* إظهار الإشعارات */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">إظهار الإشعارات</label>
              <p className="text-xs text-gray-500">عرض رسائل نجاح/فشل التحديث</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                id="showNotifications"
                checked={settings.showNotifications}
                onChange={(e) => updateSetting('showNotifications', e.target.checked)}
                className="sr-only"
              />
              <label
                htmlFor="showNotifications"
                className="flex items-center cursor-pointer transition-all duration-200"
              >
                <div
                  className={`relative w-12 h-6 rounded-full transition-all duration-200 ${
                    settings.showNotifications
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                      : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                      settings.showNotifications ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </div>
              </label>
            </div>
          </div>

          {/* التحديث عند التركيز */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">التحديث عند التركيز</label>
              <p className="text-xs text-gray-500">تحديث البيانات عند العودة للتطبيق</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                id="refreshOnFocus"
                checked={settings.refreshOnFocus}
                onChange={(e) => updateSetting('refreshOnFocus', e.target.checked)}
                className="sr-only"
              />
              <label
                htmlFor="refreshOnFocus"
                className="flex items-center cursor-pointer transition-all duration-200"
              >
                <div
                  className={`relative w-12 h-6 rounded-full transition-all duration-200 ${
                    settings.refreshOnFocus
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                      : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                      settings.refreshOnFocus ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </div>
              </label>
             </div>
           </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 hover:shadow-sm"
          >
            إلغاء
          </button>
          <button
            onClick={() => {
              saveSettings()
              onClose()
            }}
            disabled={!hasChanges}
            className={`
              px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-all duration-200 flex items-center gap-2 shadow-sm
              ${hasChanges 
                ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-md transform hover:scale-105' 
                : 'bg-gray-400 cursor-not-allowed'
              }
            `}
          >
            <Check className="h-4 w-4" />
            حفظ التغييرات
          </button>
        </div>
    </SmartModal>
  )
}

export default FloatingRefreshSettings
export type { RefreshSettings }