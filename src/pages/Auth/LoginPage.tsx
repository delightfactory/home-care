import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/UI/LoadingSpinner'

const LoginPage: React.FC = () => {
  const { signIn, loading } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.email || !formData.password) {
      toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور')
      return
    }

    setIsSubmitting(true)
    
    try {
      const { error } = await signIn(formData.email, formData.password)
      
      if (error) {
        toast.error(error)
      } else {
        toast.success('تم تسجيل الدخول بنجاح')
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء تسجيل الدخول')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="large" text="جاري التحقق من الجلسة..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
            <LogIn className="h-6 w-6 text-primary-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            تسجيل الدخول
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            شركةHOME CARE
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="label label-required">
                البريد الإلكتروني
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="أدخل البريد الإلكتروني"
                value={formData.email}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="label label-required">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="input pl-10"
                  placeholder="أدخل كلمة المرور"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full flex justify-center py-3 text-base"
            >
              {isSubmitting ? (
                <LoadingSpinner size="small" />
              ) : (
                <>
                  <LogIn className="h-5 w-5 ml-2" />
                  تسجيل الدخول
                </>
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              ليس لديك حساب؟{' '}
              <Link to="/signup" className="text-primary-600 hover:underline">
                إنشاء حساب جديد
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
