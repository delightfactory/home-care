// Messages API Layer
// نظام الرسائل الداخلية - WhatsApp-like

import { supabase, handleSupabaseError } from '../lib/supabase';
import type { ApiResponse, PaginatedResponse } from '../types';

// ============== Types ==============

export type ConversationType = 'direct' | 'team' | 'group' | 'broadcast';
export type MessageContentType = 'text' | 'image' | 'file' | 'system' | 'voice';
export type ParticipantRole = 'admin' | 'moderator' | 'member';

export interface Conversation {
    id: string;
    type: ConversationType;
    title: string | null;
    description: string | null;
    avatar_url: string | null;
    team_id: string | null;
    target_role: string | null;
    target_all: boolean;
    created_by: string;
    last_message_at: string | null;
    last_message_preview: string | null;
    is_active: boolean;
    is_pinned: boolean;
    created_at: string;
    updated_at: string;
}

export interface ConversationWithDetails extends Conversation {
    unread_count: number;
    is_muted: boolean;
    last_read_at: string | null;
    display_name: string | null;
    display_avatar: string | null;
    participants?: ConversationParticipant[];
}

export interface ConversationParticipant {
    id: string;
    conversation_id: string;
    user_id: string;
    role: ParticipantRole;
    last_read_at: string | null;
    unread_count: number;
    is_muted: boolean;
    is_active: boolean;
    joined_at: string;
    user?: {
        id: string;
        full_name: string;
        role?: { name: string } | null;
    };
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string | null;
    content: string | null;
    content_type: MessageContentType;
    attachment_url: string | null;
    attachment_name: string | null;
    attachment_size: number | null;
    attachment_mime_type: string | null;
    reply_to_id: string | null;
    is_system: boolean;
    system_action: string | null;
    is_edited: boolean;
    is_deleted: boolean;
    created_at: string;
    sender?: {
        id: string;
        full_name: string;
    };
    reply_to?: Message | null;
}

export interface SendMessageData {
    content: string;
    content_type?: MessageContentType;
    attachment_url?: string;
    attachment_name?: string;
    attachment_size?: number;
    attachment_mime_type?: string;
    reply_to_id?: string;
}

// ============== API Class ==============

export class MessagesAPI {
    // ============== المحادثات ==============

