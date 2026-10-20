export const boundary = {
  rpcError: null as { code: string; message: string } | null,
  rpcData: { total: 7, pending: 1, scheduled: 1, in_progress: 1, completed: 1, cancelled: 1 } as unknown,
  reads: [] as string[],
  statuses: ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled', null, 'legacy'],
};

export const supabase = {
  rpc: async (name: string) => {
    boundary.reads.push(name);
    return { data: boundary.rpcData, error: boundary.rpcError };
  },
  from: (table: string) => {
    boundary.reads.push(table);
    let status: string | undefined;
    const query: any = {
      select: () => query,
      eq: (_column: string, selected: string) => { status = selected; return query; },
      then: (resolve: (response: unknown) => unknown) => Promise.resolve({
        count: boundary.statuses.filter(candidate => status === undefined || candidate === status).length,
        error: null,
      }).then(resolve),
    };
    return query;
  },
};
export const handleSupabaseError = (failure: { message: string }) => failure.message;
export const generateOrderNumber = () => { throw Error('not part of count tests'); };
