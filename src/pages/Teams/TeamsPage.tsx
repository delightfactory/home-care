import React, { useState } from 'react'
import { Plus, Search, Edit, Trash2, Users, UserCheck, UserX, Target, Activity } from 'lucide-react'
import { TeamWithMembers } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import TeamFormModal from '../../components/Forms/TeamFormModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'
import toast from 'react-hot-toast'
import { useTeams, useSystemHealth } from '../../hooks/useEnhancedAPI'

const TeamsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembers | undefined>()
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Use optimized hooks for data fetching
  const { teams, loading, error, refresh } = useTeams()
  const { health } = useSystemHealth()

  // Show error state if needed
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">حدث خطأ في تحميل الفرق</p>
          <button onClick={refresh} className="btn-primary">
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return
    
    setDeleteLoading(true)
    try {
      // TODO: Implement delete team API method
      console.log('Delete team:', selectedTeam.id)
      toast.success('تم حذف الفريق بنجاح')
      setShowDeleteModal(false)
      setSelectedTeam(undefined)
      refresh()
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف الفريق')
      console.error('Delete team error:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const onFormSuccess = () => {
    refresh() // Use hook's refresh instead of fetchTeams
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      active: 'status-active',
      inactive: 'status-inactive'
    }
    
    const statusTexts = {
      active: 'نشط',
      inactive: 'غير نشط'
    }

    return (
      <span className={`badge ${statusClasses[status as keyof typeof statusClasses] || 'badge-gray'}`}>
        {statusTexts[status as keyof typeof statusTexts] || status}
      </span>
    )
  }

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل الفرق..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">إدارة الفرق</h1>
          <p className="text-gray-600 mt-2">إدارة فرق العمل وأعضائها</p>
        </div>
        <button 
          onClick={() => {
            setSelectedTeam(undefined)
            setFormMode('create')
            setShowFormModal(true)
          }}
          className="btn-primary hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Plus className="h-5 w-5 ml-2" />
          إضافة فريق جديد
        </button>
      </div>

      {/* System Health Indicator */}
      {health && (
        <div className="card-compact bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 space-x-reverse">
              <Activity className="h-5 w-5 text-gray-600" />
              <div className={`w-3 h-3 rounded-full ${
                health.database?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-600">
                قاعدة البيانات: {health.database?.response_time_ms || 0}ms
              </span>
              <span className="text-sm text-gray-600">
                الكاش: {health.cache?.stats?.size ?? 0} عنصر
              </span>
              <span className="text-sm text-gray-600">
                الذاكرة: {Math.round((health.memory?.used ?? 0) / 1024 / 1024)}MB
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Teams Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-compact bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">إجمالي الفرق</p>
              <p className="text-2xl font-bold text-blue-800">{teams.length}</p>
            </div>
            <div className="p-3 bg-blue-500 rounded-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">فرق نشطة</p>
              <p className="text-2xl font-bold text-green-800">{teams.filter(t => t.status === 'active').length}</p>
            </div>
            <div className="p-3 bg-green-500 rounded-lg">
              <UserCheck className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">فرق غير نشطة</p>
              <p className="text-2xl font-bold text-red-800">{teams.filter(t => t.status === 'inactive').length}</p>
            </div>
            <div className="p-3 bg-red-500 rounded-lg">
              <UserX className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">إجمالي الأعضاء</p>
              <p className="text-2xl font-bold text-purple-800">{teams.reduce((sum, t) => sum + (t.members?.length || 0), 0)}</p>
            </div>
            <div className="p-3 bg-purple-500 rounded-lg">
              <Target className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="card-compact">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="البحث عن فريق بالاسم..."
            className="input pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {searchTerm && (
          <div className="mt-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
            <p className="text-sm text-primary-700">
              عرض {filteredTeams.length} من أصل {teams.length} فريق
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeams.map((team) => (
          <div key={team.id} className="card-elevated hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg shadow-sm">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="mr-3">
                  <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                  <p className="text-sm text-gray-600">{team.description}</p>
                </div>
              </div>
              <div className={team.status === 'active' ? 'animate-pulse' : ''}>
                {getStatusBadge(team.status)}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">قائد الفريق:</span>
                <span className="font-medium">{team.leader?.name || 'غير محدد'}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">عدد الأعضاء:</span>
                <span className="font-medium">{team.members?.length || 0}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">الطلبات النشطة:</span>
                <span className="font-medium">{team.active_orders || 0}</span>
              </div>

              {team.members && team.members.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">الأعضاء:</p>
                  <div className="flex flex-wrap gap-1">
                    {team.members.slice(0, 3).map((member, idx) => (
                      <span key={member.id || idx} className="badge badge-blue text-xs">
                        {member.worker?.name}
                      </span>
                    ))}
                    {team.members.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{team.members.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end space-x-2 space-x-reverse">
              <button 
                onClick={() => {
                  setSelectedTeam(team)
                  setFormMode('edit')
                  setShowFormModal(true)
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                title="تعديل"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button 
                onClick={() => {
                  setSelectedTeam(team)
                  setShowDeleteModal(true)
                }}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                title="حذف"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTeams.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">لا توجد فرق مطابقة للبحث</p>
        </div>
      )}

      {/* Team Form Modal */}
      <TeamFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false)
          setSelectedTeam(undefined)
        }}
        onSuccess={onFormSuccess}
        team={selectedTeam}
        mode={formMode}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedTeam(undefined)
        }}
        onConfirm={handleDeleteTeam}
        message={`هل أنت متأكد من رغبتك في حذف الفريق "${selectedTeam?.name}"؟ قد يؤثر ذلك على الطلبات والعمال المرتبطين.`}
        loading={deleteLoading}
      />
    </div>
  )
}

export default TeamsPage
