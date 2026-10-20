import { supabase, handleSupabaseError } from '../lib/supabase';

type CountRpc = 'get_order_counts' | 'get_route_counts' | 'get_customer_counts' | 'get_expense_counts';

export async function exactCounts<T extends object>(
  rpc: CountRpc,
  fields: readonly (keyof T)[],
  legacyCounts: () => Promise<T>
): Promise<T> {
  const { data, error } = await supabase.rpc(rpc);
  // Old database/new browser compatibility only. Never hide permission, timeout or network errors.
  if (error?.code === 'PGRST202') return legacyCounts();
  if (error) throw new Error(handleSupabaseError(error));
  if (!data || fields.some(field => !Number.isSafeInteger(data[field as string]) || data[field as string] < 0)) {
    throw new Error('تعذر التحقق من إحصائيات البيانات');
  }
  return data as T;
}
