// ChatView Component
// عرض المحادثة بتصميم WhatsApp

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    ArrowRight,
    MoreVertical,
    Send,
    Paperclip,
    X,
    Loader2,
    Users,
    Info,
    BellOff,
    Bell,
    Pin,
    PinOff,
    LogOut,
    FileText,
    Smile
} from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { useConversation } from '../../hooks/useMessages';
import { Message, MessagesAPI } from '../../api/messages';
import MessageBubble from './MessageBubble';
import { useAuth } from '../../hooks/useAuth';
import { VoiceRecordButton } from '../VoiceMessage';

interface ChatViewProps {
    conversationId: string | null;
    onBack?: () => void;
    onOpenInfo?: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({
    conversationId,
    onBack,
    onOpenInfo
}) => {
    const { user } = useAuth();
    const {
        messages,
        isLoading,
        hasMore,
        loadMore,
        sendMessage,
        sendAttachment,
        sendVoiceMessage,
        markAsRead,
        conversation,
        isSending
    } = useConversation(conversationId);

    const [inputValue, setInputValue] = useState('');
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom on new messages
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages.length, scrollToBottom]);

    // Mark as read when entering conversation
    useEffect(() => {
        if (conversationId) {
            markAsRead();
        }
    }, [conversationId, markAsRead]);

    // Handle send message
    const handleSend = async () => {
        if (!inputValue.trim() || isSending) return;

        const success = await sendMessage(inputValue, replyTo?.id);
        if (success) {
            setInputValue('');
            setReplyTo(null);
            inputRef.current?.focus();
        }
    };

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Handle file selection (preview only, don't send yet)
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);

        // Generate preview URL for images
        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setFilePreviewUrl(url);
        } else {
            setFilePreviewUrl(null);
        }

        e.target.value = '';
    };

    // Cancel selected attachment
    const cancelAttachment = () => {
        if (filePreviewUrl) {
            URL.revokeObjectURL(filePreviewUrl);
        }
        setSelectedFile(null);
        setFilePreviewUrl(null);
    };

    // Handle send message or attachment
    const handleSendWithAttachment = async () => {
        if (selectedFile) {
            // Send attachment with optional caption and reply
            const caption = inputValue.trim() || undefined;
            await sendAttachment(selectedFile, replyTo?.id, caption);
            cancelAttachment();
            setInputValue(''); // Clear text input
            setReplyTo(null); // Clear reply after sending
        } else if (inputValue.trim()) {
            // Send text message
            await handleSend();
        }
    };

    // Handle reply
    const handleReply = (message: Message) => {
        setReplyTo(message);
        inputRef.current?.focus();
    };

    // Handle pin/unpin conversation
    const handleTogglePin = async () => {
        if (!conversationId || !conversation) return;
        await MessagesAPI.togglePinConversation(conversationId, !conversation.is_pinned);
        setShowMenu(false);
    };

    // Handle mute/unmute conversation
    const handleToggleMute = async () => {
        if (!conversationId || !conversation) return;
        await MessagesAPI.toggleMuteConversation(conversationId, !conversation.is_muted);
        setShowMenu(false);
    };

    // Handle leave conversation
    const handleLeaveConversation = async () => {
        if (!conversationId) return;
        const confirmed = window.confirm('هل أنت متأكد من مغادرة هذه المحادثة؟');
        if (!confirmed) return;

        const result = await MessagesAPI.leaveConversation(conversationId);
        if (result.success && onBack) {
            onBack();
        }
        setShowMenu(false);
    };

    // Auto-resize textarea
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        // Auto-resize
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
    };

    // No conversation selected
    if (!conversationId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <Send className="w-16 h-16 opacity-50" />
                </div>
                <h3 className="text-xl font-medium text-gray-600 mb-2">مرحباً بك في الرسائل</h3>
                <p className="text-sm">اختر محادثة للبدء</p>
            </div>
        );
    }

    const isGroupChat = conversation?.type === 'group' || conversation?.type === 'team';

    return (
        <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header */}
            <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                    {/* Back button (mobile) */}
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-2 -mr-2 rounded-full hover:bg-gray-100 text-gray-600 sm:hidden"
                        >
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    )}

                    {/* Avatar */}
                    <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                        ${conversation?.type === 'broadcast'
                            ? 'bg-amber-100 text-amber-600'
                            : conversation?.type === 'team'
                                ? 'bg-green-100 text-green-600'
                                : conversation?.type === 'group'
                                    ? 'bg-purple-100 text-purple-600'
                                    : 'bg-indigo-100 text-indigo-600'
                        }
                    `}>
                        {conversation?.display_avatar ? (
                            <img
                                src={conversation.display_avatar}
                                alt=""
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            <Users className="w-5 h-5" />
                        )}
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                            {conversation?.display_name || conversation?.title || 'محادثة'}
                        </h3>
                        {isGroupChat && (
                            <p className="text-xs text-gray-500">
                                {conversation?.type === 'team' ? 'فريق' : 'مجموعة'}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        {onOpenInfo && (
                            <button
                                onClick={onOpenInfo}
                                className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                            >
                                <Info className="w-5 h-5" />
                            </button>
                        )}

                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>

                            {showMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowMenu(false)}
                                    />
                                    <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20">
                                        <button
                                            onClick={handleTogglePin}
                                            className="w-full px-4 py-2 text-right text-sm hover:bg-gray-50 flex items-center gap-3"
                                        >
                                            {conversation?.is_pinned ? (
                                                <>
                                                    <PinOff className="w-4 h-4" />
                                                    إلغاء التثبيت
                                                </>
                                            ) : (
                                                <>
                                                    <Pin className="w-4 h-4" />
                                                    تثبيت المحادثة
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={handleToggleMute}
                                            className="w-full px-4 py-2 text-right text-sm hover:bg-gray-50 flex items-center gap-3"
                                        >
                                            {conversation?.is_muted ? (
                                                <>
                                                    <Bell className="w-4 h-4" />
                                                    تفعيل الإشعارات
                                                </>
                                            ) : (
                                                <>
                                                    <BellOff className="w-4 h-4" />
                                                    كتم الإشعارات
                                                </>
                                            )}
                                        </button>
                                        <hr className="my-2" />
                                        <button
                                            onClick={handleLeaveConversation}
                                            className="w-full px-4 py-2 text-right text-sm hover:bg-gray-50 flex items-center gap-3 text-red-600"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            مغادرة المحادثة
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-4 py-4"
            >
                {/* Load more button */}
                {hasMore && (
                    <div className="text-center mb-4">
                        <button
                            onClick={loadMore}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {isLoading ? 'جاري التحميل...' : 'تحميل رسائل أقدم'}
                        </button>
                    </div>
                )}

                {/* Loading */}
                {isLoading && messages.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                )}

                {/* No messages */}
                {!isLoading && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Send className="w-12 h-12 mb-4 opacity-50" />
                        <p>لا توجد رسائل بعد. ابدأ المحادثة!</p>
                    </div>
                )}

                {/* Messages list */}
                <div className="space-y-1">
                    {messages.map((message, index) => {
                        const showSender = isGroupChat &&
                            message.sender_id !== user?.id &&
                            (index === 0 || messages[index - 1].sender_id !== message.sender_id);

                        return (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                isOwn={message.sender_id === user?.id}
                                showSender={showSender}
                                onReply={handleReply}
                            />
                        );
                    })}
                </div>

                <div ref={messagesEndRef} />
            </div>

            {/* Reply preview */}
            {replyTo && (
                <div className="flex-shrink-0 bg-indigo-50 px-4 py-2 border-b border-indigo-100">
                    <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0 border-r-2 border-indigo-400 pr-3">
                            <p className="text-xs font-medium text-indigo-600">
                                الرد على {replyTo.sender?.full_name || 'رسالة'}
                            </p>
                            <p className="text-sm text-gray-600 truncate">
                                {replyTo.content}
                            </p>
                        </div>
                        <button
                            onClick={() => setReplyTo(null)}
                            className="p-1 rounded-full hover:bg-indigo-100 text-gray-500"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Attachment Preview */}
            {selectedFile && (
                <div className="flex-shrink-0 bg-gray-50 px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        {/* Preview */}
                        <div className="flex-shrink-0">
                            {filePreviewUrl ? (
                                <img
                                    src={filePreviewUrl}
                                    alt="معاينة"
                                    className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                                />
                            ) : (
                                <div className="w-16 h-16 bg-indigo-100 rounded-lg flex items-center justify-center">
                                    <FileText className="w-8 h-8 text-indigo-600" />
                                </div>
                            )}
                        </div>

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {selectedFile.name}
                            </p>
                            <p className="text-xs text-gray-500">
                                {(selectedFile.size / 1024).toFixed(1)} KB
                            </p>
                        </div>

                        {/* Cancel button */}
                        <button
                            onClick={cancelAttachment}
                            className="p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Input area */}
            <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-3 relative">
                {/* Emoji Picker Popup */}
                {showEmojiPicker && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowEmojiPicker(false)}
                        />
                        <div
                            ref={emojiPickerRef}
                            className="absolute bottom-full left-4 mb-2 z-50 shadow-2xl rounded-xl overflow-hidden"
                        >
                            <Picker
                                data={data}
                                onEmojiSelect={(emoji: any) => {
                                    setInputValue(prev => prev + emoji.native);
                                    setShowEmojiPicker(false);
                                    inputRef.current?.focus();
                                }}
                                locale="ar"
                                theme="light"
                                previewPosition="none"
                                skinTonePosition="none"
                                searchPosition="sticky"
                                navPosition="bottom"
                                perLine={8}
                                emojiSize={28}
                                emojiButtonSize={36}
                            />
                        </div>
                    </>
                )}

                <div className="flex items-end gap-2">
                    {/* Emoji button */}
                    <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`p-2.5 rounded-full transition-colors ${showEmojiPicker
                            ? 'bg-indigo-100 text-indigo-600'
                            : 'hover:bg-gray-100 text-gray-500'
                            }`}
                        type="button"
                    >
                        <Smile className="w-5 h-5" />
                    </button>

                    {/* Attachment button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                        disabled={isSending || !!selectedFile}
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                        className="hidden"
                    />

                    {/* Voice Record button */}
                    <VoiceRecordButton
                        onSend={async (audioUrl, duration) => {
                            // إرسال الرسالة الصوتية مع attachment_url
                            await sendVoiceMessage(audioUrl, duration, replyTo?.id);
                            setReplyTo(null);
                        }}
                        disabled={isSending}
                    />

                    {/* Text input */}
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyPress}
                            placeholder={selectedFile ? "إضافة تعليق (اختياري)..." : "اكتب رسالة..."}
                            rows={1}
                            className="
                                w-full py-2.5 px-4 pr-4 bg-gray-100 rounded-2xl
                                border-0 resize-none
                                focus:bg-white focus:ring-2 focus:ring-indigo-500/20
                                placeholder:text-gray-400
                                text-sm leading-relaxed
                                max-h-32
                            "
                            style={{ minHeight: '44px' }}
                            disabled={isSending}
                            onFocus={() => setShowEmojiPicker(false)}
                        />
                    </div>

                    {/* Send button */}
                    <button
                        onClick={handleSendWithAttachment}
                        disabled={(!inputValue.trim() && !selectedFile) || isSending}
                        className={`
                            p-2.5 rounded-full transition-all
                            ${(inputValue.trim() || selectedFile) && !isSending
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/30'
                                : 'bg-gray-100 text-gray-400'
                            }
                        `}
                    >
                        {isSending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatView;
