import React, { useState } from 'react'
import { Users, Crown, ArrowRightLeft, Phone, FileText, Activity } from 'lucide-react'
import { TeamWithMembers, WorkerWithTeam } from '../../types'
import TransferWorkerModal from './TransferWorkerModal'
import SmartModal from '../UI/SmartModal'

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
      <SmartModal
        isOpen={isOpen}
        onClose={onClose}
        title={`تفاصيل الفريق: ${team.name}`}
        subtitle={`عرض معلومات وأعضاء الفريق`}
        icon={<Users className="h-6 w-6 text-white" />}
        size="xl"
        headerGradient="from-blue-600 via-indigo-600 to-purple-700"
        closeOnOutsideClick={!showTransferModal}
      >
        <div className="p-6 space-y-6">
          {/* معلومات الفريق */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-100 rounded-lg ml-3">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">معلومات عامة</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center mb-2">
                  <Users className="h-4 w-4 text-blue-500 ml-2" />
                  <span className="text-sm font-medium text-gray-700">اسم الفريق</span>
                </div>
                <p className="text-gray-900 font-medium">{team.name}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center mb-2">
                  <Activity className="h-4 w-4 text-green-500 ml-2" />
                  <span className="text-sm font-medium text-gray-700">الحالة</span>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  team.status === 'active' 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {team.status === 'active' ? 'نشط' : 'غير نشط'}
                </span>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center mb-2">
                  <Users className="h-4 w-4 text-purple-500 ml-2" />
                  <span className="text-sm font-medium text-gray-700">عدد الأعضاء</span>
                </div>
                <p className="text-gray-900 font-medium">{team.members?.length || 0}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center mb-2">
                  <Crown className="h-4 w-4 text-yellow-500 ml-2" />
                  <span className="text-sm font-medium text-gray-700">قائد الفريق</span>
                </div>
                <p className="text-gray-900 font-medium">{team.leader?.name || 'غير محدد'}</p>
              </div>
            </div>
            {team.description && (
              <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center mb-2">
                  <FileText className="h-4 w-4 text-gray-500 ml-2" />
                  <span className="text-sm font-medium text-gray-700">الوصف</span>
                </div>
                <p className="text-gray-700">{team.description}</p>
              </div>
            )}
          </div>

          {/* قائد الفريق */}
          {team.leader && (
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-yellow-100 rounded-lg ml-3">
                  <Crown className="h-5 w-5 text-yellow-600" />
                </div>
                <h3 className="text-lg font-semibold text-yellow-900">قائد الفريق</h3>
              </div>
              <div className="bg-white rounded-lg p-4 border border-yellow-200">
                <div className="flex items-center space-x-4 space-x-reverse">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="text-white font-bold text-lg">
                      {team.leader.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center mb-1">
                      <Crown className="h-4 w-4 text-yellow-500 ml-2" />
                      <p className="font-semibold text-gray-900 truncate">{team.leader.name}</p>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 ml-1 flex-shrink-0" />
                      <span className="truncate">{team.leader.phone}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* أعضاء الفريق */}
          <div>
            <div className="flex items-center mb-4">
              <div className="p-2 bg-purple-100 rounded-lg ml-3">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">أعضاء الفريق</h3>
              <span className="mr-auto bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full">
                {team.members?.length || 0} عضو
              </span>
            </div>
            {team.members && team.members.length > 0 ? (
              <div className="space-y-3">
                {team.members.map((member, index) => (
                  <div key={member.worker?.id || `member-${index}`} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center space-x-4 space-x-reverse flex-1 min-w-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                          member.worker?.id === team.leader_id 
                            ? 'bg-gradient-to-br from-yellow-500 to-orange-500' 
                            : 'bg-gradient-to-br from-gray-500 to-gray-600'
                        }`}>
                          <span className="text-white font-bold text-lg">
                            {member.worker?.name?.charAt(0) || '؟'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center mb-1">
                            <p className="font-semibold text-gray-900 truncate">
                              {member.worker?.name || 'غير محدد'}
                            </p>
                            {member.worker?.id === team.leader_id && (
                              <div className="mr-2 flex items-center bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                                <Crown className="h-3 w-3 ml-1" />
                                قائد
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="h-4 w-4 ml-1 flex-shrink-0" />
                              <span className="truncate">{member.worker?.phone || 'غير محدد'}</span>
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium self-start sm:self-auto ${
                              member.worker?.status === 'active' 
                                ? 'bg-green-100 text-green-800 border border-green-200' 
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {member.worker?.status === 'active' ? 'نشط' : 'غير نشط'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {member.worker && (
                        <button
                          onClick={() => handleTransferWorker(member)}
                          className="p-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110 flex-shrink-0 border border-blue-200 hover:border-blue-300"
                          title="نقل إلى فريق آخر"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 text-lg font-medium">لا يوجد أعضاء في هذا الفريق</p>
                <p className="text-gray-400 text-sm mt-1">يمكنك إضافة أعضاء من خلال تعديل الفريق</p>
              </div>
            )}
          </div>
        </div>
      </SmartModal>

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