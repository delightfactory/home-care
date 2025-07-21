import React, { useState, useEffect } from 'react'
import { X, Save, Users, Search, XCircle } from 'lucide-react'
import { TeamsAPI, WorkersAPI } from '../../api'
import { TeamWithMembers, TeamForm, WorkerWithTeam, TeamInsert, TeamUpdate } from '../../types'
import LoadingSpinner from '../UI/LoadingSpinner'
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
    member_ids: []
  })
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [workers, setWorkers] = useState<WorkerWithTeam[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [originalMemberIds, setOriginalMemberIds] = useState<string[]>([])

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
          member_ids: ids
        })
      } else {
        setOriginalMemberIds([])
        setFormData({
          name: '',
          leader_id: '',
          description: '',
          member_ids: []
        })
      }
    }
    if (isOpen) init()
  }, [team, mode, isOpen])

  const fetchWorkers = async () => {
    try {
      setLoadingData(true)
      const data = await WorkersAPI.getWorkers()
      setWorkers(data)
    } catch (error) {
      toast.error('حدث خطأ في تحميل العمال')
      console.error('Workers fetch error:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-blue-600 ml-2" />
            <h2 className="text-lg font-semibold">
              {mode === 'create' ? 'إضافة فريق جديد' : 'تعديل بيانات الفريق'}
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

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="medium" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                اسم الفريق *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="input-field"
                placeholder="أدخل اسم الفريق"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                قائد الفريق
              </label>
              <select
                value={formData.leader_id}
                onChange={(e) => setFormData(prev => ({ ...prev, leader_id: e.target.value }))}
                className="input-field"
                disabled={loading}
              >
                <option value="">اختر قائد الفريق</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الوصف
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="input-field"
                placeholder="أدخل وصف الفريق"
                rows={3}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ملاحظة
              </label>
              <p className="text-sm text-gray-500">
                سيتم تفعيل الفريق تلقائياً عند الإنشاء
              </p>
            </div>

                        <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                أعضاء الفريق
              </label>
              <div className="relative mb-2">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="بحث عن عامل..."
                  className="input pr-8"
                  value={memberSearch}
                  onChange={(e)=>setMemberSearch(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="border rounded-lg h-40 overflow-y-auto p-2 space-y-1 bg-gray-50">
                {workers
                  .filter(w=> w.name.toLowerCase().includes(memberSearch.toLowerCase()))
                  .map(worker=>{
                    const selected = formData.member_ids.includes(String(worker.id))
                    return (
                      <label key={worker.id} className="flex items-center text-sm cursor-pointer px-2 py-1 rounded hover:bg-gray-100">
                        <input
                          type="checkbox"
                          className="form-checkbox h-4 w-4 text-blue-600"
                          checked={selected}
                          onChange={()=>{
                            setFormData(prev=>{
                              const ids = selected ? prev.member_ids.filter(id=>id!==String(worker.id)) : [...prev.member_ids, String(worker.id)]
                              return {...prev, member_ids: ids}
                            })
                          }}
                        />
                        <span className="ml-2">{worker.name}</span>
                      </label>
                    )
                  })}
              </div>
              {formData.member_ids.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.member_ids.map(id=>{
                    const worker = workers.find(w=>w.id===id)
                    if(!worker) return null
                    return (
                      <span key={id} className="badge badge-blue flex items-center">
                        {worker.name}
                        <XCircle
                          className="h-3 w-3 ml-1 cursor-pointer"
                          onClick={()=> setFormData(prev=>({...prev, member_ids: prev.member_ids.filter(i=>i!==String(id))}))}
                        />
                      </span>
                    )
                  })}
                </div>
              )}
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
        )}
      </div>
    </div>
  )
}

export default TeamFormModal
