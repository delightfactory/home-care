// TechTeamInfo - عرض معلومات الفريق للفني
import React from 'react'
import { Users, Crown, User } from 'lucide-react'
import { TeamMember } from '../../api/technician'

interface TechTeamInfoProps {
    isLeader: boolean
    leaderName: string | null
    teamMembers: TeamMember[]
    teamName: string | null
}

export const TechTeamInfo: React.FC<TechTeamInfoProps> = ({
    isLeader,
    leaderName,
    teamMembers,
    teamName
}) => {
    // لا نعرض شيء إذا لم يكن هناك فريق
    if (!teamName) return null

    // ترتيب الأعضاء: القائد أولاً
    const sortedMembers = [...teamMembers].sort((a, b) => {
        if (a.isLeader && !b.isLeader) return -1
        if (!a.isLeader && b.isLeader) return 1
        return 0
    })

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <span className="text-white font-bold">{teamName}</span>
                        <p className="text-xs text-white/80">
                            {isLeader ? 'أنت قائد الفريق' : `القائد: ${leaderName || 'غير محدد'}`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {isLeader ? (
                    // للقائد: عرض أعضاء الفريق
                    <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            أعضاء الفريق ({teamMembers.length})
                        </h4>
                        <div className="space-y-2">
                            {sortedMembers.map((member) => (
                                <div
                                    key={member.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl ${member.isLeader
                                            ? 'bg-amber-50 border border-amber-200'
                                            : 'bg-gray-50'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${member.isLeader
                                            ? 'bg-amber-100'
                                            : 'bg-gray-200'
                                        }`}>
                                        {member.isLeader ? (
                                            <Crown className="w-5 h-5 text-amber-600" />
                                        ) : (
                                            <User className="w-5 h-5 text-gray-500" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800">{member.name}</p>
                                        {member.isLeader && (
                                            <p className="text-xs text-amber-600">قائد الفريق</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    // للعضو: عرض معلومات القائد
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                            <Crown className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">قائد فريقك</p>
                            <p className="font-bold text-gray-800 text-lg">{leaderName || 'غير محدد'}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default TechTeamInfo
