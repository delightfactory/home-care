import React, { useState, useEffect } from 'react'
import { X, ArrowRight, Users, Crown } from 'lucide-react'
import { WorkerWithTeam, TeamWithMembers } from '../../types'
import { TeamsAPI } from '../../api/workers'
import LoadingSpinner from '../UI/LoadingSpinner'
import AssignNewLeaderModal from './AssignNewLeaderModal'
import toast from 'react-hot-toast'

interface TransferWorkerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  worker: WorkerWithTeam | null
}

const TransferWorkerModal: React.FC<TransferWorkerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  worker
}) => {
  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [isLeader, setIsLeader] = useState(false)
  const [showAssignLeaderModal, setShowAssignLeaderModal] = useState(false)
  const [currentTeam, setCurrentTeam] = useState<TeamWithMembers | null>(null)

  useEffect(() => {
    if (isOpen && worker) {
      fetchTeams()
      checkIfLeader()
      fetchCurrentTeam()
    }
  }, [isOpen, worker])

  const fetchTeams = async () => {
    try {
      setLoadingData(true)
      const teamsData = await TeamsAPI.getTeams()
      // فلترة الفرق النشطة فقط واستبعاد الفريق الحالي للعامل
      const availableTeams = teamsData.filter(team => 
        team.is_active && team.id !== worker?.team?.id
      )
      setTeams(availableTeams)
    } catch (error) {
      console.error('Error fetching teams:', error)
      toast.error('حدث خطأ في تحميل الفرق')
    } finally {
      setLoadingData(false)
    }
  }

  const fetchCurrentTeam = async () => {
    if (worker?.team?.id) {
      try {
        const teamData = await TeamsAPI.getTeamById(worker.team.id)
        setCurrentTeam(teamData)
      } catch (error) {
        console.error('Error fetching current team:', error)
      }
    }
  }

  const handleNewLeaderAssigned = () => {
    // تحديث حالة isLeader لأن العامل لم يعد قائداً
    setIsLeader(false)
    setShowAssignLeaderModal(false)
    
    // إظهار رسالة نجاح وتمكين النقل
    toast.success('تم تعيين القائد الجديد بنجاح! يمكنك الآن نقل العامل')
  }

  const checkIfLeader = () => {
    if (worker?.team) {
      setIsLeader(worker.team.leader_id === worker.id)
    }
  }

  const handleTransfer = async () => {
    if (!worker || !selectedTeamId) return

    setLoading(true)
    try {
      const result = await TeamsAPI.transferWorker(
        worker.id,
        worker.team?.id || null,
        selectedTeamId
      )

      if (result.success) {
        toast.success(result.message || 'تم نقل العامل بنجاح')
        onSuccess()
        onClose()
      } else {
        toast.error(result.error || 'حدث خطأ أثناء نقل العامل')
      }
    } catch (error) {
      console.error('Error transferring worker:', error)
      toast.error('حدث خطأ أثناء نقل العامل')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedTeamId('')
    setShowAssignLeaderModal(false)
    setCurrentTeam(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Users className="h-6 w-6 ml-2 text-primary-600" />
            نقل العامل
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* معلومات العامل */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">معلومات العامل</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-medium">الاسم:</span> {worker?.name}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">الفريق الحالي:</span> {worker?.team?.name || 'غير محدد'}
              </p>
              {isLeader && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center mb-3">
                    <Crown className="h-5 w-5 text-yellow-500 ml-2" />
                    <p className="text-sm text-yellow-800 font-medium">
                      هذا العامل قائد للفريق الحالي
                    </p>
                  </div>
                  <p className="text-xs text-yellow-700 mb-3">
                    لنقل قائد الفريق، يجب تعيين قائد جديد أولاً
                  </p>
                  <button
                    onClick={() => setShowAssignLeaderModal(true)}
                    className="w-full btn-warning text-sm py-2 flex items-center justify-center"
                    type="button"
                  >
                    <Crown className="h-4 w-4 ml-2" />
                    تعيين قائد جديد للفريق
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* اختيار الفريق الجديد */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الفريق الجديد
            </label>
            {loadingData ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="small" text="جاري تحميل الفرق..." />
              </div>
            ) : (
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="input w-full"
              >
                <option value="">اختر الفريق الجديد</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.members?.length || 0} أعضاء)
                  </option>
                ))}
              </select>
            )}
            {isLeader && (
              <p className="text-sm text-yellow-600 mt-1">
                💡 نصيحة: استخدم زر "تعيين قائد جديد" أعلاه لتمكين النقل
              </p>
            )}
          </div>

          {/* معاينة النقل */}
          {selectedTeamId && !isLeader && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-center space-x-4 space-x-reverse">
                <div className="text-center">
                  <p className="text-sm font-medium text-blue-900">
                    {worker?.team?.name || 'بدون فريق'}
                  </p>
                  <p className="text-xs text-blue-600">الفريق الحالي</p>
                </div>
                <ArrowRight className="h-6 w-6 text-blue-500" />
                <div className="text-center">
                  <p className="text-sm font-medium text-blue-900">
                    {teams.find(t => t.id === selectedTeamId)?.name}
                  </p>
                  <p className="text-xs text-blue-600">الفريق الجديد</p>
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
            onClick={handleTransfer}
            disabled={loading || !selectedTeamId}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center">
                <LoadingSpinner size="small" />
                <span className="mr-2">جاري النقل...</span>
              </div>
            ) : (
              'تأكيد النقل'
            )}
          </button>
        </div>
      </div>

      {/* نموذج تعيين قائد جديد */}
      {showAssignLeaderModal && currentTeam && (
        <AssignNewLeaderModal
          isOpen={showAssignLeaderModal}
          onClose={() => setShowAssignLeaderModal(false)}
          team={currentTeam}
          currentLeader={worker}
          onSuccess={handleNewLeaderAssigned}
        />
      )}
    </div>
  )
}

export default TransferWorkerModal