    /**
     * جلب محادثات المستخدم
     */
    static async getConversations(): Promise<ConversationWithDetails[]> {
        try {
            const { data, error } = await supabase
                .from('user_conversations')
                .select('*')
                .order('is_pinned', { ascending: false })
                .order('last_message_at', { ascending: false, nullsFirst: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            throw new Error(handleSupabaseError(error));
        }
    }

    /**
     * جلب محادثة واحدة بالتفاصيل
     */
    static async getConversation(conversationId: string): Promise<ConversationWithDetails | null> {
        try {
            const { data, error } = await supabase
                .from('user_conversations')
                .select('*')
                .eq('id', conversationId)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching conversation:', error);
            return null;
        }
    }

    /**
     * جلب المشاركين في محادثة
     */
    static async getParticipants(conversationId: string): Promise<ConversationParticipant[]> {
        try {
            const { data, error } = await supabase
                .from('conversation_participants')
                .select(`
                    *,
                    user:users(id, full_name, role:roles(name))
                `)
                .eq('conversation_id', conversationId)
                .eq('is_active', true);

            if (error) throw error;
            return data || [];
        } catch (error) {
            throw new Error(handleSupabaseError(error));
        }
    }

    /**
     * إنشاء أو جلب محادثة مباشرة
     */
    static async getOrCreateDirectConversation(otherUserId: string): Promise<string> {
        try {
            const { data, error } = await supabase
                .rpc('get_or_create_direct_conversation', { p_other_user_id: otherUserId });

            if (error) throw error;
            return data;
        } catch (error) {
            throw new Error(handleSupabaseError(error));
        }
    }

    /**
     * إنشاء محادثة فريق
     */
    static async createTeamConversation(teamId: string): Promise<string> {
        try {
            const { data, error } = await supabase
                .rpc('create_team_conversation', { p_team_id: teamId });

            if (error) throw error;
            return data;
        } catch (error) {
            throw new Error(handleSupabaseError(error));
        }
    }

    /**
     * إنشاء مجموعة جديدة
     */
    static async createGroup(
        title: string,
        participantIds: string[],
        description?: string
    ): Promise<ApiResponse<string>> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { success: false, error: 'غير مسجل دخول' };

            // إنشاء المحادثة
            const { data: conversation, error: convError } = await supabase
                .from('conversations')
                .insert({
                    type: 'group',
                    title,
                    description,
                    created_by: user.id
                })
                .select('id')
                .single();

            if (convError) throw convError;

            // إضافة المنشئ كـ admin
            const participants = [
                { conversation_id: conversation.id, user_id: user.id, role: 'admin' },
                ...participantIds.map(id => ({
                    conversation_id: conversation.id,
                    user_id: id,
                    role: 'member'
                }))
            ];

            const { error: partError } = await supabase
                .from('conversation_participants')
                .insert(participants);

            if (partError) throw partError;

            // رسالة نظام
            await supabase.from('messages').insert({
                conversation_id: conversation.id,
                sender_id: user.id,
                content: 'تم إنشاء المجموعة',
                is_system: true,
                system_action: 'created'
            });

            return { success: true, data: conversation.id };
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) };
        }
    }

    /**
     * إرسال إعلان Broadcast
     */
    static async createBroadcast(
        title: string,
        message: string,
        targetRole?: string,
        targetAll: boolean = false
    ): Promise<ApiResponse<string>> {
        try {
            const { data, error } = await supabase
                .rpc('create_broadcast', {
                    p_title: title,
                    p_message: message,
                    p_target_role: targetRole,
                    p_target_all: targetAll
                });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) };
        }
    }

    /**
     * تثبيت/إلغاء تثبيت محادثة
     */
    static async togglePinConversation(conversationId: string, pinned: boolean): Promise<ApiResponse<void>> {
        try {
            const { error } = await supabase
                .from('conversations')
                .update({ is_pinned: pinned })
                .eq('id', conversationId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) };
        }
    }

    /**
     * كتم/إلغاء كتم محادثة
     */
    static async toggleMuteConversation(conversationId: string, muted: boolean): Promise<ApiResponse<void>> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { success: false, error: 'غير مسجل دخول' };

            const { error } = await supabase
                .from('conversation_participants')
                .update({ is_muted: muted })
                .eq('conversation_id', conversationId)
                .eq('user_id', user.id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) };
        }
    }

    // ============== الرسائل ==============

    /**
     * جلب رسائل محادثة
     */
    static async getMessages(
        conversationId: string,
        page: number = 1,
        limit: number = 50
    ): Promise<PaginatedResponse<Message>> {
        try {
            const offset = (page - 1) * limit;

            const { data, error, count } = await supabase
                .from('messages')
                .select(`
                    *,
                    sender:users!sender_id(id, full_name),
                    reply_to:messages!reply_to_id(id, content, sender:users!sender_id(id, full_name))
                `, { count: 'exact' })
                .eq('conversation_id', conversationId)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            // Clean up empty reply_to objects (Supabase returns {} for null foreign keys)
            const cleanedData = (data || []).map(msg => ({
                ...msg,
                reply_to: msg.reply_to && (msg.reply_to as any).id ? msg.reply_to : null
            }));

            return {
                data: cleanedData.reverse(), // عكس الترتيب للعرض
                total: count || 0,
                page,
                limit,
                total_pages: Math.ceil((count || 0) / limit)
            };
        } catch (error) {
            throw new Error(handleSupabaseError(error));
        }
    }

    /**
     * إرسال رسالة
     */
    static async sendMessage(
        conversationId: string,
        messageData: SendMessageData
    ): Promise<ApiResponse<Message>> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { success: false, error: 'غير مسجل دخول' };

            // Build message data - only include reply_to_id if it has a value
            const insertData: any = {
                conversation_id: conversationId,
                sender_id: user.id,
                content: messageData.content,
                content_type: messageData.content_type || 'text',
                attachment_url: messageData.attachment_url,
                attachment_name: messageData.attachment_name,
                attachment_size: messageData.attachment_size,
                attachment_mime_type: messageData.attachment_mime_type,
            };

            // Only add reply_to_id if it's truthy (not null, undefined, or empty)
            if (messageData.reply_to_id) {
                insertData.reply_to_id = messageData.reply_to_id;
            }

            const { data, error } = await supabase
                .from('messages')
                .insert(insertData)
                .select(`
                    *,
                    sender:users!sender_id(id, full_name)
                `)
                .single();

            if (error) throw error;

            // Fetch reply_to data separately (FK relation doesn't work properly in insert().select())
            if (data && data.reply_to_id) {
                const { data: replyToData } = await supabase
                    .from('messages')
                    .select('id, content, sender:users!sender_id(id, full_name)')
                    .eq('id', data.reply_to_id)
                    .single();

                if (replyToData) {
                    (data as any).reply_to = replyToData;
                }
            }

            return { success: true, data };
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) };
        }
    }

    /**
     * تعديل رسالة
     */
    static async editMessage(messageId: string, newContent: string): Promise<ApiResponse<void>> {
        try {
            const { error } = await supabase
                .from('messages')
                .update({
                    content: newContent,
                    is_edited: true,
                    edited_at: new Date().toISOString()
                })
                .eq('id', messageId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) };
        }
    }

    /**
     * حذف رسالة
     */
    static async deleteMessage(messageId: string, forEveryone: boolean = false): Promise<ApiResponse<void>> {
        try {
            const { error } = await supabase
                .from('messages')
                .update({
                    is_deleted: true,
                    deleted_at: new Date().toISOString(),
                    deleted_for_everyone: forEveryone,
                    content: forEveryone ? 'تم حذف هذه الرسالة' : null
                })
                .eq('id', messageId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) };
        }
    }

    // ============== حالة القراءة ==============

    /**
     * تحديد المحادثة كمقروءة
     */
    static async markAsRead(conversationId: string): Promise<void> {
        try {
            await supabase.rpc('mark_conversation_as_read', { p_conversation_id: conversationId });
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    }

    /**
     * جلب عدد الرسائل غير المقروءة الإجمالي
     */
    static async getTotalUnreadCount(): Promise<number> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return 0;

            const { data, error } = await supabase
                .from('conversation_participants')
                .select('unread_count')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .gt('unread_count', 0);

            if (error) throw error;
            return data?.reduce((sum, p) => sum + p.unread_count, 0) || 0;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    // ============== المرفقات ==============

    /**
     * رفع مرفق (صورة/ملف)
     */
    static async uploadAttachment(
        conversationId: string,
        file: File
    ): Promise<ApiResponse<{ url: string; name: string; size: number; mimeType: string }>> {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const filePath = `messages/${conversationId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('receipts')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('receipts')
                .getPublicUrl(filePath);

            return {
                success: true,
                data: {
                    url: publicUrl,
                    name: file.name,
                    size: file.size,
                    mimeType: file.type
                }
            };
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) };
        }
    }

    // ============== المستخدمين للمحادثة ==============

    /**
     * جلب قائمة المستخدمين للمحادثة الجديدة
     */
    static async getAvailableUsers(): Promise<Array<{
        id: string;
        full_name: string;
        role_name: string | null;
    }>> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, role:roles!role_id(name)')
                .eq('is_active', true)
                .neq('id', user.id)
                .order('full_name');

            if (error) {
                console.error('Error in getAvailableUsers query:', error);
                throw error;
            }

            console.log('getAvailableUsers result:', data?.length, 'users found');

            // Map role relation to flat role_name
            return (data || []).map((u: any) => ({
                id: u.id,
                full_name: u.full_name,
                role_name: u.role?.name || null
            }));
        } catch (error) {
            console.error('Error getting users:', error);
            return [];
        }
    }

    /**
     * جلب الفرق المتاحة
     */
    static async getAvailableTeams(): Promise<Array<{ id: string; name: string }>> {
        try {
            const { data, error } = await supabase
                .from('teams')
                .select('id, name')
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting teams:', error);
            return [];
        }
    }

    // ============== إضافة/إزالة مشاركين ==============

    /**
     * إضافة مشارك لمجموعة
     */
    static async addParticipant(
        conversationId: string,
        userId: string
    ): Promise<ApiResponse<void>> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { success: false, error: 'غير مسجل دخول' };

            const { error } = await supabase
                .from('conversation_participants')
                .insert({
                    conversation_id: conversationId,
                    user_id: userId,
                    role: 'member'
                });

            if (error) throw error;

            // رسالة نظام
            const { data: addedUser } = await supabase
                .from('users')
                .select('full_name')
                .eq('id', userId)
                .single();

            await supabase.from('messages').insert({
                conversation_id: conversationId,
                sender_id: user.id,
                content: `تمت إضافة ${addedUser?.full_name || 'مستخدم'}`,
                is_system: true,
                system_action: 'joined'
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) };
        }
    }

    /**
     * إزالة مشارك من مجموعة
     */
    static async removeParticipant(
        conversationId: string,
        userId: string
    ): Promise<ApiResponse<void>> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { success: false, error: 'غير مسجل دخول' };

            const { error } = await supabase
                .from('conversation_participants')
                .update({ is_active: false, left_at: new Date().toISOString() })
                .eq('conversation_id', conversationId)
                .eq('user_id', userId);

            if (error) throw error;

            // رسالة نظام
            const { data: removedUser } = await supabase
                .from('users')
                .select('full_name')
                .eq('id', userId)
                .single();

            await supabase.from('messages').insert({
                conversation_id: conversationId,
                sender_id: user.id,
                content: `غادر ${removedUser?.full_name || 'مستخدم'}`,
                is_system: true,
                system_action: 'left'
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) };
        }
    }

    /**
     * مغادرة مجموعة
     */
    static async leaveConversation(conversationId: string): Promise<ApiResponse<void>> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { success: false, error: 'غير مسجل دخول' };

            return this.removeParticipant(conversationId, user.id);
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) };
        }
    }
}

export default MessagesAPI;
