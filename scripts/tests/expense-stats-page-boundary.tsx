import type { ReactNode } from 'react';

export const pageBoundary = {
  auth: {
    user: { id: 'stats-user', role_id: 'reader', is_active: true, role: { name: 'manager', permissions: { expenses: { read: true } } } },
    session: { user: { id: 'stats-user' }, access_token: 'token-1' },
  } as { user: any; session: any },
  stats: { stats: null as { totalAmount: number; totalCount: number; pendingCount: number; approvedCount: number; rejectedCount: number } | null, loading: false, error: null as string | null, refresh: async () => {} },
};
export const useFilteredExpenseStats = () => pageBoundary.stats;
export const useExpenses = () => ({
  data: [{ id: 'synthetic-expense', description: 'existing expense row', amount: 987654, status: 'approved', created_at: '2026-10-31T10:00:00Z' }],
  loading: false, error: null, refresh: async () => {}, loadMore: async () => {}, hasMore: false,
  pagination: { total: 999, page: 1, total_pages: 1 },
});
export const useSystemHealth = () => ({ health: null });
export const useAuth = () => pageBoundary.auth;
export const usePermissions = () => ({ canApproveExpense: () => true });
export const AdminGuard = ({ children }: { children: ReactNode }) => children;
