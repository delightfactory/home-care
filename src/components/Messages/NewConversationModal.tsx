// NewConversationModal Component
// نافذة إنشاء محادثة جديدة

import React, { useState, useEffect } from 'react';
import {
    X,
    Search,
    Users,
    User,
    Megaphone,
    Check,
    Loader2,
    ArrowRight,
    Plus
} from 'lucide-react';
import { MessagesAPI } from '../../api/messages';

interface NewConversationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConversationCreated: (conversationId: string) => void;
    userRole?: string;
}

type Step = 'select-type' | 'select-user' | 'select-team' | 'create-group' | 'create-broadcast';

interface UserItem {
    id: string;
    full_name: string;
    role_name: string | null;
}

interface TeamItem {
    id: string;
    name: string;
}

const NewConversationModal: React.FC<NewConversationModalProps> = ({
    isOpen,
    onClose,
    onConversationCreated,
    userRole
}) => {
    const [step, setStep] = useState<Step>('select-type');
    const [users, setUsers] = useState<UserItem[]>([]);
    const [teams, setTeams] = useState<TeamItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [groupName, setGroupName] = useState('');
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastRole, setBroadcastRole] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const isManager = userRole === 'manager' || userRole === 'admin' || userRole === 'operations_supervisor';

    // جلب المستخدمين والفرق
    useEffect(() => {
        if (isOpen) {
            MessagesAPI.getAvailableUsers().then(setUsers);
            MessagesAPI.getAvailableTeams().then(setTeams);
        }
    }, [isOpen]);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setStep('select-type');
            setSearchQuery('');
            setSelectedUsers([]);
            setGroupName('');
            setBroadcastTitle('');
            setBroadcastMessage('');
            setBroadcastRole('');
        }
    }, [isOpen]);

    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // إنشاء محادثة مباشرة
    const handleSelectUser = async (userId: string) => {
        setIsLoading(true);
        try {
            const conversationId = await MessagesAPI.getOrCreateDirectConversation(userId);
            onConversationCreated(conversationId);
            onClose();
        } catch (error) {
            console.error('Error creating conversation:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // إنشاء محادثة فريق
    const handleSelectTeam = async (teamId: string) => {
        setIsLoading(true);
        try {
            const conversationId = await MessagesAPI.createTeamConversation(teamId);
            onConversationCreated(conversationId);
            onClose();
        } catch (error) {
            console.error('Error creating team conversation:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // إنشاء مجموعة
    const handleCreateGroup = async () => {
        if (!groupName.trim() || selectedUsers.length === 0) return;

        setIsLoading(true);
        try {
            const result = await MessagesAPI.createGroup(groupName, selectedUsers);
            if (result.success && result.data) {
                onConversationCreated(result.data);
                onClose();
            }
        } catch (error) {
            console.error('Error creating group:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // إرسال إعلان
    const handleCreateBroadcast = async () => {
        if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

        setIsLoading(true);
        try {
            const result = await MessagesAPI.createBroadcast(
                broadcastTitle,
                broadcastMessage,
                broadcastRole || undefined,
                !broadcastRole
            );
            if (result.success && result.data) {
                onConversationCreated(result.data);
                onClose();
            }
        } catch (error) {
            console.error('Error creating broadcast:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleUserSelection = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        {step !== 'select-type' && (
                            <button
                                onClick={() => setStep('select-type')}
                                className="p-2 -mr-2 rounded-full hover:bg-gray-100 text-gray-600"
                            >
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        )}
                        <h2 className="text-lg font-semibold text-gray-900">
                            {step === 'select-type' && 'محادثة جديدة'}
                            {step === 'select-user' && 'اختر مستخدم'}
                            {step === 'select-team' && 'اختر فريق'}
                            {step === 'create-group' && 'إنشاء مجموعة'}
                            {step === 'create-broadcast' && 'إرسال إعلان'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Step: Select Type */}
                    {step === 'select-type' && (
                        <div className="p-4 space-y-2">
                            <button
                                onClick={() => setStep('select-user')}
                                className="w-full p-4 rounded-xl hover:bg-gray-50 flex items-center gap-4 text-right transition-colors"
                            >
                                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                    <User className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">محادثة مباشرة</p>
                                    <p className="text-sm text-gray-500">راسل شخص واحد</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setStep('select-team')}
                                className="w-full p-4 rounded-xl hover:bg-gray-50 flex items-center gap-4 text-right transition-colors"
                            >
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                    <Users className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">محادثة فريق</p>
                                    <p className="text-sm text-gray-500">تواصل مع فريق كامل</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setStep('create-group')}
                                className="w-full p-4 rounded-xl hover:bg-gray-50 flex items-center gap-4 text-right transition-colors"
                            >
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                                    <Plus className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">مجموعة جديدة</p>
                                    <p className="text-sm text-gray-500">أنشئ مجموعة مخصصة</p>
                                </div>
                            </button>

                            {isManager && (
                                <button
                                    onClick={() => setStep('create-broadcast')}
                                    className="w-full p-4 rounded-xl hover:bg-gray-50 flex items-center gap-4 text-right transition-colors"
                                >
                                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                                        <Megaphone className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">إعلان</p>
                                        <p className="text-sm text-gray-500">أرسل إعلان للفريق أو الجميع</p>
                                    </div>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Step: Select User */}
                    {step === 'select-user' && (
                        <div>
                            <div className="p-4">
                                <div className="relative">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="بحث..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pr-10 pl-4 py-2.5 bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            </div>

                            <div className="divide-y divide-gray-50">
                                {filteredUsers.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleSelectUser(user.id)}
                                        disabled={isLoading}
                                        className="w-full p-4 hover:bg-gray-50 flex items-center gap-3 text-right transition-colors disabled:opacity-50"
                                    >
                                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">{user.full_name}</p>
                                            <p className="text-xs text-gray-500">{user.role_name || 'مستخدم'}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step: Select Team */}
                    {step === 'select-team' && (
                        <div className="divide-y divide-gray-50">
                            {teams.map(team => (
                                <button
                                    key={team.id}
                                    onClick={() => handleSelectTeam(team.id)}
                                    disabled={isLoading}
                                    className="w-full p-4 hover:bg-gray-50 flex items-center gap-3 text-right transition-colors disabled:opacity-50"
                                >
                                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <p className="font-medium text-gray-900">{team.name}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step: Create Group */}
                    {step === 'create-group' && (
                        <div className="p-4 space-y-4">
                            <input
                                type="text"
                                placeholder="اسم المجموعة"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-indigo-500/20"
                            />

                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="بحث عن أعضاء..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pr-10 pl-4 py-2.5 bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            {selectedUsers.length > 0 && (
                                <p className="text-sm text-gray-500">
                                    تم اختيار {selectedUsers.length} عضو
                                </p>
                            )}

                            <div className="max-h-48 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
                                {filteredUsers.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => toggleUserSelection(user.id)}
                                        className={`
                                            w-full p-3 flex items-center gap-3 text-right transition-colors
                                            ${selectedUsers.includes(user.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                                        `}
                                    >
                                        <div className={`
                                            w-5 h-5 rounded-full border-2 flex items-center justify-center
                                            ${selectedUsers.includes(user.id)
                                                ? 'bg-indigo-600 border-indigo-600'
                                                : 'border-gray-300'
                                            }
                                        `}>
                                            {selectedUsers.includes(user.id) && (
                                                <Check className="w-3 h-3 text-white" />
                                            )}
                                        </div>
                                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step: Create Broadcast */}
                    {step === 'create-broadcast' && (
                        <div className="p-4 space-y-4">
                            <input
                                type="text"
                                placeholder="عنوان الإعلان"
                                value={broadcastTitle}
                                onChange={(e) => setBroadcastTitle(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-indigo-500/20"
                            />

                            <textarea
                                placeholder="نص الإعلان..."
                                value={broadcastMessage}
                                onChange={(e) => setBroadcastMessage(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-3 bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                            />

                            <div>
                                <label className="text-sm text-gray-600 mb-2 block">الفئة المستهدفة</label>
                                <select
                                    value={broadcastRole}
                                    onChange={(e) => setBroadcastRole(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="">الجميع</option>
                                    <option value="technician">الفنيين</option>
                                    <option value="team_leader">قادة الفرق</option>
                                    <option value="operations_supervisor">المشرفين</option>
                                    <option value="receptionist">موظفي الاستقبال</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer with action button */}
                {(step === 'create-group' || step === 'create-broadcast') && (
                    <div className="p-4 border-t border-gray-100">
                        <button
                            onClick={step === 'create-group' ? handleCreateGroup : handleCreateBroadcast}
                            disabled={
                                isLoading ||
                                (step === 'create-group' && (!groupName.trim() || selectedUsers.length === 0)) ||
                                (step === 'create-broadcast' && (!broadcastTitle.trim() || !broadcastMessage.trim()))
                            }
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {step === 'create-group' ? 'إنشاء المجموعة' : 'إرسال الإعلان'}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewConversationModal;
