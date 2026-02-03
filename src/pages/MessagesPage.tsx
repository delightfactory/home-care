// MessagesPage Component
// صفحة الرسائل الرئيسية بتصميم WhatsApp

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMessages } from '../hooks/useMessages';
import { useAuth } from '../hooks/useAuth';
import ConversationList from '../components/Messages/ConversationList';
import ChatView from '../components/Messages/ChatView';
import NewConversationModal from '../components/Messages/NewConversationModal';

const MessagesPage: React.FC = () => {
    const { conversationId } = useParams<{ conversationId?: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { conversations, isLoading, refreshConversations } = useMessages();
    const [showNewModal, setShowNewModal] = useState(false);
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

    // Handle resize
    useEffect(() => {
        const handleResize = () => setIsMobileView(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleSelectConversation = (id: string) => {
        navigate(`/messages/${id}`);
    };

    const handleBack = () => {
        navigate('/messages');
    };

    const handleConversationCreated = (id: string) => {
        refreshConversations();
        navigate(`/messages/${id}`);
    };

    // Mobile: show only list or chat based on route
    if (isMobileView) {
        return (
            <div className="h-screen flex flex-col bg-white">
                {conversationId ? (
                    <ChatView
                        conversationId={conversationId}
                        onBack={handleBack}
                    />
                ) : (
                    <ConversationList
                        conversations={conversations}
                        selectedId={null}
                        onSelect={handleSelectConversation}
                        onNewChat={() => setShowNewModal(true)}
                        isLoading={isLoading}
                    />
                )}

                <NewConversationModal
                    isOpen={showNewModal}
                    onClose={() => setShowNewModal(false)}
                    onConversationCreated={handleConversationCreated}
                    userRole={(user as any)?.role?.name}
                />
            </div>
        );
    }

    // Desktop: split view
    return (
        <div className="h-screen flex bg-gray-100">
            {/* Sidebar - Conversation List */}
            <div className="w-80 lg:w-96 flex-shrink-0 border-l border-gray-200 bg-white">
                <ConversationList
                    conversations={conversations}
                    selectedId={conversationId || null}
                    onSelect={handleSelectConversation}
                    onNewChat={() => setShowNewModal(true)}
                    isLoading={isLoading}
                />
            </div>

            {/* Main - Chat View */}
            <div className="flex-1 flex flex-col">
                <ChatView
                    conversationId={conversationId || null}
                />
            </div>

            <NewConversationModal
                isOpen={showNewModal}
                onClose={() => setShowNewModal(false)}
                onConversationCreated={handleConversationCreated}
                userRole={(user as any)?.role?.name}
            />
        </div>
    );
};

export default MessagesPage;
