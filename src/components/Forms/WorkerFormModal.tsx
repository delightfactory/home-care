import React, { useState, useEffect } from 'react'
import { X, Save, User } from 'lucide-react'
import { WorkersAPI } from '../../api'
import { Worker, WorkerForm } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
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
    salary: 0,
    skills: [],
    can_drive: false
  })
  const [loading, setLoading] = useState(false)
  const [skillInput, setSkillInput] = useState('')

  useEffect(() => {
    if (worker && mode === 'edit') {
      setFormData({
        name: worker.name,
        phone: worker.phone || '',
        hire_date: worker.hire_date,
        salary: worker.salary || 0,
        skills: worker.skills || [],
        can_drive: worker.can_drive || false
      })
    } else {
      setFormData({
        name: '',
        phone: '',
        hire_date: '',
        salary: 0,
        skills: [],
        can_drive: false
      })
    }
  }, [worker, mode, isOpen])

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <User className="h-5 w-5 text-blue-600 ml-2" />
            <h2 className="text-lg font-semibold">
              {mode === 'create' ? 'إضافة عامل جديد' : 'تعديل بيانات العامل'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الاسم الكامل *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="input-field"
              placeholder="أدخل الاسم الكامل"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              رقم الهاتف *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="input-field"
              placeholder="05xxxxxxxx"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              تاريخ التوظيف *
            </label>
            <input
              type="date"
              value={formData.hire_date}
              onChange={(e) => setFormData(prev => ({ ...prev, hire_date: e.target.value }))}
              className="input-field"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الراتب (ج.م)
            </label>
            <input
              type="number"
              value={formData.salary}
              onChange={(e) => setFormData(prev => ({ ...prev, salary: Number(e.target.value) }))}
              className="input-field"
              placeholder="0"
              min="0"
              step="0.01"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              المهارات
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="input-field flex-1"
                placeholder="أدخل مهارة جديدة"
                disabled={loading}
              />
              <button
                type="button"
                onClick={addSkill}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading || !skillInput.trim()}
              >
                إضافة
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.skills.map((skill, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="mr-1 text-blue-600 hover:text-blue-800"
                    disabled={loading}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="can_drive"
              checked={formData.can_drive}
              onChange={(e) => setFormData(prev => ({ ...prev, can_drive: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={loading}
            />
            <label htmlFor="can_drive" className="mr-2 block text-sm text-gray-900">
              يمكنه القيادة
            </label>
          </div>

          <div className="flex justify-end space-x-3 space-x-reverse pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <LoadingSpinner size="small" />
              ) : (
                <>
                  <Save className="h-4 w-4 ml-2" />
                  {mode === 'create' ? 'إضافة' : 'حفظ التغييرات'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default WorkerFormModal
