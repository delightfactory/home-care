// TechDashboard - الصفحة الرئيسية لتطبيق الفنى
import React from 'react'
import { ClipboardList, AlertCircle, RefreshCw, Users, UserX, Crown } from 'lucide-react'
import TechLayout from '../../components/Layout/TechLayout'
import TechProgressBar from '../../components/Tech/TechProgressBar'
import TechOrderCard from '../../components/Tech/TechOrderCard'
import { useTechnicianData } from '../../hooks/useTechnicianData'
import LoadingSpinner from '../../components/UI/LoadingSpinner'

const TechDashboard: React.FC = () => {
    const {
        route,
        currentOrder,
        progress,
        status,
        loading,
        orderLoading,
        error,
        startOrder,
        completeOrder,
        refresh
    } = useTechnicianData()

    // شاشة التحميل
    if (loading) {
        return (
            <TechLayout isLeader={status.isLeader} routeName={route?.name}>
                <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <LoadingSpinner size="large" />
                        <p className="mt-4 text-gray-500">جارى تحميل البيانات...</p>
                    </div>
                </div>
            </TechLayout>
        )
    }

    // شاشة الخطأ
    if (error) {
        return (
            <TechLayout onRefresh={refresh} isLeader={status.isLeader} routeName={route?.name}>
                <div className="flex-1 flex items-center justify-center min-h-[60vh] p-4">
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">حدث خطأ</h2>
                        <p className="text-gray-500 mb-4">{error}</p>
                        <button
                            onClick={refresh}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            إعادة المحاولة
                        </button>
                    </div>
                </div>
            </TechLayout>
        )
    }

    // ❌ ليس عضواً في فريق
    if (!status.isTeamMember) {
        return (
            <TechLayout onRefresh={refresh} isLeader={status.isLeader} routeName={route?.name}>
                <div className="flex-1 flex items-center justify-center min-h-[60vh] p-4">
                    <div className="text-center max-w-sm">
                        <div className="w-20 h-20 mx-auto bg-amber-50 rounded-full flex items-center justify-center mb-4 border-2 border-amber-200">
                            <UserX className="w-10 h-10 text-amber-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 mb-3">
                            👋 مرحباً بك!
                        </h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            لم يتم تعيينك ضمن فريق عمل حالياً.
                            <br />
                            يُرجى التواصل مع المشرف لإضافتك إلى فريق.
                        </p>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                            <Users className="w-5 h-5 inline-block ml-2" />
                            عند إضافتك لفريق، ستتمكن من رؤية طلبات العمل اليومية
                        </div>
                        <button
                            onClick={refresh}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            تحديث
                        </button>
                    </div>
                </div>
            </TechLayout>
        )
    }

    // ⚠️ فريق بلا قائد
    if (!status.hasLeader) {
        return (
            <TechLayout onRefresh={refresh} isLeader={status.isLeader} routeName={route?.name}>
                <div className="flex-1 flex items-center justify-center min-h-[60vh] p-4">
                    <div className="text-center max-w-sm">
                        <div className="w-20 h-20 mx-auto bg-orange-50 rounded-full flex items-center justify-center mb-4 border-2 border-orange-200">
                            <Crown className="w-10 h-10 text-orange-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 mb-3">
                            فريقك بحاجة إلى قائد
                        </h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            فريق <span className="font-semibold text-blue-600">{status.teamName}</span> بحاجة إلى تعيين قائد لاستكمال العمل.
                            <br />
                            يُرجى التواصل مع الإدارة.
                        </p>
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-700">
                            ⚠️ القائد مسؤول عن تحديث حالة الطلبات وإدارة سير العمل
                        </div>
                        <button
                            onClick={refresh}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            تحديث
                        </button>
                    </div>
                </div>
            </TechLayout>
        )
    }

    // لا يوجد خط سير لهذا اليوم
    if (progress.total === 0) {
        return (
            <TechLayout onRefresh={refresh} isLeader={status.isLeader} routeName={route?.name}>
                <div className="flex-1 flex items-center justify-center min-h-[60vh] p-4">
                    <div className="text-center">
                        <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <ClipboardList className="w-10 h-10 text-gray-400" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">لا توجد طلبات</h2>
                        <p className="text-gray-500 mb-4">
                            لا يوجد خط سير مخصص لك اليوم
                        </p>
                        <button
                            onClick={refresh}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            تحديث
                        </button>
                    </div>
                </div>
            </TechLayout>
        )
    }

    // أنهى جميع الطلبات
    if (!currentOrder && progress.completed === progress.total) {
        return (
            <TechLayout onRefresh={refresh} isLeader={status.isLeader} routeName={route?.name}>
                <div className="p-4 space-y-4">
                    {/* Progress Bar */}
                    <TechProgressBar progress={progress} />

                    {/* Completion Message */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 text-center border border-green-200">
                        <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <span className="text-4xl">🎉</span>
                        </div>
                        <h2 className="text-2xl font-bold text-green-700 mb-2">
                            أحسنت!
                        </h2>
                        <p className="text-green-600 text-lg">
                            أنهيت جميع طلبات اليوم بنجاح
                        </p>
                        <p className="text-green-500 mt-2">
                            عدد الطلبات المكتملة: {progress.completed}
                        </p>
                    </div>
                </div>
            </TechLayout>
        )
    }

    // الشاشة الرئيسية مع الطلب الحالى
    // شاشة الانتقال بعد إكمال الطلب
    if (!currentOrder && orderLoading) {
        return (
            <TechLayout isLeader={status.isLeader} routeName={route?.name}>
                <div className="p-4 space-y-4">
                    {/* Progress Bar */}
                    <TechProgressBar progress={progress} />

                    {/* Success Transition Screen */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 text-center border border-green-200 animate-pulse">
                        <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <span className="text-4xl">✅</span>
                        </div>
                        <h2 className="text-xl font-bold text-green-700 mb-2">
                            تم إكمال الطلب بنجاح!
                        </h2>
                        <p className="text-green-600">
                            جارى تحميل الطلب التالى...
                        </p>
                        <div className="mt-4">
                            <LoadingSpinner size="small" />
                        </div>
                    </div>
                </div>
            </TechLayout>
        )
    }

    return (
        <TechLayout onRefresh={refresh} isLeader={status.isLeader} routeName={route?.name}>
            <div className="p-4 space-y-4">
                {/* Progress Bar */}
                <TechProgressBar progress={progress} />

                {/* Current Order */}
                {currentOrder && (
                    <TechOrderCard
                        order={currentOrder}
                        onStart={startOrder}
                        onComplete={completeOrder}
                        loading={orderLoading}
                        isLeader={status.isLeader}
                    />
                )}
            </div>
        </TechLayout>
    )
}

export default TechDashboard
