import React, { useState, useEffect } from 'react'
import { X, Save, User, Phone, DollarSign, Award, Car, CheckCircle, Plus, Power } from 'lucide-react'
import { WorkersAPI } from '../../api'
import { Worker, WorkerForm } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
import SmartModal from '../UI/SmartModal'
import DateTimePicker from '../UI/DateTimePicker'
import toast from 'react-hot-toast'

interface WorkerFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  worker?: Worker
  mode: 'create' | 'edit'
}

const WorkerFormModal: React.FC<WorkerFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  worker,
  mode
}) => {
  const [formData, setFormData] = useState<WorkerForm>({
    name: '',
    phone: '',
    hire_date: '',
    salary: undefined,
    skills: [],
    can_drive: false,
    status: 'active'
  })
  const [loading, setLoading] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (worker && mode === 'edit') {
      setFormData({
        name: worker.name,
        phone: worker.phone || '',
        hire_date: worker.hire_date,
        salary: worker.salary || undefined,
        skills: worker.skills || [],
        can_drive: worker.can_drive || false,
        status: worker.status || 'active'
      })
    } else {
      setFormData({
        name: '',
        phone: '',
        hire_date: '',
        salary: undefined,
        skills: [],
        can_drive: false,
        status: 'active'
      })
    }
  }, [worker, mode, isOpen])

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('يرجى إدخال اسم العامل')
      return
    }

    if (!formData.phone.trim()) {
      toast.error('يرجى إدخال رقم الهاتف')
      return
    }

    if (!formData.hire_date) {
      toast.error('يرجى إدخال تاريخ التوظيف')
      return
    }

    setLoading(true)
    try {
      if (mode === 'create') {
        await WorkersAPI.createWorker(formData)
        toast.success('تم إضافة العامل بنجاح')
      } else {
        await WorkersAPI.updateWorker(worker!.id, formData)
        toast.success('تم تحديث بيانات العامل بنجاح')
      }
      
      onSuccess()
      onClose()
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ البيانات')
      console.error('Worker form error:', error)
    } finally {
      setLoading(false)
    }
  }

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, skillInput.trim()]
      }))
      setSkillInput('')
    }
  }

  const removeSkill = (skillToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSkill()
    }
  }

  if (!isOpen) return null

  return (
    <SmartModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'إضافة عامل جديد' : 'تعديل بيانات العامل'}
      subtitle={mode === 'create' ? 'أدخل بيانات العامل الجديد' : 'قم بتعديل بيانات العامل'}
      icon={<User className="h-5 w-5 text-white" />}
      size="md"
      headerGradient="from-primary-500 to-primary-600"
    >

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name Field */}
          <div className="space-y-2">
            <label className="flex items-center label text-gray-700 font-medium">
              <User className="h-4 w-4 ml-2 text-primary-500" />
              الاسم الكامل *
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                onBlur={() => handleBlur('name')}
                className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${
                  touched.name && formData.name ? 'border-green-500 focus:ring-green-500' : ''
                }`}
                placeholder="أدخل الاسم الكامل"
                required
                disabled={loading}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                {touched.name && formData.name ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <User className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
          </div>

          {/* Phone Field */}
          <div className="space-y-2">
            <label className="flex items-center label text-gray-700 font-medium">
              <Phone className="h-4 w-4 ml-2 text-primary-500" />
              رقم الهاتف *
            </label>
            <div className="relative">
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                onBlur={() => handleBlur('phone')}
                className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${
                  touched.phone && formData.phone ? 'border-green-500 focus:ring-green-500' : ''
                }`}
                placeholder="05xxxxxxxx"
                required
                disabled={loading}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                {touched.phone && formData.phone ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Phone className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
          </div>

          {/* Hire Date Field */}
          <DateTimePicker
            type="date"
            value={formData.hire_date}
            onChange={(value) => setFormData(prev => ({ ...prev, hire_date: value }))}
            label="تاريخ التوظيف *"
            placeholder="اختر تاريخ التوظيف"
            required
            disabled={loading}
          />

          {/* Salary Field */}
          <div className="space-y-2">
            <label className="flex items-center label text-gray-700 font-medium">
              <DollarSign className="h-4 w-4 ml-2 text-primary-500" />
              الراتب (ج.م)
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.salary ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, salary: e.target.value ? Number(e.target.value) : undefined }))}
                onBlur={() => handleBlur('salary')}
                className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${
                  touched.salary && formData.salary && formData.salary > 0 ? 'border-green-500 focus:ring-green-500' : ''
                }`}
                placeholder="0"
                min="0"
                step="0.01"
                disabled={loading}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                {touched.salary && formData.salary && formData.salary > 0 ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <DollarSign className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
          </div>

          {/* Skills Field */}
          <div className="space-y-2">
            <label className="flex items-center label text-gray-700 font-medium">
              <Award className="h-4 w-4 ml-2 text-primary-500" />
              المهارات
            </label>
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10"
                  placeholder="أدخل مهارة جديدة"
                  disabled={loading}
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Award className="h-4 w-4 text-gray-400" />
                </div>
              </div>
              <button
                type="button"
                onClick={addSkill}
                className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center"
                disabled={loading || !skillInput.trim()}
              >
                <Plus className="h-4 w-4 ml-1" />
                إضافة
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.skills.map((skill, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 text-sm rounded-lg border border-primary-200 shadow-sm"
                >
                  <Award className="h-3 w-3 ml-1" />
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="mr-2 text-primary-600 hover:text-primary-800 hover:bg-primary-200 rounded-full p-0.5 transition-all duration-200"
                    disabled={loading}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            {formData.skills.length === 0 && (
              <p className="text-xs text-gray-500 italic">لم يتم إضافة مهارات بعد</p>
            )}
          </div>

          {/* Can Drive Toggle */}
          <div className="space-y-2">
            <label className="flex items-center label text-gray-700 font-medium">
              <Car className="h-4 w-4 ml-2 text-primary-500" />
              القدرة على القيادة
            </label>
            <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center">
                <div className="relative">
                  <input
                    type="checkbox"
                    id="can_drive"
                    checked={formData.can_drive}
                    onChange={(e) => setFormData(prev => ({ ...prev, can_drive: e.target.checked }))}
                    className="sr-only"
                    disabled={loading}
                  />
                  <label
                    htmlFor="can_drive"
                    className={`flex items-center cursor-pointer transition-all duration-200 ${
                      formData.can_drive
                        ? 'text-primary-600'
                        : 'text-gray-500'
                    }`}
                  >
                    <div
                      className={`relative w-12 h-6 rounded-full transition-all duration-200 ${
                        formData.can_drive
                          ? 'bg-gradient-to-r from-primary-500 to-primary-600'
                          : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                          formData.can_drive ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </div>
                    <span className="mr-3 font-medium">
                      {formData.can_drive ? 'يمكنه القيادة' : 'لا يمكنه القيادة'}
                    </span>
                    {formData.can_drive && (
                      <CheckCircle className="h-4 w-4 text-primary-600 mr-2" />
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Status Toggle */}
          <div className="space-y-2">
            <label className="flex items-center label text-gray-700 font-medium">
              <Power className="h-4 w-4 ml-2 text-primary-500" />
              حالة العامل
            </label>
            <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center">
                <div className="relative">
                  <input
                    type="checkbox"
                    id="worker_status"
                    checked={formData.status === 'active'}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.checked ? 'active' : 'inactive' }))}
                    className="sr-only"
                    disabled={loading}
                  />
                  <label
                    htmlFor="worker_status"
                    className={`flex items-center cursor-pointer transition-all duration-200 ${
                      formData.status === 'active'
                        ? 'text-green-600'
                        : 'text-red-500'
                    }`}
                  >
                    <div
                      className={`relative w-12 h-6 rounded-full transition-all duration-200 ${
                        formData.status === 'active'
                          ? 'bg-gradient-to-r from-green-500 to-green-600'
                          : 'bg-gradient-to-r from-red-500 to-red-600'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                          formData.status === 'active' ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </div>
                    <span className="mr-3 font-medium">
                      {formData.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                    {formData.status === 'active' && (
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 space-x-reverse pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center">
                  <LoadingSpinner size="small" />
                  <span className="mr-2">جاري الحفظ...</span>
                </div>
              ) : (
                <div className="flex items-center">
                  <Save className="h-4 w-4 ml-2" />
                  {mode === 'create' ? 'إضافة العامل' : 'حفظ التغييرات'}
                </div>
              )}
            </button>
          </div>
        </form>
    </SmartModal>
  )
}

export default WorkerFormModal
