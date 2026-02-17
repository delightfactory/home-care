/**
 * أدوات إخفاء أرقام الهاتف حسب الدور
 */

/** الأدوار التى يجب إخفاء هاتف العميل عنها */
const PHONE_HIDDEN_ROLES = ['operations_supervisor']

/** هل يجب إخفاء رقم الهاتف لهذا الدور؟ */
export const shouldHideCustomerPhone = (userRole?: string): boolean => {
    if (!userRole) return false
    return PHONE_HIDDEN_ROLES.includes(userRole)
}

/** إخفاء الرقم بنجوم مع إظهار آخر رقمين فقط */
export const maskPhone = (phone?: string | null): string => {
    if (!phone) return 'غير محدد'
    return '***** ' + phone.slice(-2)
}
