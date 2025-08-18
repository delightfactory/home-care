import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Star, Send, CheckCircle2, AlertTriangle, MessageSquare, Heart, Award, Sparkles, ThumbsUp, ThumbsDown } from 'lucide-react'
import { SurveysAPI } from '../../api'
import type { CustomerSurvey, CustomerSurveyUpdate } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import toast from 'react-hot-toast'

const StarRating: React.FC<{
  label: string
  value: number
  onChange: (v: number) => void
}> = ({ label, value, onChange }) => {
  const [hover, setHover] = useState(0)

  const getRatingText = (rating: number) => {
    switch(rating) {
      case 1: return 'ضعيف جداً'
      case 2: return 'ضعيف'
      case 3: return 'متوسط'
      case 4: return 'جيد'
      case 5: return 'ممتاز'
      default: return ''
    }
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 shadow-sm'
    if (rating >= 3) return 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 shadow-sm'
    return 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 shadow-sm'
  }

  return (
    <div className="space-y-4 p-5 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50 rounded-2xl border border-blue-100/50 shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          {label}
        </span>
        {value > 0 && (
          <span className={`text-sm px-4 py-2 rounded-full font-bold transition-all duration-300 transform hover:scale-105 ${
            getRatingColor(value)
          }`}>
            {getRatingText(value)}
          </span>
        )}
      </div>
      
      {/* Rating Labels */}
      <div className="flex items-center justify-between text-xs text-gray-600 px-2">
        <span className="flex items-center gap-1">
          <ThumbsDown className="w-3 h-3 text-red-500" />
          <span className="font-medium">ضعيف</span>
        </span>
        <span className="flex items-center gap-1">
          <ThumbsUp className="w-3 h-3 text-green-500" />
          <span className="font-medium">ممتاز</span>
        </span>
      </div>
      
      <div className="flex items-center justify-center gap-2">
        {[1,2,3,4,5].map((n) => {
          const active = n <= (hover || value)
          return (
            <div key={n} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => onChange(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                className={`p-3 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                  active 
                    ? 'text-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-lg border-2 border-yellow-300' 
                    : 'text-gray-300 border-2 border-transparent'
                }`}
              >
                <Star className={`w-8 h-8 transition-colors duration-200 ${active ? 'fill-current' : ''}`} />
              </button>
              <span className={`text-xs font-medium transition-colors duration-200 ${
                (hover || value) === n ? 'text-blue-600' : 'text-gray-400'
              }`}>
                {n}
              </span>
            </div>
          )
        })}
      </div>
      
      {/* Current Rating Display */}
      {(hover || value) > 0 && (
        <div className="text-center">
          <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold transition-colors duration-200 ${
            getRatingColor(hover || value)
          }`}>
            {getRatingText(hover || value)} ({hover || value}/5)
          </span>
        </div>
      )}
    </div>
  )
}

const SurveyFormPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [survey, setSurvey] = useState<CustomerSurvey | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [serviceQuality, setServiceQuality] = useState(0)
  const [professionalism, setProfessionalism] = useState(0)
  const [punctuality, setPunctuality] = useState(0)
  const [cleanliness, setCleanliness] = useState(0)
  const [valueForMoney, setValueForMoney] = useState(0)
  const [overall, setOverall] = useState(0)
  const [recommend, setRecommend] = useState<boolean | null>(null)
  const [feedback, setFeedback] = useState('')
  const [improvements, setImprovements] = useState('')

  const isSubmitted = useMemo(() => !!survey?.submitted_at, [survey])
  
  // Progress calculation
  const progress = useMemo(() => {
    const ratings = [serviceQuality, professionalism, punctuality, cleanliness, valueForMoney, overall]
    const filledRatings = ratings.filter(r => r > 0).length
    const hasRecommendation = recommend !== null
    const hasFeedback = feedback.trim().length > 0
    const hasImprovements = improvements.trim().length > 0
    
    const totalSteps = 9 // 6 ratings + recommendation + feedback + improvements
    const completedSteps = filledRatings + (hasRecommendation ? 1 : 0) + (hasFeedback ? 1 : 0) + (hasImprovements ? 1 : 0)
    
    return Math.round((completedSteps / totalSteps) * 100)
  }, [serviceQuality, professionalism, punctuality, cleanliness, valueForMoney, overall, recommend, feedback, improvements])

  useEffect(() => {
    const fetchSurvey = async () => {
      if (!token) {
        setError('رابط الاستبيان غير صالح')
        setLoading(false)
        return
      }
      setLoading(true)
      const res = await SurveysAPI.getSurveyByToken(token)
      if (!res.success) {
        setError(res.error || 'تعذر تحميل الاستبيان')
      } else if (!res.data) {
        setError('هذا الرابط غير صالح أو غير موجود')
      } else {
        setSurvey(res.data)
      }
      setLoading(false)
    }
    fetchSurvey()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    if (isSubmitted) {
      toast.error('تم إرسال هذا الاستبيان مسبقاً')
      return
    }

    if (overall === 0) {
      toast.error('يرجى اختيار التقييم العام')
      return
    }

    const update: CustomerSurveyUpdate = {
      service_quality_rating: serviceQuality || null,
      staff_professionalism_rating: professionalism || null,
      punctuality_rating: punctuality || null,
      cleanliness_rating: cleanliness || null,
      value_for_money_rating: valueForMoney || null,
      overall_rating: overall,
      would_recommend: recommend,
      customer_feedback: feedback.trim() || null,
      improvement_suggestions: improvements.trim() || null
    }

    setSubmitting(true)
    const res = await SurveysAPI.submitSurvey(token, update)
    setSubmitting(false)

    if (res.success) {
      toast.success('شكراً لكم! تم استلام تقييمكم بنجاح')
      setSurvey(res.data!)
    } else {
      toast.error(res.error || 'تعذر إرسال الاستبيان')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center space-y-4">
          <LoadingSpinner size="large" />
          <p className="text-gray-600 font-medium">جاري تحميل الاستبيان...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-red-200 text-center shadow-lg">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">عذراً</h1>
          <p className="text-gray-600 leading-relaxed">{error}</p>
        </div>
      </div>
    )
  }

  if (!survey) return null

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-10 border border-green-200 text-center shadow-xl">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">تم استلام تقييمكم</h1>
          <p className="text-gray-600 leading-relaxed">نشكركم على وقتكم الثمين. تقييمكم يساعدنا في تحسين خدماتنا.</p>
          <div className="mt-6 flex items-center justify-center gap-2 text-green-600">
            <Heart className="w-5 h-5" />
            <span className="text-sm font-medium">نقدر ثقتكم بنا</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8 px-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-200/30 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-purple-200/30 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-100/20 rounded-full blur-3xl"></div>
      </div>
      
      <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur-sm rounded-3xl border border-blue-200/50 shadow-2xl overflow-hidden relative z-10">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-8 py-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-white/10"></div>
          <div className="relative z-10 flex items-center justify-between">
            {/* Company Logo and Name */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30 shadow-lg">
                <img 
                  src="/icons/icon-192x192.png" 
                  alt="HOME CARE" 
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <Award className="w-8 h-8 text-white drop-shadow-lg hidden" />
              </div>
              <div className="text-right">
                <h1 className="text-xl font-bold drop-shadow-lg">HOME CARE</h1>
                <p className="text-blue-100 text-sm">استبيان رضا العملاء</p>
              </div>
            </div>
            
            {/* Trust Badge */}
            <div className="hidden md:flex items-center gap-2 text-blue-200 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
              <Heart className="w-4 h-4" />
              <span className="text-sm font-medium">رأيكم يهمنا</span>
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="px-10 py-8 bg-gradient-to-r from-gray-50/80 via-blue-50/80 to-indigo-50/80 border-b border-blue-100/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-bold text-gray-800 flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              مدى إكمال الاستبيان
            </span>
            <span className="text-lg font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200/80 rounded-full h-4 overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-700 ease-out shadow-lg relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 rounded-full"></div>
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-600 text-center">
            {progress < 30 ? 'ابدأ بتقييم الخدمات' : progress < 70 ? 'أكمل التقييمات المتبقية' : progress < 100 ? 'أوشكت على الانتهاء!' : 'مكتمل بالكامل!'}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-10">
          {/* Rating Section */}
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Star className="w-6 h-6 text-white" />
                </div>
                تقييم جودة الخدمة
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto">
                يرجى تقييم كل جانب من جوانب الخدمة المقدمة لكم
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <StarRating label="جودة الخدمة" value={serviceQuality} onChange={setServiceQuality} />
              <StarRating label="احترافية الفريق" value={professionalism} onChange={setProfessionalism} />
              <StarRating label="الالتزام بالوقت" value={punctuality} onChange={setPunctuality} />
              <StarRating label="النظافة" value={cleanliness} onChange={setCleanliness} />
              <StarRating label="القيمة مقابل المال" value={valueForMoney} onChange={setValueForMoney} />
              <div className="lg:col-span-2">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border-2 border-amber-200">
                  <StarRating label="التقييم العام (إلزامي)" value={overall} onChange={setOverall} />
                </div>
              </div>
            </div>
          </div>

          {/* Feedback Section */}
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                شاركونا تعليقاتكم
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto">
                نحن نقدر آراءكم وتعليقاتكم البناءة لتحسين خدماتنا
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-green-50/50 to-teal-50/50 p-8 rounded-2xl border border-green-200/50">
              <label className="text-lg font-bold text-gray-800 flex items-center gap-3 mb-4">
                <MessageSquare className="w-6 h-6 text-green-600" /> 
                تعليقكم عن التجربة
              </label>
              <div className="relative">
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={5}
                  className="w-full p-6 border-2 border-green-200 rounded-2xl focus:ring-4 focus:ring-green-100 focus:border-green-500 transition-all duration-300 resize-none bg-white/80 backdrop-blur-sm text-lg leading-relaxed"
                  placeholder="شاركنا رأيك عن تجربتك معنا... كيف كانت الخدمة؟ ما الذي أعجبك؟ هل هناك شيء يمكننا تحسينه؟"
                  maxLength={500}
                />
                <div className="absolute bottom-4 left-4 text-sm text-gray-500 bg-white/90 px-3 py-1 rounded-full border border-gray-200">
                  {feedback.length}/500 حرف
                </div>
              </div>
            </div>
          </div>

          {/* Recommendation Section */}
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                التوصية
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto">
                هل توصي بخدماتنا لأصدقائك وعائلتك؟
              </p>
            </div>
            <div className="bg-gradient-to-br from-rose-50/50 to-pink-50/50 p-8 rounded-2xl border border-rose-200/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className={`group px-8 py-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 text-center font-bold text-lg ${
                  recommend === true 
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-400 text-green-700 shadow-xl transform scale-105 ring-4 ring-green-100' 
                    : 'border-gray-200 hover:border-green-300 hover:bg-green-50 hover:shadow-lg hover:scale-102 bg-white/80'
                }`}>
                  <input type="radio" name="recommend" className="hidden" onChange={() => setRecommend(true)} />
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      recommend === true ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600 group-hover:bg-green-200'
                    }`}>
                      <ThumbsUp className="w-6 h-6" />
                    </div>
                    <span>نعم، بالتأكيد</span>
                    <span className="text-sm text-gray-600 font-normal">سأوصي بكم للآخرين</span>
                  </div>
                </label>
                <label className={`group px-8 py-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 text-center font-bold text-lg ${
                  recommend === false 
                    ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-400 text-red-700 shadow-xl transform scale-105 ring-4 ring-red-100' 
                    : 'border-gray-200 hover:border-red-300 hover:bg-red-50 hover:shadow-lg hover:scale-102 bg-white/80'
                }`}>
                  <input type="radio" name="recommend" className="hidden" onChange={() => setRecommend(false)} />
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      recommend === false ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600 group-hover:bg-red-200'
                    }`}>
                      <ThumbsDown className="w-6 h-6" />
                    </div>
                    <span>لا، للأسف</span>
                    <span className="text-sm text-gray-600 font-normal">لن أوصي بكم حالياً</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Improvements Section */}
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                مقترحات التحسين
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto">
                شاركنا أفكارك ومقترحاتك القيمة لتطوير خدماتنا
              </p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50/50 to-orange-50/50 p-8 rounded-2xl border border-yellow-200/50">
              <div className="relative">
                <textarea
                  value={improvements}
                  onChange={(e) => setImprovements(e.target.value)}
                  placeholder="نحن نقدر آراءكم ومقترحاتكم... شاركونا أفكاركم لتحسين خدماتنا وتطويرها بما يلبي احتياجاتكم بشكل أفضل"
                  className="w-full p-6 border-2 border-gray-200 rounded-2xl focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 transition-all duration-300 resize-none bg-white/80 backdrop-blur-sm placeholder-gray-500 text-lg leading-relaxed shadow-lg hover:shadow-xl"
                  rows={6}
                  maxLength={500}
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                  <div className={`text-sm px-3 py-1 rounded-full backdrop-blur-sm font-medium ${
                    improvements.length > 450 ? 'bg-red-100 text-red-700' :
                    improvements.length > 300 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {improvements.length}/500
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Section */}
          <div className="pt-12">
            <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-8 rounded-2xl border border-blue-200/50">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-800 mb-2">شكراً لوقتكم الثمين</h3>
                <p className="text-gray-600">تقييمكم يساعدنا على تقديم خدمة أفضل</p>
              </div>
              
              {overall === 0 && (
                <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl text-amber-700 text-center font-medium shadow-lg">
                  <div className="flex items-center justify-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    يرجى إضافة التقييم العام قبل إرسال الاستبيان
                  </div>
                </div>
              )}
              
              <button
                type="submit"
                disabled={submitting || overall === 0}
                className={`w-full py-6 px-8 rounded-2xl font-bold text-xl transition-all duration-300 transform shadow-xl ${
                  submitting || overall === 0
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white hover:shadow-2xl hover:scale-105 active:scale-95 ring-4 ring-blue-100 hover:ring-blue-200'
                }`}
              >
                {submitting ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>جاري الإرسال...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                      <Send className="w-5 h-5" />
                    </div>
                    <span>إرسال التقييم</span>
                  </div>
                )}
              </button>
              
              <div className="mt-4 text-center text-sm text-gray-500">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>بياناتكم محمية ومؤمنة</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SurveyFormPage
