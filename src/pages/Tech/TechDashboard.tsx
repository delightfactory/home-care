// TechDashboard — الصفحة الرئيسية لتطبيق الفنى
// شاشة إجبار الحضور → الطلب الحالى → شاشة الراحة
import React from 'react'
import {
    Loader2, MapPin, AlertTriangle, Users, LogIn,
    Sun, Moon, Coffee, Trophy, Clock
} from 'lucide-react'
import TechLayout from '../../components/Layout/TechLayout'
import TechOrderCard from '../../components/Tech/TechOrderCard'
import TechProgressBar from '../../components/Tech/TechProgressBar'
import TechTeamInfo from '../../components/Tech/TechTeamInfo'
import { useTechnicianData } from '../../hooks/useTechnicianData'
import { useNavigate } from 'react-router-dom'
import { formatNumber } from '../../utils/formatters'

const TechDashboard: React.FC = () => {
    const {
        route,
        currentOrder,
        progress,
        status,
        attendance,
        loading,
        orderLoading,
        error,
        allOrdersDone,
        startOrder,
        completeOrder,
        moveToNextOrder,
        skipCollection,
        refresh,
    } = useTechnicianData()
    const navigate = useNavigate()

    // Loading
    if (loading) {
        return (
            <TechLayout isLeader={status.isLeader} routeName={route?.name}>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                    <p className="text-gray-400 text-sm">بنحمّل بياناتك...</p>
                </div>
            </TechLayout>
        )
    }

    // Error
    if (error) {
        return (
            <TechLayout isLeader={status.isLeader} routeName={route?.name}>
                <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center gap-4">
                    <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">حصل مشكلة 😕</h2>
                    <p className="text-gray-500 text-sm">{error}</p>
                    <button
                        onClick={refresh}
                        className="px-6 py-3 bg-blue-500 text-white rounded-2xl font-bold active:scale-95 transition-all shadow-lg"
                    >
                        جرّب تانى
                    </button>
                </div>
            </TechLayout>
        )
    }

    // Not in a team
    if (!status.isTeamMember) {
        return (
            <TechLayout isLeader={false} routeName={undefined}>
                <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center gap-4">
                    <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center">
                        <Users className="w-8 h-8 text-amber-500" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">لسه مش متعيّن فى فريق</h2>
                    <p className="text-gray-500 text-sm">كلّم المشرف عشان يضيفك لفريق</p>
                </div>
            </TechLayout>
        )
    }

    // No route today
    if (!route) {
        return (
            <TechLayout isLeader={status.isLeader} routeName={undefined}>
                <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center gap-4">
                    <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center">
                        <MapPin className="w-8 h-8 text-blue-500" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">مفيش شغل النهاردة 😎</h2>
                    <p className="text-gray-500 text-sm">مفيش خط سير مخصص ليك — ريّح نفسك</p>

                    {/* عرض معلومات الفريق حتى فى يوم الراحة */}
                    <div className="w-full max-w-sm">
                        <TechTeamInfo
                            isLeader={status.isLeader}
                            leaderName={status.leaderName}
                            teamMembers={status.teamMembers}
                            teamName={status.teamName}
                        />
                    </div>
                </div>
            </TechLayout>
        )
    }

    // ─── شاشة إجبار الحضور ────────────────────
    if (!attendance.loading && !attendance.checkedIn) {
        const hour = new Date().getHours()
        const greeting = hour < 12 ? 'صباح الفل' : hour < 17 ? 'مساء النور' : 'مساء الخير'
        const GreetingIcon = hour < 12 ? Sun : hour < 17 ? Coffee : Moon

        return (
            <TechLayout isLeader={status.isLeader} routeName={route.name}>
                <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center gap-5">
                    <div
                        className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-[2rem] flex items-center justify-center shadow-lg shadow-amber-500/30"
                        style={{ animation: 'bounceIn 0.5s ease-out' }}
                    >
                        <GreetingIcon className="w-12 h-12 text-white" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">{greeting} يا معلّم! 👋</h2>
                        <p className="text-gray-500 text-sm mt-2">
                            سجّل حضورك الأول عشان تشوف طلبات النهاردة
                        </p>
                    </div>

                    {/* Route Info — visible even before check-in */}
                    <div className="w-full max-w-sm bg-blue-50 rounded-2xl p-4 border border-blue-100">
                        <div className="flex items-center gap-2 text-blue-700">
                            <MapPin className="w-4 h-4" />
                            <span className="text-sm font-medium">{route.name}</span>
                        </div>
                        {progress.total > 0 && (
                            <p className="text-xs text-blue-500 mt-1 mr-6">
                                {formatNumber(progress.total)} طلب فى انتظارك
                            </p>
                        )}
                    </div>

                    <button
                        onClick={() => navigate('/tech/attendance')}
                        className="w-full max-w-sm py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl text-lg font-bold shadow-lg shadow-green-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <LogIn className="w-6 h-6" />
                        سجّل الحضور ☀️
                    </button>
                </div>

                <style>{`
                    @keyframes bounceIn {
                        0% { transform: scale(0); opacity: 0; }
                        50% { transform: scale(1.15); }
                        100% { transform: scale(1); opacity: 1; }
                    }
                `}</style>
            </TechLayout>
        )
    }

    // ─── شاشة إنهاء اليوم (راحة) ────────────────
    if (allOrdersDone && !currentOrder) {
        return (
            <TechLayout isLeader={status.isLeader} routeName={route.name}>
                <div className="p-4 space-y-4">
                    {/* Progress */}
                    <TechProgressBar progress={progress} />

                    {/* Team Info */}
                    <TechTeamInfo
                        isLeader={status.isLeader}
                        leaderName={status.leaderName}
                        teamMembers={status.teamMembers}
                        teamName={status.teamName}
                    />

                    {/* Celebration Card */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl border border-green-100 p-6 text-center space-y-4">
                        <div
                            className="w-20 h-20 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-green-500/30"
                            style={{ animation: 'bounceIn 0.5s ease-out' }}
                        >
                            <Trophy className="w-10 h-10 text-white" />
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-gray-800">الله ينوّر يا بطل! 🏆</h2>
                            <p className="text-gray-500 text-sm mt-2">
                                خلّصت كل شغل النهاردة — ريّح نفسك وخد
                                <br />
                                راحة كويسة عشان بكره يوم جديد 💤
                            </p>
                        </div>

                        {/* Today Stats */}
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div className="bg-white/80 rounded-2xl p-3 border border-green-100">
                                <p className="text-2xl font-bold text-green-600">{formatNumber(progress.completed)}</p>
                                <p className="text-xs text-gray-500">طلب مكتمل</p>
                            </div>
                            <div className="bg-white/80 rounded-2xl p-3 border border-green-100">
                                <p className="text-2xl font-bold text-green-600">100%</p>
                                <p className="text-xs text-gray-500">نسبة الإتمام</p>
                            </div>
                        </div>

                        {/* Checkout note */}
                        {attendance.checkedIn && !attendance.checkedOut && (
                            <button
                                onClick={() => navigate('/tech/attendance')}
                                className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-2xl text-sm font-medium hover:border-red-300 hover:text-red-500 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                <Clock className="w-4 h-4" />
                                سجّل انصرافك يدوى لو محتاج
                            </button>
                        )}
                    </div>
                </div>

                <style>{`
                    @keyframes bounceIn {
                        0% { transform: scale(0); opacity: 0; }
                        50% { transform: scale(1.15); }
                        100% { transform: scale(1); opacity: 1; }
                    }
                `}</style>
            </TechLayout>
        )
    }

    // ─── الوضع العادى: عرض الطلب الحالى ────────────
    return (
        <TechLayout isLeader={status.isLeader} routeName={route.name}>
            <div className="p-4 space-y-4">
                {/* Progress */}
                <TechProgressBar progress={progress} />

                {/* Team Info */}
                <TechTeamInfo
                    isLeader={status.isLeader}
                    leaderName={status.leaderName}
                    teamMembers={status.teamMembers}
                    teamName={status.teamName}
                />

                {/* Current Order */}
                {currentOrder ? (
                    <TechOrderCard
                        order={currentOrder}
                        onStart={startOrder}
                        onComplete={completeOrder}
                        onMoveToNext={moveToNextOrder}
                        onSkipCollection={skipCollection}
                        onCollectionDone={refresh}
                        loading={orderLoading}
                        isLeader={status.isLeader}
                    />
                ) : orderLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-blue-100 rounded-full" />
                            <div className="absolute inset-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <p className="text-sm text-gray-400">بنجهّز الطلب التالى...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center">
                            <MapPin className="w-8 h-8 text-gray-300" />
                        </div>
                        <p className="text-gray-400 text-sm">مفيش طلبات حالياً</p>
                        <button
                            onClick={refresh}
                            className="text-blue-500 text-sm font-medium active:scale-95"
                        >
                            تحديث
                        </button>
                    </div>
                )}
            </div>
        </TechLayout>
    )
}

export default TechDashboard
