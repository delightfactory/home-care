import React, { useState } from 'react'
import { X, Users, Crown, ArrowRightLeft, Phone } from 'lucide-react'
import { TeamWithMembers, WorkerWithTeam } from '../../types'
import TransferWorkerModal from './TransferWorkerModal'

interface TeamDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  onRefresh: () => void
  team: TeamWithMembers | null | undefined
}

const TeamDetailsModal: React.FC<TeamDetailsModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  team
}) => {
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<WorkerWithTeam | null>(null)

  const handleTransferWorker = (member: any) => {
    // تحويل عضو الفريق إلى WorkerWithTeam
    const workerWithTeam: WorkerWithTeam = {
      ...member.worker,
      team: {
        id: team!.id,
        name: team!.name,
        leader_id: team!.leader_id
      }
    }
    setSelectedWorker(workerWithTeam)
    setShowTransferModal(true)
  }

  const handleTransferSuccess = () => {
    onRefresh()
    setShowTransferModal(false)
    setSelectedWorker(null)
  }

  if (!isOpen || !team) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Users className="h-6 w-6 ml-2 text-primary-600" />
              تفاصيل الفريق: {team.name}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-120px)] sm:max-h-[calc(90vh-120px)]">
            {/* معلومات الفريق */}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">معلومات عامة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">اسم الفريق:</span> {team.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">الحالة:</span>
                    <span className={`mr-2 px-2 py-1 rounded-full text-xs ${
                      team.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {team.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">عدد الأعضاء:</span> {team.members?.length || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">قائد الفريق:</span> {team.leader?.name || 'غير محدد'}
                  </p>
                </div>
              </div>
              {team.description && (
                <div className="mt-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">الوصف:</span> {team.description}
                  </p>
                </div>
              )}
            </div>

            {/* قائد الفريق */}
            {team.leader && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
                  <Crown className="h-5 w-5 ml-2 text-yellow-500" />
                  قائد الفريق
                </h3>
                <div className="flex items-center space-x-3 sm:space-x-4 space-x-reverse">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm sm:text-lg">
                      {team.leader.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-blue-900 truncate">{team.leader.name}</p>
                    <div className="flex items-center text-sm text-blue-700">
                      <Phone className="h-3 w-3 sm:h-4 sm:w-4 ml-1 flex-shrink-0" />
                      <span className="truncate">{team.leader.phone}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* أعضاء الفريق */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">أعضاء الفريق</h3>
              {team.members && team.members.length > 0 ? (
                <div className="space-y-2 sm:space-y-3">
                  {team.members.map((member, index) => (
                    <div key={member.worker?.id || `member-${index}`} className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-3 space-x-reverse flex-1 min-w-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-medium text-sm">
                              {member.worker?.name?.charAt(0) || '؟'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {member.worker?.name || 'غير محدد'}
                              {member.worker?.id === team.leader_id && (
                                <Crown className="inline h-3 w-3 sm:h-4 sm:w-4 ml-1 text-yellow-500" />
                              )}
                            </p>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 sm:space-x-reverse text-sm text-gray-600 gap-1 sm:gap-0">
                              <div className="flex items-center">
                                <Phone className="h-3 w-3 ml-1 flex-shrink-0" />
                                <span className="truncate">{member.worker?.phone || 'غير محدد'}</span>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs self-start sm:self-auto ${
                                member.worker?.status === 'active' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {member.worker?.status === 'active' ? 'نشط' : 'غير نشط'}
                              </span>
                            </div>
                          </div>
                        </div>
                        {member.worker && member.worker.id !== team.leader_id && (
                          <button
                            onClick={() => handleTransferWorker(member)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-110 flex-shrink-0"
                            title="نقل إلى فريق آخر"
                          >
                            <ArrowRightLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>لا يوجد أعضاء في هذا الفريق</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end p-4 sm:p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="btn-secondary w-full sm:w-auto"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>

      {/* Transfer Worker Modal */}
      <TransferWorkerModal
        isOpen={showTransferModal}
        onClose={() => {
          setShowTransferModal(false)
          setSelectedWorker(null)
        }}
        onSuccess={handleTransferSuccess}
        worker={selectedWorker}
      />
    </>
  )
}

export default TeamDetailsModal