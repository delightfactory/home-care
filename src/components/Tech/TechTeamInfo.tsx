// TechTeamInfo - عرض معلومات الفريق للفني (قابل للطى حتى لا يعيق سير العمل)
import React, { useState } from 'react'
import { Users, Crown, ChevronDown } from 'lucide-react'
import { TeamMember } from '../../api/technician'

interface TechTeamInfoProps {
    isLeader: boolean
    leaderName: string | null
    teamMembers: TeamMember[]
    teamName: string | null
}

// ألوان الأفاتارات حسب ترتيب الأعضاء
const AVATAR_COLORS = [
    'from-blue-400 to-blue-600',
    'from-emerald-400 to-emerald-600',
    'from-violet-400 to-violet-600',
    'from-rose-400 to-rose-600',
    'from-amber-400 to-amber-600',
    'from-cyan-400 to-cyan-600',
    'from-fuchsia-400 to-fuchsia-600',
    'from-teal-400 to-teal-600',
]

const getInitial = (name: string) => {
    return name?.trim()?.charAt(0)?.toUpperCase() || '؟'
}

export const TechTeamInfo: React.FC<TechTeamInfoProps> = ({
    isLeader,
    leaderName,
    teamMembers,
    teamName
}) => {
    const [expanded, setExpanded] = useState(false)

    // لا نعرض شيء إذا لم يكن هناك فريق
    if (!teamName) return null

    // عدد الأعضاء (بدون القائد)
    const memberCount = teamMembers.filter(m => !m.isLeader).length

    // ترتيب الأعضاء: القائد أولاً
    const sortedMembers = [...teamMembers].sort((a, b) => {
        if (a.isLeader && !b.isLeader) return -1
        if (!a.isLeader && b.isLeader) return 1
        return 0
    })

    return (
        <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100/80 bg-white">
            {/* ── Header (دائماً مرئى - قابل للنقر) ── */}
            <button
                onClick={() => setExpanded(prev => !prev)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-l from-indigo-500 via-indigo-600 to-purple-600 active:from-indigo-600 active:to-purple-700 transition-colors"
            >
                {/* أيقونة الفريق */}
                <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0">
                    <Users className="w-[18px] h-[18px] text-white" />
                </div>

                {/* اسم الفريق + معلومات مختصرة */}
                <div className="flex-1 text-right min-w-0">
                    <p className="text-white font-bold text-sm truncate">{teamName}</p>
                    <p className="text-white/70 text-[11px] mt-0.5">
                        {isLeader
                            ? `أنت قائد الفريق • ${memberCount} فنى`
                            : `القائد: ${leaderName || 'غير محدد'} • ${memberCount + 1} أعضاء`
                        }
                    </p>
                </div>

                {/* سهم التوسيع */}
                <ChevronDown
                    className={`w-5 h-5 text-white/80 shrink-0 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
                />
            </button>

            {/* ── Content (قابل للطى) ── */}
            <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                    maxHeight: expanded ? '400px' : '0px',
                    opacity: expanded ? 1 : 0,
                }}
            >
                <div className="p-3">
                    {isLeader ? (
                        /* ═══ عرض القائد: قائمة الأعضاء ═══ */
                        <div className="space-y-1.5">
                            {sortedMembers.map((member, idx) => (
                                <div
                                    key={member.id}
                                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${member.isLeader
                                        ? 'bg-gradient-to-l from-amber-50 to-orange-50 border border-amber-200/60'
                                        : 'bg-gray-50/80 hover:bg-gray-100/80'
                                        }`}
                                >
                                    {/* أفاتار */}
                                    {member.isLeader ? (
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-sm shadow-amber-300/40">
                                            <Crown className="w-4 h-4 text-white" />
                                        </div>
                                    ) : (
                                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} flex items-center justify-center shrink-0 shadow-sm`}>
                                            <span className="text-white text-xs font-bold">{getInitial(member.name)}</span>
                                        </div>
                                    )}

                                    {/* الاسم */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${member.isLeader ? 'text-amber-800' : 'text-gray-700'}`}>
                                            {member.name}
                                        </p>
                                        {member.isLeader && (
                                            <p className="text-[10px] text-amber-600 font-medium">قائد الفريق ⭐</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* ═══ عرض العضو: كارت القائد ═══ */
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-l from-amber-50 to-orange-50 border border-amber-200/60">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-md shadow-amber-300/30">
                                <Crown className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-amber-600 font-medium">قائد فريقك</p>
                                <p className="font-bold text-gray-800 text-base truncate">{leaderName || 'غير محدد'}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default TechTeamInfo
