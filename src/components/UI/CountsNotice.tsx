interface CountsNoticeProps {
  error: string | null;
  onRetry: () => Promise<void>;
}

export function CountsNotice({ error, onRetry }: CountsNoticeProps) {
  if (!error) return null;
  return (
    <div role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p>تعذّر تحديث الأعداد. أعد المحاولة للحصول على أحدث البيانات.</p>
      <button type="button" onClick={() => { void onRetry(); }} className="mt-1 underline font-medium">إعادة المحاولة</button>
    </div>
  );
}
