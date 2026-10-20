import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { NotificationInbox, type NotificationInboxState } from '../utils/notification-state'
import type { AppNotification } from '../types'

export interface NotificationsContextType {
  notifications: AppNotification[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  refresh: () => Promise<void>
}

export const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

const NO_NOTIFICATIONS: AppNotification[] = []

// مصدر واحد للإشعارات لكل مستخدم مسجل؛ الجرس واللوحة يستهلكانه معاً
export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth()
  // لا نبدأ إلا عندما يتفق الملف الشخصي والجلسة على نفس المستخدم (أثناء تبديل الحساب قد يختلفان)
  const userId = user && session?.user?.id === user.id ? user.id : null
  const [inboxState, setInboxState] = useState<NotificationInboxState | null>(null)
  const inboxRef = useRef<NotificationInbox | null>(null)

  useEffect(() => {
    if (!userId) return
    const inbox = new NotificationInbox(userId, setInboxState)
    inboxRef.current = inbox
    inbox.start()
    return () => {
      inbox.dispose()
      if (inboxRef.current === inbox) inboxRef.current = null
      setInboxState(null)
    }
  }, [userId])

  // بيانات مستخدم آخر لا تُعرض أبداً، حتى قبل تنفيذ تنظيف التأثير
  const current = inboxState && inboxState.userId === userId ? inboxState : null

  const markAsRead = useCallback(async (id: string) => { await inboxRef.current?.markAsRead(id) }, [])
  const markAllAsRead = useCallback(async () => { await inboxRef.current?.markAllAsRead() }, [])
  const deleteNotification = useCallback(async (id: string) => { await inboxRef.current?.deleteNotification(id) }, [])
  const refresh = useCallback(async () => { await inboxRef.current?.reload() }, [])

  const value = useMemo<NotificationsContextType>(() => ({
    notifications: current?.notifications ?? NO_NOTIFICATIONS,
    unreadCount: current?.unreadCount ?? 0,
    isLoading: current ? current.isLoading : Boolean(userId),
    error: current?.error ?? null,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh
  }), [current, userId, markAsRead, markAllAsRead, deleteNotification, refresh])

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}
