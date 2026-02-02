import React, { useState, useEffect } from 'react'
import { Users, Shield, Settings, Plus, Edit, Trash2, UserCheck, UserX, UserCog, Lock, Key } from 'lucide-react'
import { RolesAPI, type Role, type UserWithRole } from '../../lib/api/roles'
import RoleFormModal from '../../components/Forms/RoleFormModal'
import UserRoleModal from '../../components/Forms/UserRoleModal'
import UserFormModal from '../../components/Forms/UserFormModal'
import ResetPasswordModal from '../../components/Forms/ResetPasswordModal'
import { UsersAPI } from '../../lib/api/users'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import DeleteConfirmModal from '../../components/Modals/DeleteConfirmModal'



const RolesPage: React.FC = () => {
  const { } = useAuth()
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles')

  // Modal states
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [showUserRoleModal, setShowUserRoleModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null)
  const [showUserFormModal, setShowUserFormModal] = useState(false)
  const [userFormTarget, setUserFormTarget] = useState<UserWithRole | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'role' | 'user', id: string, name: string } | null>(null)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false)
  const [resetPasswordTarget, setResetPasswordTarget] = useState<{ id: string, name: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [rolesResponse, usersResponse] = await Promise.all([
        RolesAPI.getRoles(),
        RolesAPI.getUsersWithRoles()
      ])

      if (rolesResponse.success) {
        setRoles(rolesResponse.data ?? [])
      } else {
        toast.error(rolesResponse.error || 'خطأ في تحميل الأدوار')
      }

      if (usersResponse.success) {
        setUsers(usersResponse.data ?? [])
      } else {
        toast.error(usersResponse.error || 'خطأ في تحميل المستخدمين')
      }
    } catch (error) {
      toast.error('خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRole = () => {
    setSelectedRole(null)
    setShowRoleModal(true)
  }

  const handleEditRole = (role: Role) => {
    setSelectedRole(role)
    setShowRoleModal(true)
  }

  const handleDeleteRole = (role: Role) => {
    setDeleteTarget({ type: 'role', id: role.id, name: role.name_ar })
    setShowDeleteModal(true)
  }

  const handleCreateUser = () => {
    setUserFormTarget(null)
    setShowUserFormModal(true)
  }

  const handleEditUser = (user: UserWithRole) => {
    setUserFormTarget(user)
    setShowUserFormModal(true)
  }

  const handleEditUserRole = (user: UserWithRole) => {
    setSelectedUser(user)
    setShowUserRoleModal(true)
  }

  const handleDeleteUser = (user: UserWithRole) => {
    setDeleteTarget({ type: 'user', id: user.id, name: user.full_name })
    setShowDeleteModal(true)
  }

  const handleResetPassword = (user: UserWithRole) => {
    setResetPasswordTarget({ id: user.id, name: user.full_name })
    setShowResetPasswordModal(true)
  }

  const handleToggleUserStatus = async (user: UserWithRole) => {
    try {
      const response = await RolesAPI.toggleUserStatus(user.id, !user.is_active)
      if (response.success) {
        toast.success(response.message || 'تم تحديث حالة المستخدم')
        loadData()
      } else {
        toast.error(response.error || 'خطأ في تحديث حالة المستخدم')
      }
    } catch (error) {
      toast.error('خطأ في تحديث حالة المستخدم')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    try {
      if (deleteTarget.type === 'role') {
        const response = await RolesAPI.deleteRole(deleteTarget.id)
        if (response.success) {
          toast.success(response.message || 'تم حذف الدور بنجاح')
          loadData()
        } else {
          toast.error(response.error || 'خطأ في حذف الدور')
        }
      } else if (deleteTarget.type === 'user') {
        const response = await UsersAPI.deleteUser(deleteTarget.id)
        if (response.success) {
          toast.success(response.message || 'تم حذف المستخدم بنجاح')
          loadData()
        } else {
          toast.error(response.error || 'خطأ في حذف المستخدم')
        }
      }
    } catch (error) {
      toast.error('خطأ في عملية الحذف')
    } finally {
      setShowDeleteModal(false)
      setDeleteTarget(null)
    }
  }

  const getRoleColor = (roleName: string) => {
    switch (roleName) {
      case 'manager':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'operations_supervisor':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'receptionist':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'team_leader':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'technician':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPermissionCount = (permissions: Record<string, any>) => {
    if (permissions.admin) return 'جميع الصلاحيات'

    let count = 0
    Object.values(permissions).forEach(section => {
      if (typeof section === 'object' && section !== null) {
        Object.values(section).forEach(permission => {
          if (permission === true) count++
        })
      }
    })
    return `${count} صلاحية`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-8 w-8 text-primary-600" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">إدارة الأدوار والصلاحيات</h1>
        </div>
        <p className="text-gray-600 mt-2">
          إدارة أدوار المستخدمين وصلاحياتهم في النظام
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card-compact bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">إجمالي الأدوار</p>
              <p className="text-2xl font-bold text-blue-800">{roles.length}</p>
            </div>
            <div className="p-3 bg-blue-500 rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">الأدوار النشطة</p>
              <p className="text-2xl font-bold text-green-800">{roles.filter(r => r.is_active).length}</p>
            </div>
            <div className="p-3 bg-green-500 rounded-lg">
              <Lock className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">إجمالي المستخدمين</p>
              <p className="text-2xl font-bold text-purple-800">{users.length}</p>
            </div>
            <div className="p-3 bg-purple-500 rounded-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card-compact bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">المستخدمون النشطون</p>
              <p className="text-2xl font-bold text-orange-800">{users.filter(u => u.is_active).length}</p>
            </div>
            <div className="p-3 bg-orange-500 rounded-lg">
              <UserCog className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="card-compact">
          <nav className="flex space-x-8" dir="ltr">
            <button
              onClick={() => setActiveTab('roles')}
              className={`py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === 'roles'
                ? 'bg-primary-100 text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                الأدوار ({roles.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${activeTab === 'users'
                ? 'bg-primary-100 text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                المستخدمون ({users.length})
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div>
          {/* Actions */}
          <div className="mb-6 flex justify-between items-center">
            <div className="flex gap-3">
              <button
                onClick={handleCreateRole}
                className="btn-primary hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Plus className="h-4 w-4" />
                إضافة دور جديد
              </button>
            </div>
          </div>

          {/* Roles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => (
              <div key={role.id} className="card-elevated hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(role.name)}`}>
                      {role.name_ar}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mt-2">{role.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditRole(role)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {role.description && (
                  <p className="text-gray-600 text-sm mb-3">{role.description}</p>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {getPermissionCount(role.permissions)}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs ${role.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                    }`}>
                    {role.is_active ? 'نشط' : 'غير نشط'}
                  </span>
                </div>

                <div className="mt-4 text-xs text-gray-400">
                  المستخدمون: {users.filter(u => u.role_id === role.id).length}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <div className="mb-6 flex justify-between items-center">
            <button
              onClick={handleCreateUser}
              className="btn-primary hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Plus className="h-4 w-4" />
              إضافة مستخدم جديد
            </button>
          </div>

          {/* Users Table */}
          <div className="card-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">
                      المستخدم
                    </th>
                    <th className="table-header-cell">
                      الدور
                    </th>
                    <th className="table-header-cell">
                      الحالة
                    </th>
                    <th className="table-header-cell">
                      تاريخ الإنشاء
                    </th>
                    <th className="table-header-cell">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {users.map((user) => (
                    <tr key={user.id} className="table-row">
                      <td className="table-cell">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.full_name}
                          </div>
                          {user.phone && (
                            <div className="text-sm text-gray-500">{user.phone}</div>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        {user.role ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(user.role.name)}`}>
                            {user.role.name_ar}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">بدون دور</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}>
                          {user.is_active ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                      <td className="table-cell text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('ar-AE')}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditUserRole(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                            title="تغيير الدور"
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEditUser(user)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                            title="تعديل المستخدم"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                            title="حذف المستخدم"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(user)}
                            className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md ${user.is_active
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-green-600 hover:bg-green-50'
                              }`}
                            title={user.is_active ? 'إلغاء التفعيل' : 'تفعيل'}
                          >
                            {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleResetPassword(user)}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                            title="إعادة تعيين كلمة المرور"
                          >
                            <Key className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showRoleModal && (
        <RoleFormModal
          role={selectedRole}
          onClose={() => {
            setShowRoleModal(false)
            setSelectedRole(null)
          }}
          onSuccess={() => {
            setShowRoleModal(false)
            setSelectedRole(null)
            loadData()
          }}
        />
      )}

      {showUserRoleModal && selectedUser && (
        <UserRoleModal
          user={selectedUser}
          roles={roles}
          onClose={() => {
            setShowUserRoleModal(false)
            setSelectedUser(null)
          }}
          onSuccess={() => {
            setShowUserRoleModal(false)
            setSelectedUser(null)
            loadData()
          }}
        />
      )}

      {showUserFormModal && (
        <UserFormModal
          user={userFormTarget}
          roles={roles}
          onClose={() => {
            setShowUserFormModal(false)
            setUserFormTarget(null)
          }}
          onSuccess={() => {
            setShowUserFormModal(false)
            setUserFormTarget(null)
            loadData()
          }}
        />
      )}

      {showDeleteModal && deleteTarget && (
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false)
            setDeleteTarget(null)
          }}
          onConfirm={confirmDelete}
          title={`حذف ${deleteTarget.type === 'role' ? 'الدور' : 'المستخدم'}`}
          message={`هل أنت متأكد من حذف ${deleteTarget.type === 'role' ? 'الدور' : 'المستخدم'} "${deleteTarget.name}"؟ هذا الإجراء لا يمكن التراجع عنه.`}
        />
      )}

      {showResetPasswordModal && resetPasswordTarget && (
        <ResetPasswordModal
          userId={resetPasswordTarget.id}
          userName={resetPasswordTarget.name}
          onClose={() => {
            setShowResetPasswordModal(false)
            setResetPasswordTarget(null)
          }}
          onSuccess={() => {
            setShowResetPasswordModal(false)
            setResetPasswordTarget(null)
          }}
        />
      )}
    </div>
  )
}

export default RolesPage
