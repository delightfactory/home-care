// MessageBubble Component
// فقاعة الرسالة بتصميم WhatsApp

import React, { memo } from 'react';
import {
    CheckCheck,
    Reply,
    FileText,
    Download,
    X
} from 'lucide-react';
import { Message } from '../../api/messages';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
    showSender?: boolean;
    onReply?: (message: Message) => void;
    onDelete?: (messageId: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = memo(({
    message,
    isOwn,
    showSender = false,
    onReply
}) => {
    const formatTime = (date: string) => {
        try {
            return format(new Date(date), 'h:mm a', { locale: ar });
        } catch {
            return '';
        }
    };

    // رسالة النظام
    if (message.is_system) {
        return (
            <div className="flex justify-center my-3">
                <div className="px-4 py-1.5 bg-gray-100 rounded-full text-xs text-gray-500">
                    {message.content}
                </div>
            </div>
        );
    }

    // رسالة محذوفة
    if (message.is_deleted) {
        return (
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
                <div className={`
                    max-w-[80%] px-4 py-2 rounded-2xl
                    ${isOwn
                        ? 'bg-gray-200 text-gray-400 rounded-br-md'
                        : 'bg-gray-100 text-gray-400 rounded-bl-md'
                    }
                    italic text-sm
                `}>
                    <X className="w-4 h-4 inline-block ml-1" />
                    تم حذف هذه الرسالة
                </div>
            </div>
        );
    }

    const hasAttachment = message.attachment_url;
    const isImage = message.content_type === 'image';

    return (
        <div id={`msg-${message.id}`} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1 group`}>
            <div className={`
                relative max-w-[80%] sm:max-w-[70%]
                ${isOwn
                    ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl rounded-br-md'
                    : 'bg-white shadow-sm text-gray-900 rounded-2xl rounded-bl-md border border-gray-100'
                }
            `}>
                {/* Sender name (for groups) - FIRST */}
                {showSender && !isOwn && message.sender && (
                    <div className="px-3 pt-2 pb-0.5 text-xs font-semibold text-indigo-600">
                        {message.sender.full_name}
                    </div>
                )}

                {/* Reply reference - WhatsApp Style */}
                {/* Only show if reply_to has valid id (not empty object) */}
                {message.reply_to && (message.reply_to as any).id && (
                    <div
                        className={`
                            mx-2 ${showSender && !isOwn ? 'mt-1' : 'mt-2'} mb-1 
                            overflow-hidden rounded-lg cursor-pointer
                            transition-all duration-150 hover:opacity-80
                            ${isOwn
                                ? 'bg-white/10'
                                : 'bg-gray-100/80'
                            }
                        `}
                        onClick={() => {
                            // Scroll to original message if exists in DOM
                            const replyId = (message.reply_to as any).id;
                            const element = document.getElementById(`msg-${replyId}`);
                            if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                element.classList.add('animate-pulse');
                                setTimeout(() => element.classList.remove('animate-pulse'), 2000);
                            }
                        }}
                    >
                        {/* Colored border - WhatsApp signature */}
                        <div className={`
                            flex
                            ${isOwn ? 'border-r-4 border-emerald-400' : 'border-r-4 border-indigo-500'}
                        `}>
                            <div className="flex-1 px-3 py-2 min-w-0">
                                {/* Reply sender name */}
                                <span className={`
                                    text-xs font-semibold block truncate
                                    ${isOwn ? 'text-emerald-300' : 'text-indigo-600'}
                                `}>
                                    {(message.reply_to as any).sender?.full_name || 'رسالة'}
                                </span>
                                {/* Reply content preview */}
                                <p className={`
                                    text-xs mt-0.5 line-clamp-1
                                    ${isOwn ? 'text-white/70' : 'text-gray-600'}
                                `}>
                                    {(message.reply_to as any).content || '📎 مرفق'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Image attachment */}
                {hasAttachment && isImage && (
                    <div className="p-1">
                        <img
                            src={message.attachment_url!}
                            alt=""
                            className="rounded-xl max-w-full cursor-pointer hover:opacity-95 transition-opacity"
                            style={{ maxHeight: '300px' }}
                            onClick={() => window.open(message.attachment_url!, '_blank')}
                        />
                    </div>
                )}

                {/* File attachment */}
                {hasAttachment && !isImage && (
                    <a
                        href={message.attachment_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`
                            m-2 p-3 rounded-xl flex items-center gap-3
                            ${isOwn
                                ? 'bg-indigo-500/30 hover:bg-indigo-500/40'
                                : 'bg-gray-50 hover:bg-gray-100'
                            }
                            transition-colors
                        `}
                    >
                        <div className={`
                            w-10 h-10 rounded-lg flex items-center justify-center
                            ${isOwn ? 'bg-white/20' : 'bg-indigo-100'}
                        `}>
                            <FileText className={`w-5 h-5 ${isOwn ? 'text-white' : 'text-indigo-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-gray-900'}`}>
                                {message.attachment_name || 'ملف'}
                            </p>
                            <p className={`text-xs ${isOwn ? 'text-indigo-200' : 'text-gray-500'}`}>
                                {message.attachment_size
                                    ? `${(message.attachment_size / 1024).toFixed(1)} KB`
                                    : 'اضغط للتحميل'
                                }
                            </p>
                        </div>
                        <Download className={`w-5 h-5 ${isOwn ? 'text-white/70' : 'text-gray-400'}`} />
                    </a>
                )}

                {/* Message content */}
                {message.content && (
                    <div className="px-3 py-2">
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                            {message.content}
                        </p>
                    </div>
                )}

                {/* Time & status */}
                <div className={`
                    flex items-center justify-end gap-1 px-3 pb-2 -mt-1
                    ${isOwn ? 'text-indigo-200' : 'text-gray-400'}
                `}>
                    {message.is_edited && (
                        <span className="text-[10px]">تم التعديل</span>
                    )}
                    <span className="text-[10px]">{formatTime(message.created_at)}</span>
                    {isOwn && (
                        <CheckCheck className="w-4 h-4" />
                    )}
                </div>

                {/* Action buttons */}
                <div className={`
                    absolute top-1 ${isOwn ? 'left-1' : 'right-1'}
                    opacity-0 group-hover:opacity-100 transition-opacity
                `}>
                    <div className={`
                        flex items-center gap-0.5 rounded-lg p-0.5
                        ${isOwn ? 'bg-indigo-800' : 'bg-gray-100'}
                    `}>
                        {onReply && (
                            <button
                                onClick={() => onReply(message)}
                                className={`
                                    p-1.5 rounded-md transition-colors
                                    ${isOwn
                                        ? 'hover:bg-indigo-700 text-white/70 hover:text-white'
                                        : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                                    }
                                `}
                                title="رد"
                            >
                                <Reply className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
