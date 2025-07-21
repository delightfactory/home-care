import React, { useEffect, useState } from 'react'
import { Plus, Search, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { CustomersAPI } from '../../api'
import { CustomerWithOrders } from '../../types'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import CustomerFormModal from '../../components/Forms/CustomerFormModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'
import toast from 'react-hot-toast'

const CustomersPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [customers, setCustomers] = useState<CustomerWithOrders[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithOrders | undefined>()
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [statusFilter])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const filters = statusFilter === 'all' ? undefined : { is_active: statusFilter === 'active' }
      const response = await CustomersAPI.getCustomers(filters)
      setCustomers(response.data)
    } catch (error) {
      toast.error('حدث خطأ في تحميل العملاء')
      console.error('Customers fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return
    
    setDeleteLoading(true)
    try {
      await CustomersAPI.deleteCustomer(selectedCustomer.id)
      toast.success('تم حذف العميل بنجاح')
      setShowDeleteModal(false)
      setSelectedCustomer(undefined)
      fetchCustomers()
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف العميل')
      console.error('Delete customer error:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleToggleActive = async (customer: CustomerWithOrders) => {
    try {
      await CustomersAPI.updateCustomer(customer.id, { is_active: !customer.is_active })
      toast.success('تم تحديث حالة العميل')
      fetchCustomers()
    } catch (error) {
      toast.error('حدث خطأ في تحديث الحالة')
      console.error(error)
    }
  }

  const filteredCustomers = customers
    .filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm)
    )
    .filter(c =>
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
          ? c.is_active
          : !c.is_active
    )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل العملاء..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة العملاء</h1>
          <p className="text-gray-600 mt-1">
            إدارة قاعدة بيانات العملاء وتاريخ الخدمات
          </p>
        </div>
        <button 
          onClick={() => {
            setSelectedCustomer(undefined)
            setFormMode('create')
            setShowFormModal(true)
          }}
          className="btn-primary"
        >
          <Plus className="h-5 w-5 ml-2" />
          إضافة عميل جديد
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Search */}
        <div className="card flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="البحث عن عميل بالاسم أو رقم الهاتف..."
              className="input pr-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        {/* Status Filter */}
        <div className="card">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="input">
            <option value="all">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">موقوف</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">الاسم</th>
                <th className="table-header-cell">رقم الهاتف</th>
                <th className="table-header-cell">المنطقة</th>
                <th className="table-header-cell">عدد الطلبات</th>
                <th className="table-header-cell">الحالة</th>
                <th className="table-header-cell">تاريخ التسجيل</th>
                <th className="table-header-cell">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="table-row">
                  <td className="table-cell font-medium">{customer.name}</td>
                  <td className="table-cell">{customer.phone}</td>
                  <td className="table-cell">{customer.area || 'غير محدد'}</td>
                  <td className="table-cell">{customer.total_orders || 0}</td>
                   <td className="table-cell">
                     {customer.is_active ? (
                       <span className="badge badge-success">نشط</span>
                     ) : (
                       <span className="badge badge-gray">موقوف</span>
                     )}
                   </td>
                  <td className="table-cell">
                    {new Date(customer.created_at).toLocaleDateString('ar-AE')}
                  </td>
                  <td className="table-cell">
                    <div className="flex space-x-2 space-x-reverse">
                      <button 
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setFormMode('edit')
                          setShowFormModal(true)
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="تعديل"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(customer)}
                        className={`p-2 ${customer.is_active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'} rounded`}
                        title={customer.is_active ? 'إيقاف' : 'إعادة تفعيل'}
                      >
                        {customer.is_active ? <ToggleLeft className="h-4 w-4"/> : <ToggleRight className="h-4 w-4"/>}
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedCustomer(customer)
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
          
          {filteredCustomers.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">لا توجد عملاء مطابقين للبحث</p>
            </div>
          )}
        </div>
      </div>

      {/* Customer Form Modal */}
      <CustomerFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false)
          setSelectedCustomer(undefined)
        }}
        onSuccess={() => {
          fetchCustomers()
        }}
        customer={selectedCustomer}
        mode={formMode}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedCustomer(undefined)
        }}
        onConfirm={handleDeleteCustomer}
        title="حذف العميل"
        message="هل أنت متأكد من رغبتك في حذف هذا العميل؟ سيتم حذف جميع البيانات المرتبطة به."
        itemName={selectedCustomer?.name}
        loading={deleteLoading}
      />
    </div>
  )
}

export default CustomersPage
