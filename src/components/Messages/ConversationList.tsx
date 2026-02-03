// ConversationList Component
// قائمة المحادثات بتصميم WhatsApp

import React, { useState } from 'react';
import {
    Search,
    Users,
    MessageSquarePlus,
    Pin,
    BellOff,
    User,
    Users2,
    Megaphone
} from 'lucide-react';
import { ConversationWithDetails } from '../../api/messages';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ConversationListProps {
    conversations: ConversationWithDetails[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onNewChat: () => void;
    isLoading?: boolean;
    hideHeader?: boolean;
}

const ConversationList: React.FC<ConversationListProps> = ({
    conversations,
    selectedId,
    onSelect,
    onNewChat,
    isLoading,
    hideHeader = false
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredConversations = conversations.filter(c =>
        (c.display_name || c.title || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
    );

    const getConversationIcon = (type: string) => {
        switch (type) {
            case 'direct': return <User className="w-5 h-5" />;
            case 'team': return <Users className="w-5 h-5" />;
            case 'group': return <Users2 className="w-5 h-5" />;
            case 'broadcast': return <Megaphone className="w-5 h-5" />;
            default: return <MessageSquarePlus className="w-5 h-5" />;
        }
    };

    const formatTime = (date: string | null) => {
        if (!date) return '';
        try {
            return formatDistanceToNow(new Date(date), {
                addSuffix: false,
                locale: ar
            });
        } catch {
            return '';
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header - conditionally hidden when parent provides its own */}
            {!hideHeader && (
                <div className="flex-shrink-0 p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900">الرسائل</h2>
                        <button
                            onClick={onNewChat}
                            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 hover:text-indigo-600 transition-colors"
                            title="محادثة جديدة"
                        >
                            <MessageSquarePlus className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="بحث في المحادثات..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pr-10 pl-4 py-2.5 bg-gray-100 rounded-xl border-0 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                        />
                    </div>
                </div>
            )}

            {/* Search when header is hidden */}
            {hideHeader && (
                <div className="flex-shrink-0 p-4 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="بحث في المحادثات..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pr-10 pl-4 py-2.5 bg-gray-100 rounded-xl border-0 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                        />
                    </div>
                </div>
            )}

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    // Loading skeleton
                    <div className="p-4 space-y-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="flex items-center gap-3 animate-pulse">
                                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                        <MessageSquarePlus className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-center">
                            {searchQuery ? 'لا توجد نتائج' : 'لا توجد محادثات بعد'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={onNewChat}
                                className="mt-4 px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                                ابدأ محادثة جديدة
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {filteredConversations.map(conversation => (
                            <button
                                key={conversation.id}
                                onClick={() => onSelect(conversation.id)}
                                className={`
                                    w-full p-4 flex items-start gap-3 text-right transition-all
                                    hover:bg-gray-50
                                    ${selectedId === conversation.id
                                        ? 'bg-indigo-50 border-r-4 border-indigo-600'
                                        : 'border-r-4 border-transparent'
                                    }
                                `}
                            >
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    <div className={`
                                        w-12 h-12 rounded-full flex items-center justify-center
                                        ${conversation.type === 'broadcast'
                                            ? 'bg-amber-100 text-amber-600'
                                            : conversation.type === 'team'
                                                ? 'bg-green-100 text-green-600'
                                                : conversation.type === 'group'
                                                    ? 'bg-purple-100 text-purple-600'
                                                    : 'bg-indigo-100 text-indigo-600'
                                        }
                                    `}>
                                        {conversation.display_avatar ? (
                                            <img
                                                src={conversation.display_avatar}
                                                alt=""
                                                className="w-full h-full rounded-full object-cover"
                                            />
                                        ) : (
                                            getConversationIcon(conversation.type)
                                        )}
                                    </div>

                                    {/* Pinned indicator */}
                                    {conversation.is_pinned && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                                            <Pin className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-900 truncate">
                                                {conversation.display_name || conversation.title || 'محادثة'}
                                            </span>
                                            {conversation.is_muted && (
                                                <BellOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-400 flex-shrink-0">
                                            {formatTime(conversation.last_message_at)}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 mt-1">
                                        <p className="text-sm text-gray-500 truncate">
                                            {conversation.last_message_preview || 'لا توجد رسائل'}
                                        </p>

                                        {/* Unread badge */}
                                        {conversation.unread_count > 0 && (
                                            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-indigo-600 text-white text-xs font-medium rounded-full flex items-center justify-center">
                                                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConversationList;
