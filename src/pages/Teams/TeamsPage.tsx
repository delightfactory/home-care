import React, { useEffect, useState } from 'react'
import { Plus, Search, Edit, Trash2, Users } from 'lucide-react'
import { TeamsAPI } from '../../api'
import { TeamWithMembers } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import TeamFormModal from '../../components/Forms/TeamFormModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'
import toast from 'react-hot-toast'

const TeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembers | undefined>()
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    try {
      setLoading(true)
      const data = await TeamsAPI.getTeams()
      setTeams(data)
    } catch (error) {
      toast.error('حدث خطأ في تحميل الفرق')
      console.error('Teams fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return
    
    setDeleteLoading(true)
    try {
      const res = await TeamsAPI.deleteTeam(selectedTeam.id)
      if (!res.success) throw new Error(res.error)
      //
      toast.success('تم حذف الفريق بنجاح')
      setShowDeleteModal(false)
      setSelectedTeam(undefined)
      fetchTeams()
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف الفريق')
      console.error('Delete team error:', error)
    } finally {
      setDeleteLoading(false)
    }
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
          <h1 className="text-2xl font-bold text-gray-900">إدارة الفرق</h1>
          <p className="text-gray-600 mt-1">إدارة فرق العمل وأعضائها</p>
        </div>
        <button 
          onClick={() => {
            setSelectedTeam(undefined)
            setFormMode('create')
            setShowFormModal(true)
          }}
          className="btn-primary"
        >
          <Plus className="h-5 w-5 ml-2" />
          إضافة فريق جديد
        </button>
      </div>

      <div className="card">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="البحث عن فريق بالاسم..."
            className="input pr-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeams.map((team) => (
          <div key={team.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="mr-3">
                  <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                  <p className="text-sm text-gray-600">{team.description}</p>
                </div>
              </div>
              {getStatusBadge(team.status)}
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
                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                title="تعديل"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button 
                onClick={() => {
                  setSelectedTeam(team)
                  setShowDeleteModal(true)
                }}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
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
        onSuccess={() => {
          fetchTeams()
        }}
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
        title="حذف الفريق"
        message="هل أنت متأكد من رغبتك في حذف هذا الفريق؟ قد يؤثر ذلك على الطلبات والعمال المرتبطين."
        itemName={selectedTeam?.name}
        loading={deleteLoading}
      />
    </div>
  )
}

export default TeamsPage
