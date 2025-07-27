import React, { useState } from 'react'
import { Star, MessageSquare, Send, X } from 'lucide-react'
import SmartModal from '../UI/SmartModal'
import LoadingSpinner from '../UI/LoadingSpinner'
import { OrdersAPI } from '../../api'
import toast from 'react-hot-toast'

interface OrderRatingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  orderId: string
  orderNumber?: string
  customerName?: string
}

const OrderRatingModal: React.FC<OrderRatingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  orderId,
  orderNumber,
  customerName
}) => {
  const [rating, setRating] = useState<number>(0)
  const [feedback, setFeedback] = useState('')
  const [hoveredRating, setHoveredRating] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    const newErrors: Record<string, string> = {}
    if (rating === 0) {
      newErrors.rating = 'يرجى اختيار تقييم'
    }
    if (feedback.trim().length < 10) {
      newErrors.feedback = 'يرجى كتابة تعليق لا يقل عن 10 أحرف'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setLoading(true)
    try {
      const response = await OrdersAPI.updateOrderRating(
        orderId,
        rating,
        feedback.trim()
      )
      
      if (response.success) {
        toast.success('تم حفظ التقييم بنجاح')
        onSuccess()
        onClose()
        // Reset form
        setRating(0)
        setFeedback('')
        setErrors({})
      } else {
        throw new Error(response.error || 'فشل في حفظ التقييم')
      }
    } catch (error) {
      console.error('Rating submission error:', error)
      toast.error('حدث خطأ في حفظ التقييم')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setRating(0)
      setFeedback('')
      setErrors({})
      onClose()
    }
  }

  const renderStars = () => {
    return (
      <div className="flex items-center justify-center gap-2 my-4">
        {[1, 2, 3, 4, 5].map((star) => {
          const isActive = star <= (hoveredRating || rating)
          return (
            <button
              key={star}
              type="button"
              onClick={() => {
                setRating(star)
                setErrors(prev => ({ ...prev, rating: '' }))
              }}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className={`p-2 rounded-full transition-all duration-200 transform hover:scale-110 ${
                isActive 
                  ? 'text-yellow-400 bg-yellow-50 shadow-md' 
                  : 'text-gray-300 hover:text-yellow-300 hover:bg-gray-50'
              }`}
              disabled={loading}
            >
              <Star 
                className={`w-8 h-8 transition-all duration-200 ${
                  isActive ? 'fill-current' : ''
                }`} 
              />
            </button>
          )
        })}
      </div>
    )
  }

  const getRatingText = (rating: number) => {
    const texts = {
      1: 'ضعيف جداً',
      2: 'ضعيف',
      3: 'متوسط',
      4: 'جيد',
      5: 'ممتاز'
    }
    return texts[rating as keyof typeof texts] || ''
  }

  return (
    <SmartModal
      isOpen={isOpen}
      onClose={handleClose}
      title="تقييم الخدمة"
      subtitle={`تقييم الطلب رقم ${orderNumber || orderId}`}
      icon={<Star className="h-6 w-6 text-white" />}
      size="md"
      headerGradient="from-yellow-500 via-yellow-600 to-yellow-700"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Customer Info */}
        {customerName && (
          <div className="text-center p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-gray-600">تقييم خدمة العميل</p>
            <p className="font-semibold text-gray-800">{customerName}</p>
          </div>
        )}

        {/* Rating Section */}
        <div className="space-y-3">
          <label className="block text-center">
            <span className="text-lg font-semibold text-gray-700 mb-2 block">
              كيف تقيم جودة الخدمة المقدمة؟
            </span>
            <span className="text-sm text-gray-500">
              اختر من 1 إلى 5 نجوم
            </span>
          </label>
          
          {renderStars()}
          
          {(hoveredRating || rating) > 0 && (
            <div className="text-center">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                (hoveredRating || rating) >= 4 
                  ? 'bg-green-100 text-green-800' 
                  : (hoveredRating || rating) >= 3 
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {getRatingText(hoveredRating || rating)}
              </span>
            </div>
          )}
          
          {errors.rating && (
            <p className="text-sm text-red-600 text-center animate-bounce-in flex items-center justify-center gap-1">
              <X className="h-3 w-3" />
              {errors.rating}
            </p>
          )}
        </div>

        {/* Feedback Section */}
        <div className="space-y-3">
          <label className="flex items-center text-gray-700 font-medium">
            <MessageSquare className="h-4 w-4 ml-2 text-yellow-500" />
            تعليق العميل
            <span className="text-red-500 mr-1">*</span>
          </label>
          
          <div className="relative">
            <textarea
              value={feedback}
              onChange={(e) => {
                setFeedback(e.target.value)
                setErrors(prev => ({ ...prev, feedback: '' }))
              }}
              className={`w-full p-4 border rounded-lg resize-none transition-all duration-200 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 ${
                errors.feedback 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 hover:border-yellow-300'
              }`}
              rows={4}
              placeholder="شاركنا رأيك في الخدمة المقدمة... (مثال: الفريق كان محترف ووصل في الوقت المحدد، الخدمة كانت ممتازة)"
              disabled={loading}
              maxLength={500}
            />
            <div className="absolute bottom-2 left-2 text-xs text-gray-400">
              {feedback.length}/500
            </div>
          </div>
          
          {errors.feedback && (
            <p className="text-sm text-red-600 animate-bounce-in flex items-center gap-1">
              <X className="h-3 w-3" />
              {errors.feedback}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            إلغاء
          </button>
          
          <button
            type="submit"
            disabled={loading || rating === 0}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                حفظ التقييم
              </>
            )}
          </button>
        </div>
      </form>
    </SmartModal>
  )
}

export default OrderRatingModal