import React, { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Wrench, DollarSign, Clock, Package } from 'lucide-react'
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">إدارة الخدمات</h1>
          <p className="text-gray-600 mt-2">إدارة الخدمات والأسعار</p>
        </div>
        <button 
          onClick={() => {
            setSelectedService(undefined)
            setFormMode('create')
            setShowFormModal(true)
          }}
          className="btn-primary hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Plus className="h-5 w-5 ml-2" />
          إضافة خدمة جديدة
        </button>
      </div>

      {/* Services Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-compact bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">إجمالي الخدمات</p>
              <p className="text-2xl font-bold text-blue-800">{services.length}</p>
            </div>
            <div className="p-3 bg-blue-500 rounded-lg">
              <Wrench className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">متوسط السعر</p>
              <p className="text-2xl font-bold text-green-800">
                {services.length > 0 ? Math.round(services.reduce((sum, s) => sum + s.price, 0) / services.length) : 0} ج.م
              </p>
            </div>
            <div className="p-3 bg-green-500 rounded-lg">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">الفئات</p>
              <p className="text-2xl font-bold text-purple-800">{categories.length}</p>
            </div>
            <div className="p-3 bg-purple-500 rounded-lg">
              <Package className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">متوسط المدة</p>
              <p className="text-2xl font-bold text-orange-800">
                {services.length > 0 ? Math.round(services.filter(s => s.estimated_duration).reduce((sum, s) => sum + (s.estimated_duration || 0), 0) / services.filter(s => s.estimated_duration).length) || 0 : 0} د
              </p>
            </div>
            <div className="p-3 bg-orange-500 rounded-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="card-elevated">
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
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                        title="تعديل"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedService(service)
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
        message={`هل أنت متأكد من رغبتك في حذف الخدمة "${selectedService?.name_ar}"؟ قد يؤثر ذلك على الطلبات المرتبطة بها.`}
        loading={deleteLoading}
      />
    </div>
  )
}

export default ServicesPage
