import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { UserPlus, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/UI/LoadingSpinner'

const SignUpPage: React.FC = () => {
  const { signUp, loading } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      toast.error('يرجى إدخال جميع الحقول')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('كلمتا المرور غير متطابقتين')
      return
    }
    setIsSubmitting(true)
    const { error } = await signUp(formData.email, formData.password)
    if (error) {
      toast.error(error)
    } else {
      toast.success('تم إنشاء الحساب بنجاح، بانتظار موافقة الأدمن')
      navigate('/login')
    }
    setIsSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="large" text="..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
            <UserPlus className="h-6 w-6 text-primary-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">إنشاء حساب جديد</h2>
          <p className="mt-2 text-center text-sm text-gray-600">نظام إدارة شركة التنظيف المنزلي</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="label label-required">البريد الإلكتروني</label>
              <input id="email" name="email" type="email" required className="input" placeholder="أدخل البريد الإلكتروني" value={formData.email} onChange={handleChange} disabled={isSubmitting} />
            </div>
            <div>
              <label htmlFor="password" className="label label-required">كلمة المرور</label>
              <div className="relative">
                <input id="password" name="password" type={showPassword? 'text':'password'} required className="input pl-10" placeholder="أدخل كلمة المرور" value={formData.password} onChange={handleChange} disabled={isSubmitting} />
                <button type="button" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={()=>setShowPassword(!showPassword)}>
                  {showPassword? <EyeOff className="h-5 w-5"/>:<Eye className="h-5 w-5"/>}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="label label-required">تأكيد كلمة المرور</label>
              <input id="confirmPassword" name="confirmPassword" type="password" required className="input" placeholder="أعد إدخال كلمة المرور" value={formData.confirmPassword} onChange={handleChange} disabled={isSubmitting} />
            </div>
          </div>
          <div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full flex justify-center py-3 text-base">
              {isSubmitting ? <LoadingSpinner size="small"/> : 'إنشاء حساب'}
            </button>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">لديك حساب بالفعل؟ <Link to="/login" className="text-primary-600 hover:underline">تسجيل الدخول</Link></p>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SignUpPage
