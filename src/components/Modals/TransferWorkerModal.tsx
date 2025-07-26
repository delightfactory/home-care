import React, { useState, useEffect } from 'react'
import { ArrowRight, Users, Crown, ArrowRightLeft } from 'lucide-react'
import { WorkerWithTeam, TeamWithMembers } from '../../types'
import { TeamsAPI } from '../../api/workers'
import LoadingSpinner from '../UI/LoadingSpinner'
import SmartModal from '../UI/SmartModal'
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

  return (
    <>
      <SmartModal
        isOpen={isOpen}
        onClose={handleClose}
        title="نقل العامل"
        icon={<ArrowRightLeft className="h-5 w-5" />}
        size="md"
        headerGradient="from-blue-500 via-blue-600 to-blue-700"
        contentClassName="p-6"
        className="ring-1 ring-blue-100"
      >
        <div className="space-y-6">
          {/* معلومات العامل */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mr-3">معلومات العامل</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                <span className="text-sm font-medium text-gray-700">الاسم:</span>
                <span className="text-sm text-gray-900 font-semibold">{worker?.name}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                <span className="text-sm font-medium text-gray-700">الفريق الحالي:</span>
                <span className="text-sm text-gray-900 font-semibold">{worker?.team?.name || 'غير محدد'}</span>
              </div>
              {isLeader && (
                <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl">
                  <div className="flex items-center mb-3">
                    <Crown className="h-5 w-5 text-yellow-600 ml-2" />
                    <p className="text-sm text-yellow-800 font-semibold">
                      هذا العامل قائد للفريق الحالي
                    </p>
                  </div>
                  <p className="text-xs text-yellow-700 mb-4 leading-relaxed">
                    لنقل قائد الفريق، يجب تعيين قائد جديد أولاً. هذا يضمن استمرارية إدارة الفريق.
                  </p>
                  <button
                    onClick={() => setShowAssignLeaderModal(true)}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center shadow-md hover:shadow-lg transform hover:scale-105"
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
            <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
              <ArrowRightLeft className="h-4 w-4 ml-2 text-blue-500" />
              الفريق الجديد
            </label>
            {loadingData ? (
              <div className="flex items-center justify-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <LoadingSpinner size="small" text="جاري تحميل الفرق..." />
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="input w-full pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  disabled={isLeader}
                >
                  <option value="">اختر الفريق الجديد</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.members?.length || 0} أعضاء)
                    </option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Users className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            )}
            {isLeader && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-700 flex items-center">
                  <Crown className="h-4 w-4 ml-2 text-yellow-600" />
                  💡 نصيحة: استخدم زر "تعيين قائد جديد" أعلاه لتمكين النقل
                </p>
              </div>
            )}
          </div>

          {/* معاينة النقل */}
          {selectedTeamId && !isLeader && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-blue-900 mb-4 flex items-center">
                <ArrowRightLeft className="h-4 w-4 ml-2" />
                معاينة النقل
              </h4>
              <div className="flex items-center justify-center space-x-6 space-x-reverse">
                <div className="text-center p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Users className="h-4 w-4 text-gray-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {worker?.team?.name || 'بدون فريق'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">الفريق الحالي</p>
                </div>
                <div className="flex flex-col items-center">
                  <ArrowRight className="h-6 w-6 text-blue-500 mb-1" />
                  <span className="text-xs text-blue-600 font-medium">نقل</span>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-blue-900">
                    {teams.find(t => t.id === selectedTeamId)?.name}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">الفريق الجديد</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 space-x-reverse pt-6 border-t border-gray-200 mt-6">
          <button
            onClick={handleClose}
            className="btn-secondary"
            disabled={loading}
          >
            إلغاء
          </button>
          <button
            onClick={handleTransfer}
            disabled={loading || !selectedTeamId || isLeader}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" />
                <span className="mr-2">جاري النقل...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4 ml-2" />
                تأكيد النقل
              </>
            )}
          </button>
        </div>
      </SmartModal>

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
    </>
  )
}

export default TransferWorkerModal