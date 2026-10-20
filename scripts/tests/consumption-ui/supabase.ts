import { supabase as inboxBoundary, server, hold } from '../consumption-notifications/supabase';
export { handleSupabaseError } from '../consumption-notifications/supabase';
export const generateOrderNumber = () => { throw Error('Synthetic fixture does not create operational orders'); };
export const supabase = {
  ...inboxBoundary,
  rpc(name: string, args?: Record<string, string>) {
    if (name === 'get_order_counts') {
      const total = server.authUserId === 'u1' ? 13 : 2;
      return hold('order-counts', () => ({ total, pending: total - 1, scheduled: 1, in_progress: 0, completed: 0, cancelled: 0 }));
    }
    return inboxBoundary.rpc(name, args);
  },
};
