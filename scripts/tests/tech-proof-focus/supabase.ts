export const calls = { uploads: 0, saves: 0 }
export const handlers: Array<{ table: string; callback: () => void }> = []
export const supabase = {
    from(table: string) {
        const builder: any = { select: () => builder, eq: () => builder,
            maybeSingle: async () => ({ data: { id: 'qa-invoice', total_amount: 1175, subtotal: 1175, items: [{ id: 'item', quantity: 1, unit_price: 1175, service: { name_ar: 'خدمة تجريبية' } }] } }),
            then: (resolve: any) => Promise.resolve({ data: table === 'route_orders' ? [{ order_id: 'qa-order' }] : [] }).then(resolve),
        }
        return builder
    },
    channel() {
        const channel = { on: (_event: string, filter: { table: string }, callback: () => void) => { handlers.push({ table: filter.table, callback }); return channel }, subscribe: () => channel }
        return channel
    },
    removeChannel: async () => {},
    storage: { from: () => ({ upload: async () => { calls.uploads++; return { error: null } }, getPublicUrl: () => ({ data: { publicUrl: 'https://example.invalid/synthetic-proof.png' } }) }) },
}
export const handleSupabaseError = (error: unknown) => String(error)
