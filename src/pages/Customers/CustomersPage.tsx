import React, { useEffect, useState } from 'react'
import { Plus, Search, Edit, Trash2, ToggleLeft, ToggleRight, Users, UserCheck, UserX, ShoppingCart } from 'lucide-react'
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
      <div className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-xl p-6 border border-blue-200">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-900 bg-clip-text text-transparent">
              إدارة العملاء
            </h1>
            <p className="text-gray-600 mt-2 text-lg">
              إدارة قاعدة بيانات العملاء وتاريخ الخدمات
            </p>
            <div className="flex items-center mt-3 space-x-4 space-x-reverse">
              <span className="text-sm text-gray-500">إجمالي العملاء:</span>
              <span className="font-bold text-blue-700">{customers.length}</span>
              <span className="text-sm text-gray-500">النشطين:</span>
              <span className="font-bold text-green-600">{customers.filter(c => c.is_active).length}</span>
            </div>
          </div>
          <button 
            onClick={() => {
              setSelectedCustomer(undefined)
              setFormMode('create')
              setShowFormModal(true)
            }}
            className="btn-primary hover:scale-105 transition-transform duration-200 shadow-lg"
          >
            <Plus className="h-5 w-5 ml-2" />
            إضافة عميل جديد
          </button>
        </div>
      </div>

      {/* Customer Statistics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-compact bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-lg hover:shadow-xl group hover:scale-105 transition-all duration-300">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Users className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mr-4 flex-1">
              <p className="text-sm font-semibold text-gray-700 mb-1">إجمالي العملاء</p>
              <p className="text-2xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors duration-300">
                {customers.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card-compact bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-lg hover:shadow-xl group hover:scale-105 transition-all duration-300">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-4 rounded-xl bg-gradient-to-br from-green-500 to-green-600 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <UserCheck className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mr-4 flex-1">
              <p className="text-sm font-semibold text-gray-700 mb-1">العملاء النشطين</p>
              <p className="text-2xl font-bold text-gray-900 group-hover:text-green-700 transition-colors duration-300">
                {customers.filter(c => c.is_active).length}
              </p>
            </div>
          </div>
        </div>

        <div className="card-compact bg-gradient-to-br from-red-50 to-red-100 border-0 shadow-lg hover:shadow-xl group hover:scale-105 transition-all duration-300">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-4 rounded-xl bg-gradient-to-br from-red-500 to-red-600 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <UserX className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mr-4 flex-1">
              <p className="text-sm font-semibold text-gray-700 mb-1">العملاء الموقوفين</p>
              <p className="text-2xl font-bold text-gray-900 group-hover:text-red-700 transition-colors duration-300">
                {customers.filter(c => !c.is_active).length}
              </p>
            </div>
          </div>
        </div>

        <div className="card-compact bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-lg hover:shadow-xl group hover:scale-105 transition-all duration-300">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <ShoppingCart className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="mr-4 flex-1">
              <p className="text-sm font-semibold text-gray-700 mb-1">إجمالي الطلبات</p>
              <p className="text-2xl font-bold text-gray-900 group-hover:text-purple-700 transition-colors duration-300">
                {customers.reduce((sum, c) => sum + (c.total_orders || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-6">
        {/* Search */}
        <div className="card-compact flex-1 min-w-[300px]">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="البحث عن عميل بالاسم أو رقم الهاتف..."
              className="input pr-10 w-full focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        {/* Status Filter */}
        <div className="card-compact">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="input focus:ring-2 focus:ring-blue-500 transition-all duration-200">
            <option value="all">كل الحالات ({customers.length})</option>
            <option value="active">نشط ({customers.filter(c => c.is_active).length})</option>
            <option value="inactive">موقوف ({customers.filter(c => !c.is_active).length})</option>
          </select>
        </div>
        {/* Results Info */}
        <div className="card-compact bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">النتائج:</span>
            <span className="mr-2 font-bold text-blue-600">{filteredCustomers.length}</span>
            <span>عميل</span>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card-elevated">
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
                       <span className="badge badge-success animate-pulse">نشط</span>
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
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                        title="تعديل"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(customer)}
                        className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md ${
                          customer.is_active 
                            ? 'text-yellow-600 hover:bg-yellow-50' 
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={customer.is_active ? 'إيقاف' : 'إعادة تفعيل'}
                      >
                        {customer.is_active ? <ToggleLeft className="h-4 w-4"/> : <ToggleRight className="h-4 w-4"/>}
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedCustomer(customer)
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
        message={`هل أنت متأكد من رغبتك في حذف العميل "${selectedCustomer?.name}"؟ سيتم حذف جميع البيانات المرتبطة به.`}
        loading={deleteLoading}
      />
    </div>
  )
}

export default CustomersPage
