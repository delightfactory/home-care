import { useContext } from 'react';
import { NotificationsContext, type NotificationsContextType } from '../contexts/NotificationsContext';

type UseNotificationsReturn = NotificationsContextType;

// يقرأ من مصدر الإشعارات المشترك (NotificationsProvider) بدل إنشاء قراءة واشتراك لكل مستهلك
export function useNotifications(): UseNotificationsReturn {
    const context = useContext(NotificationsContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationsProvider');
    }
    return context;
}

export default useNotifications;
