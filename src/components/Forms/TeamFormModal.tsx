import React, { useState, useEffect } from 'react'
import { X, Save, Users, Search, XCircle, User, FileText, CheckCircle, Crown, Power } from 'lucide-react'
import { TeamsAPI, WorkersAPI } from '../../api'
import { TeamWithMembers, TeamForm, WorkerWithTeam, TeamInsert, TeamUpdate } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
import SmartModal from '../UI/SmartModal'

import toast from 'react-hot-toast'

interface TeamFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  team?: TeamWithMembers
  mode: 'create' | 'edit'
}

const TeamFormModal: React.FC<TeamFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  team,
  mode
}) => {
  const [formData, setFormData] = useState<TeamForm>({
    name: '',
    leader_id: '',
    description: '',
    member_ids: [],
    is_active: true
  })
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [workers, setWorkers] = useState<WorkerWithTeam[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [originalMemberIds, setOriginalMemberIds] = useState<string[]>([])
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen) {
      fetchWorkers()
    }
  }, [isOpen])

  useEffect(() => {
    const init = async () => {
      if (mode === 'edit' && team) {
        // احصل على بيانات الفريق بالتفصيل لضمان وجود الأعضاء
        const fresh = await TeamsAPI.getTeamById(team.id)
        const members = fresh?.members || team.members || []
        const ids = members.map((m: any)=>String(m.worker_id))
        setOriginalMemberIds(ids)
        setFormData({
          name: fresh?.name || team.name,
          leader_id: fresh?.leader_id || team.leader_id || '',
          description: fresh?.description || team.description || '',
          member_ids: ids,
          is_active: fresh?.is_active ?? team.is_active ?? true
        })
      } else {
        setOriginalMemberIds([])
        setFormData({
          name: '',
          leader_id: '',
          description: '',
          member_ids: [],
          is_active: true
        })
      }
    }
    if (isOpen) init()
  }, [team, mode, isOpen])

  const fetchWorkers = async () => {
    try {
      setLoadingData(true)
      
      if (mode === 'create') {
        // في حالة الإنشاء، جلب العمال المتاحين فقط
        const data = await WorkersAPI.getAvailableWorkers()
        setWorkers(data)
      } else {
        // في حالة التعديل، جلب العمال المتاحين + الأعضاء الحاليين
        const [availableWorkers, allWorkers] = await Promise.all([
          WorkersAPI.getAvailableWorkers(),
          WorkersAPI.getWorkers()
        ])
        
        // الحصول على معرفات الأعضاء الحاليين
        const currentMemberIds = team?.members?.map(m => String(m.worker_id)) || []
        
        // دمج العمال المتاحين مع الأعضاء الحاليين (تجنب التكرار)
        const currentMembers = allWorkers.filter(w => currentMemberIds.includes(String(w.id)))
        const uniqueWorkers = [...availableWorkers]
        
        // إضافة الأعضاء الحاليين إذا لم يكونوا موجودين في القائمة
        currentMembers.forEach(member => {
          if (!uniqueWorkers.find(w => w.id === member.id)) {
            uniqueWorkers.push(member)
          }
        })
        
        setWorkers(uniqueWorkers)
      }
    } catch (error) {
      toast.error('حدث خطأ في تحميل العمال')
      console.error('Workers fetch error:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'اسم الفريق مطلوب'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    validateForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('يرجى إدخال اسم الفريق')
      return
    }

    setLoading(true)
    try {
      const { member_ids: rawMemberIds, ...teamData } = formData
      const member_ids = rawMemberIds.filter(id=>id && id.trim() !== '')

      if (mode === 'create') {
        await TeamsAPI.createTeam(teamData as TeamInsert, member_ids)
        toast.success('تم إضافة الفريق بنجاح')
      } else {
        await TeamsAPI.updateTeam(team!.id, teamData as TeamUpdate)
        // تحديث الأعضاء
        const toAdd = member_ids.filter(id=>!originalMemberIds.includes(id))
        const toRemove = originalMemberIds.filter(id=>!member_ids.includes(id))
        // عمليات متوازية
        await Promise.all([
          ...toAdd.map(id=>TeamsAPI.addTeamMember(team!.id, id)),
          ...toRemove.filter(Boolean).map(id=>TeamsAPI.removeTeamMember(team!.id, id))
        ])
        toast.success('تم تحديث بيانات الفريق وأعضائه بنجاح')
      }
      
      onSuccess()
      onClose()
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ البيانات')
      console.error('Team form error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <SmartModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'إضافة فريق جديد' : 'تعديل بيانات الفريق'}
      subtitle={mode === 'create' ? 'إنشاء فريق عمل جديد' : 'تحديث معلومات الفريق'}
      icon={<Users className="h-6 w-6 text-white" />}
      size="lg"
      headerGradient="from-primary-500 to-primary-700"
    >

      {loadingData ? (
        <div className="p-8 flex justify-center">
          <LoadingSpinner size="large" text="جاري تحميل البيانات..." />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="flex items-center label label-required text-gray-700 font-medium">
                <Users className="h-4 w-4 ml-2 text-primary-500" />
                اسم الفريق
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  onBlur={() => handleBlur('name')}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pl-10 ${
                    errors.name ? 'input-error border-red-500 focus:ring-red-500' : 'hover:border-primary-300'
                  } ${
                    touched.name && !errors.name && formData.name ? 'border-green-500 focus:ring-green-500' : ''
                  }`}
                  placeholder="أدخل اسم الفريق"
                  required
                  disabled={loading}
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {touched.name && !errors.name && formData.name ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Users className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
              {errors.name && (
                <p className="text-sm text-red-600 mt-1 animate-bounce-in flex items-center">
                  <X className="h-3 w-3 ml-1" />
                  {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="flex items-center label text-gray-700 font-medium">
                <Crown className="h-4 w-4 ml-2 text-primary-500" />
                قائد الفريق
              </label>
              <div className="relative">
                <select
                  value={formData.leader_id}
                  onChange={(e) => {
                    const leaderId = e.target.value
                    setFormData(prev => {
                      const newData = { ...prev, leader_id: leaderId }
                      
                      // إضافة القائد تلقائياً كعضو في الفريق إذا لم يكن موجوداً
                      if (leaderId && !prev.member_ids.includes(leaderId)) {
                        newData.member_ids = [...prev.member_ids, leaderId]
                      }
                      // إذا تم إلغاء تحديد القائد، لا نقوم بإزالته من الأعضاء تلقائياً
                      // يمكن للمستخدم إزالته يدوياً إذا أراد
                      
                      return newData
                    })
                  }}
                  onBlur={() => handleBlur('leader_id')}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${
                    touched.leader_id && formData.leader_id ? 'border-green-500 focus:ring-green-500' : ''
                  }`}
                  disabled={loading}
                >
                  <option value="">اختر قائد الفريق</option>
                  {workers
                    .filter(worker => worker.status === 'active')
                    .map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-600 mt-1">
                  ملاحظة: سيتم إضافة قائد الفريق تلقائياً كعضو في الفريق
                </p>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  {touched.leader_id && formData.leader_id ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Crown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center label text-gray-700 font-medium">
                <FileText className="h-4 w-4 ml-2 text-primary-500" />
                الوصف
              </label>
              <div className="relative">
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  onBlur={() => handleBlur('description')}
                  className={`input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10 ${
                    touched.description && formData.description ? 'border-green-500 focus:ring-green-500' : ''
                  }`}
                  placeholder="أدخل وصف الفريق (اختياري)"
                  rows={3}
                  disabled={loading}
                />
                <div className="absolute left-3 top-3">
                  {touched.description && formData.description ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <FileText className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
              {formData.description && (
                <p className="text-xs text-gray-500">
                  {formData.description.length} حرف
                </p>
              )}
            </div>



            {/* Team Status Toggle */}
            <div className="space-y-2">
              <label className="flex items-center label text-gray-700 font-medium">
                <Power className="h-4 w-4 ml-2 text-primary-500" />
                حالة الفريق
              </label>
              <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center">
                  <div className="relative">
                    <input
                      type="checkbox"
                      id="team_status"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="sr-only"
                      disabled={loading}
                    />
                    <label
                      htmlFor="team_status"
                      className={`flex items-center cursor-pointer transition-all duration-200 ${
                        formData.is_active
                          ? 'text-green-600'
                          : 'text-red-500'
                      }`}
                    >
                      <div
                        className={`relative w-12 h-6 rounded-full transition-all duration-200 ${
                          formData.is_active
                            ? 'bg-gradient-to-r from-green-500 to-green-600'
                            : 'bg-gradient-to-r from-red-500 to-red-600'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                            formData.is_active ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </div>
                      <span className="mr-3 font-medium">
                        {formData.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                      {formData.is_active && (
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                      )}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-blue-600 ml-2" />
                <div>
                  <p className="text-sm font-medium text-blue-800">ملاحظة</p>
                  <p className="text-sm text-blue-600 mt-1">
                    يمكنك تغيير حالة تفعيل الفريق في أي وقت
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center label text-gray-700 font-medium">
                <Users className="h-4 w-4 ml-2 text-primary-500" />
                أعضاء الفريق
              </label>
              {mode === 'create' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">
                    <span className="font-medium">ملاحظة:</span> يتم عرض العمال المتاحين فقط (غير المسجلين في فرق أخرى)
                  </p>
                </div>
              )}
              {mode === 'edit' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">ملاحظة:</span> يتم عرض العمال المتاحين والأعضاء الحاليين في الفريق
                  </p>
                </div>
              )}
              <div className="relative">
                <input
                  type="text"
                  placeholder="بحث عن عامل..."
                  className="input transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 hover:border-primary-300 pl-10"
                  value={memberSearch}
                  onChange={(e)=>setMemberSearch(e.target.value)}
                  disabled={loading}
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl h-40 overflow-y-auto bg-gray-50">
                <div className="p-3 space-y-2">
                  {workers
                    .filter(w=> w.name.toLowerCase().includes(memberSearch.toLowerCase()))
                    .map(worker=>{
                      const selected = formData.member_ids.includes(String(worker.id))
                      return (
                        <label key={worker.id} className={`flex items-center text-sm cursor-pointer px-3 py-2 rounded-lg transition-all duration-200 ${
                          selected ? 'bg-primary-100 border border-primary-200 shadow-sm' : 'hover:bg-white hover:shadow-sm'
                        }`}>
                          <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
                            checked={selected}
                            onChange={()=>{
                              setFormData(prev=>{
                                const ids = selected ? prev.member_ids.filter(id=>id!==String(worker.id)) : [...prev.member_ids, String(worker.id)]
                                return {...prev, member_ids: ids}
                              })
                            }}
                          />
                          <div className="mr-3 flex items-center">
                            <User className="h-4 w-4 text-gray-500 ml-2" />
                            <span className={selected ? 'text-primary-700 font-medium' : 'text-gray-700'}>{worker.name}</span>
                          </div>
                        </label>
                      )
                    })}
                  {workers.filter(w=> w.name.toLowerCase().includes(memberSearch.toLowerCase())).length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p>لا توجد عمال متاحين</p>
                    </div>
                  )}
                </div>
              </div>
              {formData.member_ids.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-gray-600 mb-2 flex items-center">
                    <Users className="h-4 w-4 ml-1" />
                    الأعضاء المحددين ({formData.member_ids.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {formData.member_ids.map(id=>{
                      const worker = workers.find(w=>w.id===id)
                      if(!worker) return null
                      return (
                        <span key={id} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 text-primary-800 border border-primary-200 shadow-sm">
                          <User className="h-3 w-3 ml-1" />
                          {worker.name}
                          <button
                            type="button"
                            className="mr-2 hover:text-primary-600 transition-colors duration-200"
                            onClick={()=> setFormData(prev=>({...prev, member_ids: prev.member_ids.filter(i=>i!==String(id))}))}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 space-x-reverse pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex items-center transition-all duration-200"
                disabled={loading}
              >
                <X className="h-4 w-4 ml-2" />
                إلغاء
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name.trim()}
                className="btn-primary flex items-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                ) : (
                  <Save className="h-4 w-4 ml-2" />
                )}
                {loading ? 'جاري الحفظ...' : (mode === 'create' ? 'إنشاء' : 'تحديث')}
              </button>
            </div>
        </form>
      )}
    </SmartModal>
  )
}

export default TeamFormModal
