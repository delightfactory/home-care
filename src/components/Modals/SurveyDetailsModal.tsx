import React from 'react'
import { FileText, Star, Heart, User, Phone, BadgeCheck, Clock } from 'lucide-react'
import SmartModal from '../UI/SmartModal'
import type { SurveyWithOrder, Customer } from '../../types'

interface SurveyDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  survey: SurveyWithOrder | null | undefined
}

const LabelValue: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="bg-white rounded-lg p-4 border border-gray-200">
    <div className="text-sm font-medium text-gray-700 mb-1">{label}</div>
    <div className="text-gray-900">{value}</div>
  </div>
)

const ReadOnlyStars: React.FC<{ value?: number | null; label: string }> = ({ value, label }) => {
  const val = typeof value === 'number' ? value : 0
  return (
    <div className="bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/40 rounded-xl p-4 border border-blue-100/60">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-800 flex items-center gap-2">
          <Star className="w-4 h-4 text-blue-600" />
          {label}
        </span>
        <span className="text-sm text-gray-500">{val > 0 ? `${val}/5` : '—'}</span>
      </div>
      <div className="flex items-center gap-1">
        {[1,2,3,4,5].map(n => (
          <Star key={n} className={`w-5 h-5 ${n <= val ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
        ))}
      </div>
    </div>
  )
}

const SurveyDetailsModal: React.FC<SurveyDetailsModalProps> = ({ isOpen, onClose, survey }) => {
  if (!survey) return null

  const orderNo = (survey as any).order?.order_number as string | undefined
  const customer = (survey as any).order?.customer as Customer | undefined
  const name = customer?.name || '—'
  const phone = customer?.phone || (customer as any)?.extra_phone || '—'
  const isCompleted = !!survey.submitted_at

  return (
    <SmartModal
      isOpen={isOpen}
      onClose={onClose}
      title="تفاصيل الاستبيان"
      subtitle={orderNo ? `رقم الطلب: ${orderNo}` : undefined}
      icon={<FileText className="h-6 w-6 text-white" />}
      size="xl"
      headerGradient="from-primary-600 via-primary-700 to-primary-800"
    >
      <div className="p-6 space-y-6">
        {/* معلومات عامة */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-gray-800 font-semibold">
              <FileText className="w-5 h-5 text-primary-600" />
              <span>معلومات الطلب والعميل</span>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border ${isCompleted ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
              {isCompleted ? (
                <>
                  <BadgeCheck className="w-4 h-4" />
                  <span>مكتمل</span>
                  {survey.submitted_at && (
                    <span className="text-gray-500">({new Date(survey.submitted_at as any).toLocaleString('en-GB')})</span>
                  )}
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  <span>غير مكتمل</span>
                </>
              )}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <LabelValue label="رقم الطلب" value={orderNo || '—'} />
            <LabelValue label="اسم العميل" value={
              <span className="inline-flex items-center gap-2"><User className="w-4 h-4 text-gray-500" />{name}</span>
            } />
            <LabelValue label="هاتف العميل" value={
              <span className="inline-flex items-center gap-2 ltr:flex-row-reverse rtl:flex-row"><Phone className="w-4 h-4 text-gray-500" />{phone}</span>
            } />
            <LabelValue label="تاريخ الإنشاء" value={new Date(survey.created_at as any).toLocaleString('en-GB')} />
            <LabelValue label="تاريخ التحديث" value={survey.updated_at ? new Date(survey.updated_at as any).toLocaleString('en-GB') : '—'} />
          </div>
        </div>

        {/* التقييمات */}
        <div>
          <div className="flex items-center mb-3">
            <div className="p-2 bg-blue-100 rounded-lg ml-2">
              <Star className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">التقييمات</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReadOnlyStars label="جودة الخدمة" value={survey.service_quality_rating} />
            <ReadOnlyStars label="احترافية الفريق" value={survey.staff_professionalism_rating} />
            <ReadOnlyStars label="الالتزام بالوقت" value={survey.punctuality_rating} />
            <ReadOnlyStars label="النظافة" value={survey.cleanliness_rating} />
            <ReadOnlyStars label="القيمة مقابل المال" value={survey.value_for_money_rating} />
            <div className="md:col-span-2">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-xl border-2 border-amber-200">
                <ReadOnlyStars label="التقييم العام" value={survey.overall_rating} />
              </div>
            </div>
          </div>
        </div>

        {/* التوصية */}
        <div className="bg-gradient-to-br from-rose-50/60 to-pink-50/60 p-6 rounded-xl border border-rose-200/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-800 font-semibold">
              <Heart className="w-5 h-5 text-rose-600" />
              <span>هل توصي بالخدمة؟</span>
            </div>
            {survey.would_recommend === true ? (
              <span className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm border border-emerald-200">
                نعم
              </span>
            ) : survey.would_recommend === false ? (
              <span className="inline-flex items-center gap-2 bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-sm border border-rose-200">
                لا
              </span>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </div>
        </div>

        {/* التعليقات */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-green-50/60 to-teal-50/60 rounded-xl border border-green-200/70">
            <div className="p-4 border-b border-green-200/60">
              <h4 className="font-semibold text-gray-800">رأي العميل</h4>
            </div>
            <div className="p-4 min-h-[96px] text-gray-800">
              {survey.customer_feedback ? (
                <p className="leading-relaxed whitespace-pre-wrap">{survey.customer_feedback}</p>
              ) : (
                <p className="text-gray-500">—</p>
              )}
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50/60 to-orange-50/60 rounded-xl border border-yellow-200/70">
            <div className="p-4 border-b border-yellow-200/60">
              <h4 className="font-semibold text-gray-800">مقترحات التحسين</h4>
            </div>
            <div className="p-4 min-h-[96px] text-gray-800">
              {survey.improvement_suggestions ? (
                <p className="leading-relaxed whitespace-pre-wrap">{survey.improvement_suggestions}</p>
              ) : (
                <p className="text-gray-500">—</p>
              )}
            </div>
          </div>
        </div>

        {/* إجراء */}
        <div className="flex items-center justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            إغلاق
          </button>
        </div>
      </div>
    </SmartModal>
  )
}

export default SurveyDetailsModal
