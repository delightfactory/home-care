// useMessages Hook
// Real-time messaging with Supabase subscriptions

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { MessagesAPI, ConversationWithDetails, Message } from '../api/messages';

interface UseMessagesReturn {
    conversations: ConversationWithDetails[];
    isLoading: boolean;
    totalUnreadCount: number;
    refreshConversations: () => Promise<void>;
}

interface UseConversationReturn {
    messages: Message[];
    isLoading: boolean;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    sendMessage: (content: string, replyToId?: string) => Promise<boolean>;
    sendAttachment: (file: File, replyToId?: string, caption?: string) => Promise<boolean>;
    markAsRead: () => void;
    conversation: ConversationWithDetails | null;
    isSending: boolean;
}

/**
 * Hook لإدارة قائمة المحادثات مع Real-time
 */
export function useMessages(): UseMessagesReturn {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalUnreadCount, setTotalUnreadCount] = useState(0);

    // جلب المحادثات
    const fetchConversations = useCallback(async () => {
        if (!user) return;

        try {
            const data = await MessagesAPI.getConversations();
            setConversations(data);

            // حساب العدد الإجمالي للرسائل غير المقروءة
            const unread = data.reduce((sum, c) => sum + (c.unread_count || 0), 0);
            setTotalUnreadCount(unread);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    // Real-time subscription
    useEffect(() => {
        if (!user) return;

        fetchConversations();

        // Subscribe to conversation changes
        const conversationsChannel = supabase
            .channel('conversations_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'conversations'
                },
                () => {
                    fetchConversations();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'conversation_participants',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    fetchConversations();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(conversationsChannel);
        };
    }, [user, fetchConversations]);

    const refreshConversations = useCallback(async () => {
        setIsLoading(true);
        await fetchConversations();
    }, [fetchConversations]);

    return {
        conversations,
        isLoading,
        totalUnreadCount,
        refreshConversations
    };
}

/**
 * Hook لإدارة محادثة واحدة مع الرسائل
 */
export function useConversation(conversationId: string | null): UseConversationReturn {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const [conversation, setConversation] = useState<ConversationWithDetails | null>(null);
    const messagesRef = useRef<Message[]>([]);

    // جلب الرسائل
    const fetchMessages = useCallback(async (pageNum: number = 1, append: boolean = false) => {
        if (!conversationId) return;

        try {
            setIsLoading(true);
            const result = await MessagesAPI.getMessages(conversationId, pageNum, 50);

            if (append) {
                setMessages(prev => [...result.data, ...prev]);
            } else {
                setMessages(result.data);
            }

            messagesRef.current = append ? [...result.data, ...messagesRef.current] : result.data;
            setHasMore(pageNum < result.total_pages);
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setIsLoading(false);
        }
    }, [conversationId]);

    // جلب تفاصيل المحادثة
    const fetchConversation = useCallback(async () => {
        if (!conversationId) return;

        try {
            const data = await MessagesAPI.getConversation(conversationId);
            setConversation(data);
        } catch (error) {
            console.error('Error fetching conversation:', error);
        }
    }, [conversationId]);

    // تحميل المحادثة والرسائل
    useEffect(() => {
        if (!conversationId || !user) return;

        setMessages([]);
        setPage(1);
        setHasMore(true);
        fetchConversation();
        fetchMessages(1);
    }, [conversationId, user, fetchConversation, fetchMessages]);

    // Real-time subscription للرسائل
    useEffect(() => {
        if (!conversationId || !user) return;

        console.log('Setting up realtime subscription for conversation:', conversationId);

        const channel = supabase
            .channel(`messages_${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                async (payload) => {
                    console.log('Realtime INSERT received:', payload);
                    const newMessage = payload.new as Message;

                    // جلب بيانات المرسل
                    if (newMessage.sender_id) {
                        const { data: sender } = await supabase
                            .from('users')
                            .select('id, full_name')
                            .eq('id', newMessage.sender_id)
                            .single();

                        if (sender) {
                            (newMessage as any).sender = sender;
                        }
                    }

                    // جلب بيانات الرسالة المُرد عليها (WhatsApp style)
                    if (newMessage.reply_to_id) {
                        const { data: replyToMessage } = await supabase
                            .from('messages')
                            .select('id, content, sender:users!sender_id(id, full_name)')
                            .eq('id', newMessage.reply_to_id)
                            .single();

                        if (replyToMessage) {
                            (newMessage as any).reply_to = replyToMessage;
                        }
                    }

                    // إضافة الرسالة الجديدة
                    setMessages(prev => {
                        // تجنب التكرار
                        if (prev.some(m => m.id === newMessage.id)) return prev;
                        return [...prev, newMessage];
                    });

                    // تحديث حالة القراءة إذا كانت الرسالة من شخص آخر
                    if (newMessage.sender_id !== user.id) {
                        MessagesAPI.markAsRead(conversationId);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    console.log('Realtime UPDATE received:', payload);
                    const updatedMessage = payload.new as Message;
                    setMessages(prev =>
                        prev.map(m => m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m)
                    );
                }
            )
            .subscribe((status) => {
                console.log('Realtime subscription status:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId, user]);

    // تحديد كمقروء عند الدخول
    const markAsRead = useCallback(() => {
        if (conversationId) {
            MessagesAPI.markAsRead(conversationId);
        }
    }, [conversationId]);

    // تحميل المزيد
    const loadMore = useCallback(async () => {
        if (!hasMore || isLoading) return;
        const nextPage = page + 1;
        setPage(nextPage);
        await fetchMessages(nextPage, true);
    }, [hasMore, isLoading, page, fetchMessages]);

    // إرسال رسالة
    const sendMessage = useCallback(async (content: string, replyToId?: string): Promise<boolean> => {
        if (!conversationId || !content.trim()) return false;

        setIsSending(true);
        try {
            const result = await MessagesAPI.sendMessage(conversationId, {
                content: content.trim(),
                reply_to_id: replyToId
            });

            // إضافة الرسالة المُرسلة للواجهة فوراً
            if (result.success && result.data) {
                setMessages(prev => {
                    // تجنب التكرار
                    if (prev.some(m => m.id === result.data!.id)) return prev;
                    return [...prev, result.data!];
                });
            }

            return result.success;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        } finally {
            setIsSending(false);
        }
    }, [conversationId]);

    // إرسال مرفق
    const sendAttachment = useCallback(async (file: File, replyToId?: string, caption?: string): Promise<boolean> => {
        if (!conversationId) return false;

        setIsSending(true);
        try {
            // رفع الملف
            const uploadResult = await MessagesAPI.uploadAttachment(conversationId, file);
            if (!uploadResult.success || !uploadResult.data) {
                console.error('Upload failed:', uploadResult.error);
                return false;
            }

            // تحديد نوع المحتوى
            const contentType = file.type.startsWith('image/') ? 'image' : 'file';

            // إرسال الرسالة مع المرفق
            const result = await MessagesAPI.sendMessage(conversationId, {
                content: caption || file.name,
                content_type: contentType,
                attachment_url: uploadResult.data.url,
                attachment_name: uploadResult.data.name,
                attachment_size: uploadResult.data.size,
                attachment_mime_type: uploadResult.data.mimeType,
                reply_to_id: replyToId
            });

            // إضافة الرسالة المُرسلة للواجهة فوراً
            if (result.success && result.data) {
                setMessages(prev => {
                    if (prev.some(m => m.id === result.data!.id)) return prev;
                    return [...prev, result.data!];
                });
            }

            return result.success;
        } catch (error) {
            console.error('Error sending attachment:', error);
            return false;
        } finally {
            setIsSending(false);
        }
    }, [conversationId]);

    return {
        messages,
        isLoading,
        hasMore,
        loadMore,
        sendMessage,
        sendAttachment,
        markAsRead,
        conversation,
        isSending
    };
}

/**
 * Hook لعدد الرسائل غير المقروءة (للـ Badge)
 */
export function useUnreadMessagesCount(): number {
    const { user } = useAuth();
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!user) {
            setCount(0);
            return;
        }

        // جلب العدد الأولي
        MessagesAPI.getTotalUnreadCount().then(setCount);

        // Subscribe للتحديثات
        const channel = supabase
            .channel('unread_count')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'conversation_participants',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    MessagesAPI.getTotalUnreadCount().then(setCount);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    return count;
}

export default useMessages;
