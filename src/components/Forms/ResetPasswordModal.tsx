import React, { useState } from 'react'
import { Key, Eye, EyeOff, RefreshCw, Copy, CheckCircle, AlertTriangle } from 'lucide-react'
import { UsersAPI } from '../../lib/api/users'
import SmartModal from '../UI/SmartModal'
import toast from 'react-hot-toast'

interface ResetPasswordModalProps {
    userId: string
    userName: string
    onClose: () => void
    onSuccess: () => void
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
    userId,
    userName,
    onClose,
    onSuccess
}) => {
    const [loading, setLoading] = useState(false)
    const [newPassword, setNewPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [copied, setCopied] = useState(false)
    const [success, setSuccess] = useState(false)

    // Generate secure random password
    const generatePassword = () => {
        const length = 12
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
        let password = ''
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length))
        }
        setNewPassword(password)
        setShowPassword(true)
        setCopied(false)
    }

    // Copy password to clipboard
    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(newPassword)
            setCopied(true)
            toast.success('تم نسخ كلمة المرور')
            setTimeout(() => setCopied(false), 3000)
        } catch {
            toast.error('فشل نسخ كلمة المرور')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!newPassword || newPassword.length < 6) {
            toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
            return
        }

        setLoading(true)
        try {
            const response = await UsersAPI.resetUserPassword(userId, newPassword)

            if (response.success) {
                setSuccess(true)
                toast.success('تم تغيير كلمة المرور بنجاح')
                // Don't close immediately, let user copy the password first
            } else {
                toast.error(response.error || 'حدث خطأ أثناء تغيير كلمة المرور')
            }
        } catch (error) {
            toast.error('حدث خطأ غير متوقع')
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        if (success) {
            onSuccess()
        }
        onClose()
    }

    return (
        <SmartModal
            isOpen={true}
            onClose={handleClose}
            title="إعادة تعيين كلمة المرور"
            subtitle={`تغيير كلمة مرور المستخدم: ${userName}`}
            icon={<Key className="h-6 w-6 text-white" />}
            size="md"
            headerGradient="from-amber-500 to-orange-600"
        >
            <form onSubmit={handleSubmit} className="p-6">
                {/* Warning Notice */}
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-amber-800">تنبيه مهم</p>
                            <p className="text-sm text-amber-700 mt-1">
                                سيتم تغيير كلمة المرور فوراً. تأكد من إعلام المستخدم بكلمة المرور الجديدة.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Password Input */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            كلمة المرور الجديدة *
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => {
                                    setNewPassword(e.target.value)
                                    setCopied(false)
                                }}
                                className="input pr-10 pl-24 text-lg font-mono"
                                placeholder="أدخل كلمة المرور الجديدة"
                                disabled={loading || success}
                                minLength={6}
                                required
                            />
                            <Key className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    title={showPassword ? 'إخفاء' : 'إظهار'}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                                {newPassword && (
                                    <button
                                        type="button"
                                        onClick={copyToClipboard}
                                        className={`p-1.5 rounded-lg transition-colors ${copied
                                                ? 'text-green-600 bg-green-100'
                                                : 'text-blue-500 hover:text-blue-700 hover:bg-blue-100'
                                            }`}
                                        title="نسخ"
                                    >
                                        {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Generate Password Button */}
                    <button
                        type="button"
                        onClick={generatePassword}
                        disabled={loading || success}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all duration-200 font-medium border border-gray-300 disabled:opacity-50"
                    >
                        <RefreshCw className="h-4 w-4" />
                        توليد كلمة مرور آمنة
                    </button>

                    {/* Password Strength Indicator */}
                    {newPassword && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">قوة كلمة المرور</span>
                                <span className={`font-medium ${newPassword.length >= 12 ? 'text-green-600' :
                                        newPassword.length >= 8 ? 'text-yellow-600' :
                                            'text-red-600'
                                    }`}>
                                    {newPassword.length >= 12 ? 'قوية' :
                                        newPassword.length >= 8 ? 'متوسطة' :
                                            'ضعيفة'}
                                </span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${newPassword.length >= 12 ? 'bg-green-500 w-full' :
                                            newPassword.length >= 8 ? 'bg-yellow-500 w-2/3' :
                                                newPassword.length >= 6 ? 'bg-red-500 w-1/3' :
                                                    'w-0'
                                        }`}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Success State */}
                {success && (
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <div>
                                <p className="text-sm font-medium text-green-800">تم تغيير كلمة المرور بنجاح!</p>
                                <p className="text-sm text-green-700 mt-1">
                                    تأكد من نسخ كلمة المرور قبل إغلاق النافذة
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
                    >
                        {success ? 'إغلاق' : 'إلغاء'}
                    </button>
                    {!success && (
                        <button
                            type="submit"
                            disabled={loading || !newPassword || newPassword.length < 6}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    جاري التغيير...
                                </>
                            ) : (
                                <>
                                    <Key className="h-4 w-4" />
                                    تغيير كلمة المرور
                                </>
                            )}
                        </button>
                    )}
                </div>
            </form>
        </SmartModal>
    )
}

export default ResetPasswordModal
