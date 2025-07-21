import React, { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Search } from 'lucide-react'
import { WorkersAPI } from '../../api'
import { WorkerWithTeam } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import toast from 'react-hot-toast'
import WorkerFormModal from '../../components/Forms/WorkerFormModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'

const WorkersPage: React.FC = () => {
  const [workers, setWorkers] = useState<WorkerWithTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<WorkerWithTeam | undefined>()
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    fetchWorkers()
  }, [])

  const fetchWorkers = async () => {
    try {
      setLoading(true)
      const data = await WorkersAPI.getWorkers()
      setWorkers(data)
    } catch (error) {
      toast.error('حدث خطأ في تحميل العمال')
      console.error('Workers fetch error:', error)
    } finally {
      setLoading(false)
    }
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
      fetchWorkers()
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف العامل')
      console.error('Delete worker error:', error)
    } finally {
      setDeleteLoading(false)
    }
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

    return (
      <span className={`badge ${statusClasses[status as keyof typeof statusClasses] || 'badge-gray'}`}>
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
          <h1 className="text-2xl font-bold text-gray-900">إدارة العمال</h1>
          <p className="text-gray-600 mt-1">إدارة العمال ومهاراتهم وحالتهم</p>
        </div>
        <button 
          onClick={() => {
            setSelectedWorker(undefined)
            setFormMode('create')
            setShowFormModal(true)
          }}
          className="btn-primary"
        >
          <Plus className="h-5 w-5 ml-2" />
          إضافة عامل جديد
        </button>
      </div>

      <div className="card">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="البحث عن عامل بالاسم أو رقم الهاتف..."
            className="input pr-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
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
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="تعديل"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedWorker(worker)
                          setShowDeleteModal(true)
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
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
        onSuccess={() => {
          fetchWorkers()
        }}
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
        title="حذف العامل"
        message="هل أنت متأكد من رغبتك في حذف هذا العامل؟ قد يؤثر ذلك على الفرق والطلبات المرتبطة."
        itemName={selectedWorker?.name}
        loading={deleteLoading}
      />
    </div>
  )
}

export default WorkersPage
