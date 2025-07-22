import React, { useState } from 'react'
import { Plus, Edit, Trash2, Search, Users, UserCheck, UserX, Clock, Activity } from 'lucide-react'
import { WorkerWithTeam } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import toast from 'react-hot-toast'
import WorkerFormModal from '../../components/Forms/WorkerFormModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'
import { useWorkers, useSystemHealth } from '../../hooks/useEnhancedAPI'

const WorkersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<WorkerWithTeam | undefined>()
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Use optimized hooks for data fetching
  const { workers, loading, error, refresh } = useWorkers()
  const { health } = useSystemHealth()

  // Show error state if needed
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">حدث خطأ في تحميل العمال</p>
          <button onClick={refresh} className="btn-primary">
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }

  const handleDeleteWorker = async () => {
    if (!selectedWorker) return
    
    setDeleteLoading(true)
    try {
      // TODO: Implement delete worker API method
      console.log('Delete worker:', selectedWorker.id)
      toast.success('تم حذف العامل بنجاح')
      setShowDeleteModal(false)
      setSelectedWorker(undefined)
      refresh()
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف العامل')
      console.error('Delete worker error:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const onFormSuccess = () => {
    refresh() // Use hook's refresh instead of fetchWorkers
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      active: 'status-active',
      inactive: 'status-inactive',
      on_leave: 'status-warning'
    }
    
    const statusTexts = {
      active: 'نشط',
      inactive: 'غير نشط',
      on_leave: 'في إجازة'
    }

    const isActive = status === 'active'
    return (
      <span className={`badge ${statusClasses[status as keyof typeof statusClasses] || 'badge-gray'} ${isActive ? 'animate-pulse' : ''}`}>
        {statusTexts[status as keyof typeof statusTexts] || status}
      </span>
    )
  }

  const filteredWorkers = workers.filter(worker =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.phone.includes(searchTerm)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل العمال..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">إدارة العمال</h1>
          <p className="text-gray-600 mt-2">إدارة العمال ومهاراتهم وحالتهم</p>
        </div>
        <button 
          onClick={() => {
            setSelectedWorker(undefined)
            setFormMode('create')
            setShowFormModal(true)
          }}
          className="btn-primary hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Plus className="h-5 w-5 ml-2" />
          إضافة عامل جديد
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

      {/* Workers Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-compact bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">إجمالي العمال</p>
              <p className="text-2xl font-bold text-blue-800">{workers.length}</p>
            </div>
            <div className="p-3 bg-blue-500 rounded-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">نشطين</p>
              <p className="text-2xl font-bold text-green-800">{workers.filter(w => w.status === 'active').length}</p>
            </div>
            <div className="p-3 bg-green-500 rounded-lg">
              <UserCheck className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">غير نشطين</p>
              <p className="text-2xl font-bold text-red-800">{workers.filter(w => w.status === 'inactive').length}</p>
            </div>
            <div className="p-3 bg-red-500 rounded-lg">
              <UserX className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">في إجازة</p>
              <p className="text-2xl font-bold text-yellow-800">{workers.filter(w => w.status === 'on_leave').length}</p>
            </div>
            <div className="p-3 bg-yellow-500 rounded-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="card-compact">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="البحث عن عامل بالاسم أو رقم الهاتف..."
            className="input pr-10 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {searchTerm && (
          <div className="mt-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
            <p className="text-sm text-primary-700">
              عرض {filteredWorkers.length} من أصل {workers.length} عامل
            </p>
          </div>
        )}
      </div>

      <div className="card-elevated">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">الاسم</th>
                <th className="table-header-cell">رقم الهاتف</th>
                <th className="table-header-cell">المهارات</th>
                <th className="table-header-cell">الفريق</th>
                <th className="table-header-cell">الحالة</th>
                <th className="table-header-cell">تاريخ التوظيف</th>
                <th className="table-header-cell">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {filteredWorkers.map((worker) => (
                <tr key={worker.id} className="table-row">
                  <td className="table-cell font-medium">{worker.name}</td>
                  <td className="table-cell">{worker.phone}</td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {worker.skills?.slice(0, 3).map((skill, index) => (
                        <span key={index} className="badge badge-blue text-xs">
                          {skill}
                        </span>
                      ))}
                      {worker.skills && worker.skills.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{worker.skills.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="table-cell">{worker.team?.name || 'غير محدد'}</td>
                  <td className="table-cell">{getStatusBadge(worker.status)}</td>
                  <td className="table-cell">
                    {new Date(worker.hire_date).toLocaleDateString('ar-AE')}
                  </td>
                  <td className="table-cell">
                    <div className="flex space-x-2 space-x-reverse">
                      <button 
                        onClick={() => {
                          setSelectedWorker(worker)
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
                          setSelectedWorker(worker)
                          setShowDeleteModal(true)
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredWorkers.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">لا توجد عمال مطابقين للبحث</p>
            </div>
          )}
        </div>
      </div>

      {/* Worker Form Modal */}
      <WorkerFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false)
          setSelectedWorker(undefined)
        }}
        onSuccess={onFormSuccess}
        worker={selectedWorker}
        mode={formMode}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedWorker(undefined)
        }}
        onConfirm={handleDeleteWorker}
        message={`هل أنت متأكد من رغبتك في حذف العامل "${selectedWorker?.name}"؟ قد يؤثر ذلك على الفرق والطلبات المرتبطة.`}
        loading={deleteLoading}
      />
    </div>
  )
}

export default WorkersPage
