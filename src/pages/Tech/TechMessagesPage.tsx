// TechMessagesPage Component
// صفحة الرسائل لتطبيق الفني - معزولة وبسيطة

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, MessageSquarePlus } from 'lucide-react';
import { useMessages } from '../../hooks/useMessages';
import ConversationList from '../../components/Messages/ConversationList';
import ChatView from '../../components/Messages/ChatView';
import NewConversationModal from '../../components/Messages/NewConversationModal';

const TechMessagesPage: React.FC = () => {
    const { conversationId } = useParams<{ conversationId?: string }>();
    const navigate = useNavigate();
    const { conversations, isLoading, refreshConversations } = useMessages();
    const [showNewModal, setShowNewModal] = useState(false);

    const handleSelectConversation = (id: string) => {
        navigate(`/tech/messages/${id}`);
    };

    const handleBack = () => {
        navigate('/tech/messages');
    };

    const handleConversationCreated = (id: string) => {
        refreshConversations();
        navigate(`/tech/messages/${id}`);
    };

    // عرض المحادثة إذا تم اختيارها
    if (conversationId) {
        return (
            <div className="h-full flex flex-col bg-white">
                <ChatView
                    conversationId={conversationId}
                    onBack={handleBack}
                />
            </div>
        );
    }

    // عرض قائمة المحادثات
    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-100 bg-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/tech/dashboard')}
                            className="p-2 -mr-2 rounded-full hover:bg-gray-100 text-gray-600"
                        >
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl font-bold text-gray-900">الرسائل</h1>
                    </div>
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="p-2 rounded-full hover:bg-gray-100 text-indigo-600"
                        title="محادثة جديدة"
                    >
                        <MessageSquarePlus className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
                <ConversationList
                    conversations={conversations}
                    selectedId={null}
                    onSelect={handleSelectConversation}
                    onNewChat={() => setShowNewModal(true)}
                    isLoading={isLoading}
                />
            </div>

            {/* New Conversation Modal */}
            <NewConversationModal
                isOpen={showNewModal}
                onClose={() => setShowNewModal(false)}
                onConversationCreated={handleConversationCreated}
                userRole="technician"
            />
        </div>
    );
};

export default TechMessagesPage;
