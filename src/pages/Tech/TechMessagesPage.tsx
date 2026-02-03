// TechMessagesPage Component
// صفحة الرسائل لتطبيق الفني - مع TechLayout

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMessages } from '../../hooks/useMessages';
import ConversationList from '../../components/Messages/ConversationList';
import ChatView from '../../components/Messages/ChatView';
import NewConversationModal from '../../components/Messages/NewConversationModal';
import TechLayout from '../../components/Layout/TechLayout';

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
    // استخدام ارتفاع محسوب لتجنب scroll من TechLayout
    if (conversationId) {
        return (
            <TechLayout>
                <div
                    className="flex flex-col bg-white overflow-hidden"
                    style={{
                        height: 'calc(100vh - 140px)', // header (~80px) + bottom nav (~60px)
                        marginTop: '-1rem' // تعويض padding الأعلى
                    }}
                >
                    <ChatView
                        conversationId={conversationId}
                        onBack={handleBack}
                    />
                </div>
            </TechLayout>
        );
    }

    // عرض قائمة المحادثات
    return (
        <TechLayout onRefresh={refreshConversations}>
            <div className="h-full flex flex-col bg-white">
                {/* Conversations List with its own header and search */}
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
        </TechLayout>
    );
};

export default TechMessagesPage;
