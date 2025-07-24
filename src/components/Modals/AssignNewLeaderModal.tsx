import React, { useState, useEffect } from 'react'
import { X, Crown, Users, AlertTriangle } from 'lucide-react'
import { WorkerWithTeam, TeamWithMembers } from '../../types'
import { TeamsAPI } from '../../api/workers'
import LoadingSpinner from '../UI/LoadingSpinner'
import toast from 'react-hot-toast'

interface AssignNewLeaderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newLeaderId: string) => void
  team: TeamWithMembers | null
  currentLeader: WorkerWithTeam | null
}

const AssignNewLeaderModal: React.FC<AssignNewLeaderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  team,
  currentLeader
}) => {
  const [availableMembers, setAvailableMembers] = useState<any[]>([])
  const [selectedNewLeaderId, setSelectedNewLeaderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    if (isOpen && team) {
      fetchAvailableMembers()
    }
  }, [isOpen, team])

  const fetchAvailableMembers = async () => {
    try {
      setLoadingData(true)
      // الحصول على أعضاء الفريق باستثناء القائد الحالي
      const members = team?.members?.filter(member => 
        member.worker && 
        member.worker.id !== currentLeader?.id &&
        member.worker.status === 'active'
      ) || []
      
      setAvailableMembers(members)
    } catch (error) {
      console.error('Error fetching team members:', error)
      toast.error('حدث خطأ في تحميل أعضاء الفريق')
    } finally {
      setLoadingData(false)
    }
  }

  const handleAssignNewLeader = async () => {
    if (!selectedNewLeaderId || !team) return

    setLoading(true)
    try {
      // تحديث قائد الفريق
      const result = await TeamsAPI.updateTeam(team.id, {
        leader_id: selectedNewLeaderId
      })

      if (result.success) {
        const newLeader = availableMembers.find(m => m.worker?.id === selectedNewLeaderId)
        toast.success(`تم تعيين "${newLeader?.worker?.name}" كقائد جديد للفريق بنجاح`)
        onSuccess(selectedNewLeaderId)
        onClose()
      } else {
        toast.error(result.error || 'حدث خطأ أثناء تعيين القائد الجديد')
      }
    } catch (error) {
      console.error('Error assigning new leader:', error)
      toast.error('حدث خطأ أثناء تعيين القائد الجديد')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedNewLeaderId('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-t-xl">
          <h2 className="text-xl font-bold flex items-center">
            <Crown className="h-6 w-6 ml-2" />
            تعيين قائد جديد
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* تحذير */}
          <div className="flex items-start p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-500 ml-2 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">تنبيه مهم</p>
              <p>
                لنقل القائد الحالي "<span className="font-semibold">{currentLeader?.name}</span>" 
                يجب تعيين قائد جديد للفريق "<span className="font-semibold">{team?.name}</span>" أولاً.
              </p>
            </div>
          </div>

          {/* اختيار القائد الجديد */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اختر القائد الجديد
            </label>
            {loadingData ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="small" text="جاري تحميل الأعضاء..." />
              </div>
            ) : availableMembers.length > 0 ? (
              <select
                value={selectedNewLeaderId}
                onChange={(e) => setSelectedNewLeaderId(e.target.value)}
                className="input w-full"
              >
                <option value="">اختر عضو ليصبح القائد الجديد</option>
                {availableMembers.map(member => (
                  <option key={member.worker.id} value={member.worker.id}>
                    {member.worker.name} - {member.worker.phone}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">لا يوجد أعضاء متاحين في الفريق لتعيينهم كقائد</p>
                <p className="text-xs text-gray-400 mt-1">يجب إضافة أعضاء للفريق أولاً</p>
              </div>
            )}
          </div>

          {/* معاينة التغيير */}
          {selectedNewLeaderId && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-center space-x-4 space-x-reverse">
                <div className="text-center">
                  <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center mb-2">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {currentLeader?.name}
                  </p>
                  <p className="text-xs text-gray-600">القائد الحالي</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl text-green-500">→</div>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mb-2">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {availableMembers.find(m => m.worker?.id === selectedNewLeaderId)?.worker?.name}
                  </p>
                  <p className="text-xs text-gray-600">القائد الجديد</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 space-x-reverse p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="btn-secondary"
            disabled={loading}
          >
            إلغاء
          </button>
          <button
            onClick={handleAssignNewLeader}
            disabled={loading || !selectedNewLeaderId || availableMembers.length === 0}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center">
                <LoadingSpinner size="small" />
                <span className="mr-2">جاري التعيين...</span>
              </div>
            ) : (
              'تعيين القائد الجديد'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AssignNewLeaderModal