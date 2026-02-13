// CustodyCreateModal - إنشاء حساب عهدة يدوياً
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    X, Loader2, Wallet, UserPlus, Users2, AlertCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface CustodyCreateModalProps {
    onClose: () => void
    onSuccess: () => void
}

interface UserOption {
    user_id: string
    display_name: string
    role_name: string
    has_custody: boolean
}

const CustodyCreateModal: React.FC<CustodyCreateModalProps> = ({
    onClose,
    onSuccess
}) => {
    const [loading, setLoading] = useState(false)
    const [dataLoading, setDataLoading] = useState(true)

    const [users, setUsers] = useState<UserOption[]>([])
    const [selectedUserId, setSelectedUserId] = useState('')
    const [holderType, setHolderType] = useState<'team_leader' | 'supervisor'>('team_leader')
    const [teamId, setTeamId] = useState('')
    const [teams, setTeams] = useState<{ id: string; name: string }[]>([])

    const loadData = useCallback(async () => {
        setDataLoading(true)
        try {
            // Fetch ALL users with their roles directly from users table
            const { data: usersData } = await supabase
                .from('users')
                .select('id, full_name, role:roles(name)')
                .eq('is_active', true)
                .order('full_name')

            // Fetch existing custody accounts
            const { data: custodyData } = await supabase
                .from('custody_accounts')
                .select('user_id')

            const existingUserIds = new Set((custodyData || []).map(c => c.user_id))

            // Fetch teams
            const { data: teamsData } = await supabase
                .from('teams')
                .select('id, name')
                .eq('is_active', true)
                .order('name')

            // Parse users with role names
            const parsed: UserOption[] = (usersData || []).map((u: any) => {
                const roleRelation = u.role
                const roleName = Array.isArray(roleRelation)
                    ? roleRelation[0]?.name || ''
                    : roleRelation?.name || ''
                return {
                    user_id: u.id,
                    display_name: u.full_name || u.id,
                    role_name: roleName,
                    has_custody: existingUserIds.has(u.id)
                }
            })

            // Debug: log available roles
            const uniqueRoles = [...new Set(parsed.map(u => u.role_name))].filter(Boolean)
            console.log('[CustodyCreateModal] Available roles:', uniqueRoles)
            console.log('[CustodyCreateModal] Users by role:',
                uniqueRoles.map(r => `${r}: ${parsed.filter(u => u.role_name === r).length}`).join(', ')
            )

            setUsers(parsed)
            setTeams(teamsData || [])
        } catch (err) {
            console.error(err)
            toast.error('خطأ في تحميل البيانات')
        } finally {
            setDataLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    // Reset selected user when holder type changes
    useEffect(() => {
        setSelectedUserId('')
    }, [holderType])

    // Filter: exclude users with existing custody + match role to holder type
    const availableUsers = useMemo(() => {
        return users.filter(u => {
            if (u.has_custody) return false
            if (!u.role_name) return false
            if (holderType === 'team_leader') {
                return u.role_name.includes('team_leader') || u.role_name.includes('قائد')
            } else {
                // supervisor: match any role containing 'supervisor' or 'مشرف'
                return u.role_name.includes('supervisor') || u.role_name.includes('مشرف')
            }
        })
    }, [users, holderType])

    const handleCreate = async () => {
        if (!selectedUserId) {
            toast.error('يرجى اختيار المستخدم')
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase
                .from('custody_accounts')
                .insert({
                    user_id: selectedUserId,
                    holder_type: holderType,
                    team_id: teamId || null,
                    is_active: true,
                    balance: 0
                })

            if (error) {
                if (error.code === '23505') {
                    toast.error('هذا المستخدم لديه عهدة بالفعل')
                } else {
                    throw error
                }
                return
            }

            toast.success('تم إنشاء حساب العهدة بنجاح')
            onSuccess()
        } catch (err) {
            console.error(err)
            toast.error('خطأ في إنشاء العهدة')
        } finally {
            setLoading(false)
        }
    }

    if (dataLoading) {
        return (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                    <span className="text-sm text-gray-500">جارٍ تحميل البيانات...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-l from-amber-50 to-white rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-xl">
                            <Wallet className="h-5 w-5 text-amber-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">إنشاء حساب عهدة</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* 1. Holder type — FIRST */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">نوع العهدة</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setHolderType('team_leader')}
                                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-medium ${holderType === 'team_leader'
                                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-500'
                                    }`}
                            >
                                <UserPlus className="h-5 w-5" />
                                قائد فريق
                            </button>
                            <button
                                onClick={() => setHolderType('supervisor')}
                                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-medium ${holderType === 'supervisor'
                                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-500'
                                    }`}
                            >
                                <Users2 className="h-5 w-5" />
                                مشرف
                            </button>
                        </div>
                    </div>

                    {/* 2. User selection — SECOND, filtered by role */}
                    <div>
                        <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
                            <UserPlus className="h-4 w-4 text-blue-500" />
                            {holderType === 'team_leader' ? 'قائد الفريق' : 'المشرف'}
                        </label>
                        {availableUsers.length === 0 ? (
                            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 text-sm p-3 rounded-xl">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                <span>
                                    {holderType === 'team_leader'
                                        ? 'لا يوجد قادة فرق متاحين (جميعهم لديهم عُهد بالفعل)'
                                        : 'لا يوجد مشرفين متاحين (جميعهم لديهم عُهد بالفعل)'
                                    }
                                </span>
                            </div>
                        ) : (
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="input w-full"
                                disabled={loading}
                            >
                                <option value="">
                                    {holderType === 'team_leader' ? 'اختر قائد الفريق' : 'اختر المشرف'}
                                </option>
                                {availableUsers.map(u => (
                                    <option key={u.user_id} value={u.user_id}>
                                        {u.display_name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* 3. Team (optional) */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">الفريق (اختياري)</label>
                        <select
                            value={teamId}
                            onChange={(e) => setTeamId(e.target.value)}
                            className="input w-full"
                            disabled={loading}
                        >
                            <option value="">بدون فريق</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Info note */}
                    <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                        <strong>ملاحظة:</strong> سيتم إنشاء الحساب برصيد 0 ج.م. يمكن إضافة رصيد من خلال عمليات التحصيل.
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                        disabled={loading}
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={loading || !selectedUserId}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Wallet className="h-4 w-4" />
                        )}
                        إنشاء العهدة
                    </button>
                </div>
            </div>
        </div>
    )
}

export default CustodyCreateModal
