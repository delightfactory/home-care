// TechGuard - حارس صفحات الفنى
// يتحقق من أن المستخدم team_leader ومسجل الدخول
import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import LoadingSpinner from '../UI/LoadingSpinner'

interface TechGuardProps {
    children: React.ReactNode
    fallback?: React.ReactNode
}

export const TechGuard: React.FC<TechGuardProps> = ({
    children,
    fallback
}) => {
    const { user, session, loading: authLoading } = useAuth()
    const { hasRole, loading: permLoading } = usePermissions()

    // انتظار التحقق من المصادقة والصلاحيات
    if (authLoading || permLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <LoadingSpinner size="large" />
            </div>
        )
    }

    // إذا لم يكن مسجل الدخول، وجهه لصفحة الدخول
    if (!session || !user) {
        return <Navigate to="/login" replace />
    }

    // إذا لم يكن فني أو قائد فريق، وجهه للصفحة الرئيسية أو fallback
    if (!hasRole('team_leader') && !hasRole('technician')) {
        return fallback ? <>{fallback}</> : <Navigate to="/dashboard" replace />
    }

    return <>{children}</>
}

export default TechGuard
