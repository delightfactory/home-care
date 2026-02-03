import React, { useEffect, useState } from 'react'
import { Save, Settings as SettingsIcon } from 'lucide-react'
import { SettingsAPI } from '../../api'
import { SystemSettings } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import PWASettings from '../../components/Settings/PWASettings'
import NotificationSettings from '../../components/Settings/NotificationSettings'
import toast from 'react-hot-toast'

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const data = await SettingsAPI.getSystemSettings()

      // Convert settings object to array format for UI
      const settingsArray: SystemSettings[] = Object.entries(data).map(([key, value]) => ({
        id: key,
        key,
        value: String(value),
        display_name: key.replace(/_/g, ' '),
        description: '',
        data_type: 'string' as const,
        category: 'عام',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      setSettings(settingsArray)

      // Initialize form data
      const initialData: Record<string, string> = {}
      settingsArray.forEach((setting: SystemSettings) => {
        initialData[setting.key] = setting.value
      })
      setFormData(initialData)
    } catch (error) {
      toast.error('حدث خطأ في تحميل الإعدادات')
      console.error('Settings fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Update each setting
      const updatePromises = Object.entries(formData).map(([key, value]) =>
        SettingsAPI.updateSetting(key, value)
      )

      await Promise.all(updatePromises)
      toast.success('تم حفظ الإعدادات بنجاح')

      // Refresh settings
      await fetchSettings()
    } catch (error) {
      toast.error('حدث خطأ في حفظ الإعدادات')
      console.error('Settings save error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const settingsByCategory = settings.reduce((acc, setting: SystemSettings) => {
    const category = setting.category || 'عام'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(setting)
    return acc
  }, {} as Record<string, SystemSettings[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل الإعدادات..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إعدادات النظام</h1>
          <p className="text-gray-600 mt-1">إدارة إعدادات النظام والتطبيق</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? (
            <LoadingSpinner size="small" />
          ) : (
            <>
              <Save className="h-5 w-5 ml-2" />
              حفظ الإعدادات
            </>
          )}
        </button>
      </div>

      <div className="space-y-6">
        {/* Notification Settings */}
        <NotificationSettings />

        {/* PWA Settings */}
        <PWASettings />

        {Object.entries(settingsByCategory).map(([category, categorySettings]) => (
          <div key={category} className="card">
            <div className="card-header">
              <div className="flex items-center">
                <SettingsIcon className="h-6 w-6 text-gray-600 ml-2" />
                <h3 className="card-title">{category}</h3>
              </div>
            </div>

            <div className="space-y-4">
              {categorySettings.map((setting) => (
                <div key={setting.key} className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                  <div>
                    <label className="label">
                      {setting.display_name || setting.key}
                    </label>
                    {setting.description && (
                      <p className="text-sm text-gray-500 mt-1">{setting.description}</p>
                    )}
                  </div>

                  <div className="lg:col-span-2">
                    {setting.data_type === 'boolean' ? (
                      <select
                        value={formData[setting.key] || setting.value}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        className="input"
                      >
                        <option value="true">نعم</option>
                        <option value="false">لا</option>
                      </select>
                    ) : setting.data_type === 'number' ? (
                      <input
                        type="number"
                        value={formData[setting.key] || setting.value}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        className="input"
                      />
                    ) : setting.data_type === 'json' ? (
                      <textarea
                        value={formData[setting.key] || setting.value}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        className="input"
                        rows={4}
                        placeholder="JSON format"
                      />
                    ) : (
                      <input
                        type="text"
                        value={formData[setting.key] || setting.value}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        className="input"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(settingsByCategory).length === 0 && (
        <div className="card">
          <div className="text-center py-8">
            <SettingsIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">لا توجد إعدادات متاحة</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsPage
