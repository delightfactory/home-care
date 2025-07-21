import React, { useEffect, useState } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { ServicesAPI } from '../../api'
import { ServiceWithCategory, ServiceCategory } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import ServiceFormModal from '../../components/Forms/ServiceFormModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'
import toast from 'react-hot-toast'

const ServicesPage: React.FC = () => {
  const [services, setServices] = useState<ServiceWithCategory[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedService, setSelectedService] = useState<ServiceWithCategory | undefined>()
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    try {
      setLoading(true)
      const [servicesData, categoriesData] = await Promise.all([
        ServicesAPI.getServices(),
        ServicesAPI.getServiceCategories()
      ])
      setServices(servicesData)
      setCategories(categoriesData)
    } catch (error) {
      toast.error('حدث خطأ في تحميل الخدمات')
      console.error('Services fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteService = async () => {
    if (!selectedService) return
    
    setDeleteLoading(true)
    try {
      await ServicesAPI.deleteService(selectedService.id)
      toast.success('تم حذف الخدمة بنجاح')
      setShowDeleteModal(false)
      setSelectedService(undefined)
      fetchServices()
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف الخدمة')
      console.error('Delete service error:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل الخدمات..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة الخدمات</h1>
          <p className="text-gray-600 mt-1">إدارة الخدمات والأسعار</p>
        </div>
        <button 
          onClick={() => {
            setSelectedService(undefined)
            setFormMode('create')
            setShowFormModal(true)
          }}
          className="btn-primary"
        >
          <Plus className="h-5 w-5 ml-2" />
          إضافة خدمة جديدة
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">اسم الخدمة</th>
                <th className="table-header-cell">الفئة</th>
                <th className="table-header-cell">السعر</th>
                <th className="table-header-cell">الوحدة</th>
                <th className="table-header-cell">المدة المتوقعة</th>
                <th className="table-header-cell">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {services.map((service) => (
                <tr key={service.id} className="table-row">
                  <td className="table-cell font-medium">{service.name_ar}</td>
                  <td className="table-cell">{service.category?.name_ar}</td>
                  <td className="table-cell">{service.price} ج.م</td>
                  <td className="table-cell">{service.unit}</td>
                  <td className="table-cell">
                    {service.estimated_duration ? `${service.estimated_duration} دقيقة` : 'غير محدد'}
                  </td>
                  <td className="table-cell">
                    <div className="flex space-x-2 space-x-reverse">
                      <button 
                        onClick={() => {
                          setSelectedService(service)
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
                          setSelectedService(service)
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
        </div>
      </div>

      {/* Service Form Modal */}
      <ServiceFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false)
          setSelectedService(undefined)
        }}
        onSuccess={() => {
          fetchServices()
        }}
        service={selectedService}
        mode={formMode}
        categories={categories}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedService(undefined)
        }}
        onConfirm={handleDeleteService}
        title="حذف الخدمة"
        message="هل أنت متأكد من رغبتك في حذف هذه الخدمة؟ قد يؤثر ذلك على الطلبات المرتبطة بها."
        itemName={selectedService?.name_ar}
        loading={deleteLoading}
      />
    </div>
  )
}

export default ServicesPage
