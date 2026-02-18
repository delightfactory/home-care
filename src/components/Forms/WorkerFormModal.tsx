import React, { useState, useEffect } from 'react'
import { X, Save, User, Phone, DollarSign, Award, Car, CheckCircle, Plus, Power, UserPlus, Link2, Unlink, RefreshCw, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { WorkersAPI } from '../../api'
import { UsersAPI } from '../../lib/api/users'
import { Worker, WorkerForm } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
import SmartModal from '../UI/SmartModal'
import DateTimePicker from '../UI/DateTimePicker'
import toast from 'react-hot-toast'
import { usePermissions } from '../../hooks/usePermissions'

// نوع خيارات ربط المستخدم
type UserLinkOption = 'none' | 'existing' | 'new' | 'linked'

// دالة مساعدة لتوليد كلمة مرور عشوائية
const generatePassword = (length: number = 12): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

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
  const { hasRole } = usePermissions()
  const isSupervisor = hasRole('operations_supervisor')

  // حالات ربط المستخدم
  const [userLinkOption, setUserLinkOption] = useState<UserLinkOption>('none')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [unlinkedUsers, setUnlinkedUsers] = useState<{ id: string; full_name: string; phone: string | null }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [linkedUserInfo, setLinkedUserInfo] = useState<{ id: string; full_name: string; phone: string | null } | null>(null)

  // بيانات إنشاء مستخدم جديد
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (worker && mode === 'edit') {
      setFormData({
        name: worker.name,
        phone: worker.phone || '',
        hire_date: worker.hire_date,
        termination_date: (worker as any).termination_date || undefined,
        salary: worker.salary || undefined,
        skills: worker.skills || [],
        can_drive: worker.can_drive || false,
        status: worker.status || 'active'
      })
      // إذا كان العامل مرتبط بمستخدم
      if (worker.user_id) {
        setUserLinkOption('linked')
        setSelectedUserId(worker.user_id)
        setLinkedUserInfo({
          id: worker.user_id,
          full_name: worker.name,
          phone: worker.phone
        })
      } else {
        setUserLinkOption('none')
        setSelectedUserId('')
        setLinkedUserInfo(null)
      }
    } else {
      setFormData({
        name: '',
        phone: '',
        hire_date: '',
        termination_date: undefined,
        salary: undefined,
        skills: [],
        can_drive: false,
        status: 'active'
      })
      setUserLinkOption('none')
      setSelectedUserId('')
      setNewUserEmail('')
      setNewUserPassword('')
    }
  }, [worker, mode, isOpen])

  // جلب المستخدمين غير المرتبطين عند فتح المودال
  useEffect(() => {
    if (isOpen && userLinkOption === 'existing') {
      fetchUnlinkedUsers()
    }
  }, [isOpen, userLinkOption])

  const fetchUnlinkedUsers = async () => {
    setLoadingUsers(true)
    try {
      const result = await UsersAPI.getUnlinkedUsers()
      if (result.success && result.data) {
        setUnlinkedUsers(result.data)
      }
    } catch (error) {
      console.error('Error fetching unlinked users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

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

    // ⭐ Fix #11: التحقق من أن تاريخ انتهاء الخدمة بعد تاريخ التوظيف
    if (formData.termination_date && formData.hire_date && formData.termination_date < formData.hire_date) {
      toast.error('تاريخ انتهاء الخدمة يجب أن يكون بعد تاريخ التوظيف')
      return
    }

    setLoading(true)
    try {
      if (mode === 'create') {
        // التحقق من خيار ربط المستخدم
        if (userLinkOption === 'new') {
          // إنشاء فني جديد (مستخدم + عامل)
          if (!newUserEmail || !newUserPassword) {
            toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور')
            setLoading(false)
            return
          }

          const result = await UsersAPI.createTechnician({
            email: newUserEmail,
            password: newUserPassword,
            full_name: formData.name,
            phone: formData.phone,
            skills: formData.skills,
            can_drive: formData.can_drive,
            salary: formData.salary
          })

          if (!result.success) {
            toast.error(result.error || 'فشل في إنشاء الفني')
            setLoading(false)
            return
          }

          toast.success('تم إنشاء الفني وحساب المستخدم بنجاح')
        } else {
          // إنشاء عامل فقط
          const workerData = {
            ...formData,
            user_id: userLinkOption === 'existing' && selectedUserId ? selectedUserId : undefined
          }
          await WorkersAPI.createWorker(workerData)
          toast.success('تم إضافة العامل بنجاح')
        }
      } else {
        // تحديث العامل
        const updateData = { ...formData }

        // التعامل مع ربط/إلغاء ربط المستخدم
        if (userLinkOption === 'none' && worker?.user_id) {
          // إلغاء الربط
          await UsersAPI.unlinkWorkerFromUser(worker.id)
        } else if (userLinkOption === 'existing' && selectedUserId && selectedUserId !== worker?.user_id) {
          // ربط بمستخدم موجود
          await UsersAPI.linkWorkerToUser(worker!.id, selectedUserId)
        } else if (userLinkOption === 'new') {
          // إنشاء مستخدم جديد وربطه بالعامل
          if (!newUserEmail || !newUserPassword) {
            toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور')
            setLoading(false)
            return
          }

          const createResult = await UsersAPI.createUserForExistingWorker({
            email: newUserEmail,
            password: newUserPassword,
            full_name: formData.name,
            phone: formData.phone,
            workerId: worker!.id
          })

          if (!createResult.success) {
            toast.error(createResult.error || 'فشل في إنشاء المستخدم')
            setLoading(false)
            return
          }

          toast.success('تم إنشاء حساب المستخدم وربطه بالعامل بنجاح')
        }

        await WorkersAPI.updateWorker(worker!.id, updateData)
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
              className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${touched.name && formData.name ? 'border-green-500 focus:ring-green-500' : ''
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
              className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${touched.phone && formData.phone ? 'border-green-500 focus:ring-green-500' : ''
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

        {/* Termination Date Field — edit mode only */}
        {mode === 'edit' && (
          <DateTimePicker
            type="date"
            value={formData.termination_date || ''}
            onChange={(value) => setFormData(prev => ({ ...prev, termination_date: value || undefined }))}
            label="تاريخ إنهاء الخدمة"
            placeholder="اختر تاريخ إنهاء الخدمة (اختيارى)"
            disabled={loading}
          />
        )}

        {/* Salary Field — hidden for supervisor */}
        {!isSupervisor && (
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
                className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${touched.salary && formData.salary && formData.salary > 0 ? 'border-green-500 focus:ring-green-500' : ''
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
        )}

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
                  className={`flex items-center cursor-pointer transition-all duration-200 ${formData.can_drive
                    ? 'text-primary-600'
                    : 'text-gray-500'
                    }`}
                >
                  <div
                    className={`relative w-12 h-6 rounded-full transition-all duration-200 ${formData.can_drive
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600'
                      : 'bg-gray-300'
                      }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${formData.can_drive ? 'right-0.5' : 'left-0.5'
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
                  className={`flex items-center cursor-pointer transition-all duration-200 ${formData.status === 'active'
                    ? 'text-green-600'
                    : 'text-red-500'
                    }`}
                >
                  <div
                    className={`relative w-12 h-6 rounded-full transition-all duration-200 ${formData.status === 'active'
                      ? 'bg-gradient-to-r from-green-500 to-green-600'
                      : 'bg-gradient-to-r from-red-500 to-red-600'
                      }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${formData.status === 'active' ? 'right-0.5' : 'left-0.5'
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

        {/* User Account Linking Section */}
        <div className="space-y-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
          <div className="flex items-center text-gray-700 font-medium">
            <UserPlus className="h-4 w-4 ml-2 text-blue-500" />
            ربط بحساب مستخدم
          </div>

          {/* Option Buttons - Using div with onClick instead of radio inputs */}
          <div className="space-y-3">
            {/* Option 0: Already Linked (only in edit mode) */}
            {mode === 'edit' && linkedUserInfo && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => !loading && setUserLinkOption('linked')}
                onKeyDown={(e) => e.key === 'Enter' && !loading && setUserLinkOption('linked')}
                className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 select-none ${userLinkOption === 'linked'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-green-300'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <User className={`h-5 w-5 ml-3 ${userLinkOption === 'linked' ? 'text-green-500' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <span className="font-medium text-gray-700">مرتبط بحساب</span>
                  <p className="text-xs text-green-600 font-medium">{linkedUserInfo.full_name}</p>
                  {linkedUserInfo.phone && <p className="text-xs text-gray-500">{linkedUserInfo.phone}</p>}
                </div>
                {userLinkOption === 'linked' && <CheckCircle className="h-5 w-5 text-green-500 mr-auto" />}
              </div>
            )}

            {/* Option 1: No Account */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => !loading && setUserLinkOption('none')}
              onKeyDown={(e) => e.key === 'Enter' && !loading && setUserLinkOption('none')}
              className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 select-none ${userLinkOption === 'none'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-300'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Unlink className={`h-5 w-5 ml-3 ${userLinkOption === 'none' ? 'text-blue-500' : 'text-gray-400'}`} />
              <div>
                <span className="font-medium text-gray-700">{mode === 'edit' && linkedUserInfo ? 'إلغاء الربط' : 'بدون حساب'}</span>
                <p className="text-xs text-gray-500">{mode === 'edit' && linkedUserInfo ? 'سيتم فك ارتباط العامل بالحساب' : 'عامل بدون تسجيل دخول للنظام'}</p>
              </div>
              {userLinkOption === 'none' && <CheckCircle className="h-5 w-5 text-blue-500 mr-auto" />}
            </div>

            {/* Option 2: Link Existing */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => !loading && setUserLinkOption('existing')}
              onKeyDown={(e) => e.key === 'Enter' && !loading && setUserLinkOption('existing')}
              className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 select-none ${userLinkOption === 'existing'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-300'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Link2 className={`h-5 w-5 ml-3 ${userLinkOption === 'existing' ? 'text-blue-500' : 'text-gray-400'}`} />
              <div>
                <span className="font-medium text-gray-700">ربط بمستخدم موجود</span>
                <p className="text-xs text-gray-500">اختر مستخدم من القائمة</p>
              </div>
              {userLinkOption === 'existing' && <CheckCircle className="h-5 w-5 text-blue-500 mr-auto" />}
            </div>

            {/* Existing User Dropdown */}
            {userLinkOption === 'existing' && (
              <div className="mr-8 flex items-center gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 input text-sm"
                  disabled={loading || loadingUsers}
                >
                  <option value="">اختر مستخدم...</option>
                  {unlinkedUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.phone || user.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    fetchUnlinkedUsers()
                  }}
                  className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"
                  disabled={loadingUsers}
                >
                  <RefreshCw className={`h-4 w-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}

            {/* Option 3: Create New */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => !loading && setUserLinkOption('new')}
              onKeyDown={(e) => e.key === 'Enter' && !loading && setUserLinkOption('new')}
              className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 select-none ${userLinkOption === 'new'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white hover:border-green-300'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <UserPlus className={`h-5 w-5 ml-3 ${userLinkOption === 'new' ? 'text-green-500' : 'text-gray-400'}`} />
              <div>
                <span className="font-medium text-gray-700">إنشاء حساب جديد</span>
                <p className="text-xs text-gray-500">سيتم تعيين دور "فني" تلقائياً</p>
              </div>
              {userLinkOption === 'new' && <CheckCircle className="h-5 w-5 text-green-500 mr-auto" />}
            </div>

            {/* New User Form */}
            {userLinkOption === 'new' && (
              <div className="mr-8 space-y-3 p-3 bg-white rounded-lg border border-green-200">
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="input pr-10 text-sm"
                    placeholder="البريد الإلكتروني"
                    disabled={loading}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="input pr-10 pl-20 text-sm"
                    placeholder="كلمة المرور"
                    disabled={loading}
                  />
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewUserPassword(generatePassword())}
                      className="p-1 text-blue-500 hover:text-blue-700 text-xs"
                      title="توليد كلمة مرور"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-amber-600 flex items-center">
                  ⚠️ احفظ كلمة المرور لأنها لن تظهر مرة أخرى
                </p>
              </div>
            )}
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
