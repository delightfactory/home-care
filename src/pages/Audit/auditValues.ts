// Value meanings are scoped to the field and source; identical codes can mean different things.
const common: Record<string, Record<string, string>> = {
  reason: { continuing_work: 'استمرار الفريق في العمل بنفس اليوم' },
  payment_method: { cash: 'نقدي', card: 'بطاقة', instapay: 'إنستاباي', bank_transfer: 'تحويل بنكي' },
  payment_status: { unpaid: 'غير مدفوع', paid: 'مدفوع', paid_cash: 'مدفوع نقدًا', paid_card: 'مدفوع ببطاقة', partial: 'مدفوع جزئيًا', partially_paid: 'مدفوع جزئيًا', pending: 'بانتظار الدفع' },
  confirmation_status: { pending: 'بانتظار التأكيد', confirmed: 'مؤكد', declined: 'تم رفض التأكيد' },
  transport_method: { company_car: 'سيارة الشركة', taxi: 'تاكسي', uber: 'أوبر', public_transport: 'مواصلات عامة' },
  check_in_method: { manual_gps: 'تسجيل بالموقع', manual_admin: 'تسجيل بواسطة الإدارة' },
  check_out_method: { manual_gps: 'تسجيل بالموقع', manual_admin: 'تسجيل بواسطة الإدارة', auto_route_complete: 'تلقائي بعد إكمال خط السير' },
  holder_type: { team_leader: 'قائد فريق', supervisor: 'مشرف' },
  advance_type: { immediate: 'سلفة فورية', installment: 'سلفة على أقساط' },
  reference_type: { invoice: 'فاتورة', expense: 'مصروف', payroll: 'فترة رواتب', salary_advance: 'سلفة', manual: 'حركة يدوية', settlement: 'تسوية', custody_settlement: 'تسوية عهدة' },
  unit: { piece: 'قطعة', room: 'غرفة', meter: 'متر', square_meter: 'متر مربع', sqm: 'متر مربع', hour: 'ساعة', service: 'خدمة' },
  target_role: { manager: 'مدير', operations_supervisor: 'مشرف العمليات', receptionist: 'موظف الاستقبال', team_leader: 'قائد فريق', technician: 'فني' },
  key: { transport_rates: 'تكلفة المواصلات', working_hours: 'ساعات العمل', order_number_prefix: 'بادئة أرقام الطلبات', company_info: 'بيانات الشركة' },
}
const scoped: Record<string, Record<string, Record<string, string>>> = {
  orders: { status: { pending: 'معلق', scheduled: 'مجدول', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي' } },
  routes: { status: { pending: 'بانتظار تشغيل الخط', planned: 'مخطط', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي' } },
  order_status_logs: { status: { pending: 'معلق', scheduled: 'مجدول', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي' } },
  invoices: { status: { draft: 'مسودة', pending: 'بانتظار الدفع', paid: 'مدفوع', partially_paid: 'مدفوع جزئيًا', confirmed: 'مؤكد', cancelled: 'ملغي', refunded: 'تم رد المبلغ' } },
  attendance_records: { status: { present: 'حاضر', absent: 'غائب', late: 'متأخر', leave: 'إجازة', holiday: 'عطلة' } },
  payroll_periods: { status: { draft: 'مسودة', calculated: 'تم احتساب الرواتب', approved: 'معتمد', partially_paid: 'مصروف جزئيًا', paid: 'تم الصرف' } },
  advance_installments: { status: { pending: 'بانتظار الخصم', deducted: 'تم الخصم', skipped: 'تم تخطي القسط', cancelled: 'ملغي' } },
  salary_advances: { status: { pending: 'بانتظار الاعتماد', active: 'نشطة', completed: 'مكتملة', cancelled: 'ملغية' } },
  expenses: { status: { pending: 'بانتظار الاعتماد', approved: 'معتمد', rejected: 'مرفوض' } },
  workers: { status: { active: 'نشط', inactive: 'غير نشط', vacation: 'في إجازة', terminated: 'انتهى العمل', on_leave: 'في إجازة' } },
  call_logs: { status: { completed: 'مكالمة مكتملة', missed: 'مكالمة فائتة', rejected: 'مكالمة مرفوضة' } },
  voice_calls: { status: { ringing: 'يرن', connecting: 'جارٍ الاتصال', connected: 'متصل', ended: 'انتهت المكالمة', missed: 'مكالمة فائتة', rejected: 'مكالمة مرفوضة' } },
  vaults: { type: { main: 'خزينة رئيسية', branch: 'خزينة فرع', bank: 'حساب بنكي' } },
  vault_transactions: { type: { deposit: 'إيداع', withdrawal: 'سحب', transfer_in: 'تحويل وارد', transfer_out: 'تحويل صادر', refund: 'رد مبلغ', collection: 'تحصيل', expense: 'مصروف' } },
  custody_transactions: { type: { add: 'إضافة للعهدة', withdraw: 'سحب من العهدة', collection: 'تحصيل', settlement_out: 'تسوية صادرة', settlement_in: 'تسوية واردة', reset: 'تصفير العهدة', refund: 'رد مبلغ', expense: 'مصروف' } },
  hr_adjustments: { type: { deduction: 'خصم', penalty: 'جزاء', bonus: 'مكافأة' } },
  penalty_rules: { type: { late: 'تأخير', absent: 'غياب', early_leave: 'انصراف مبكر' } },
  conversations: { type: { direct: 'محادثة مباشرة', team: 'محادثة فريق', group: 'مجموعة', broadcast: 'إعلان' } },
  conversation_participants: { role: { admin: 'مدير المحادثة', moderator: 'مشرف المحادثة', member: 'عضو' } },
  order_workers: { role: { team_leader: 'قائد الفريق', leader: 'قائد الفريق', technician: 'فني', member: 'عضو الفريق', driver: 'سائق' } },
}
export function codedValue(table: string, field: string, value: string): string | undefined {
  const dictionary = scoped[table]?.[field] || common[field]
  if (!dictionary) return undefined
  // New/legacy values remain available verbatim under trace references; never invent their meaning.
  return dictionary[value] || 'قيمة غير معروفة؛ راجع مراجع التتبع'
}
export const technicalFields = new Set(['id', 'request', 'request_id', 'epoch', 'token'])
