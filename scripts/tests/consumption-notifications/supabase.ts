// Synthetic in-memory Supabase boundary for the notifications consumption tests.
// Every REST/RPC response is computed when the request is made (like a server snapshot)
// and held until the test releases it, so races between reads, mutations and Realtime
// events can be ordered explicitly. No network access.
type Row = { id: string; user_id: string; title: string; message: string; is_read: boolean; read_at?: string; created_at: string; expires_at?: string; category: string; priority: string; type: string }
type Pending = { kind: string; settle: (fail: boolean) => void }
type Channel = { topic: string; removed: boolean; handlers: Array<{ event: string; filter: string; cb: (payload: unknown) => void }>; status?: (s: string) => void }

export const server = {
    authUserId: null as string | null,
    rows: [] as Row[],
    pending: [] as Pending[],
    requests: [] as string[],
    channels: [] as Channel[],
}

let seq = 0
export function makeRow(userId: string, overrides: Partial<Row> = {}): Row {
    seq++
    return { id: `n-${seq}`, user_id: userId, title: `عنوان ${seq}`, message: 'رسالة', is_read: false,
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(), category: 'orders', priority: 'normal', type: 'order_created', ...overrides }
}

export function resetServer() {
    server.authUserId = null; server.rows = []; server.pending = []; server.requests = []; server.channels = []
}

const networkError = { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }
export function hold<T>(kind: string, compute: () => T, apply?: () => void): Promise<{ data: T | null; error: typeof networkError | null }> {
    server.requests.push(kind)
    const value = compute()
    return new Promise(resolve => {
        server.pending.push({ kind, settle: fail => {
            if (fail) return resolve({ data: null, error: networkError })
            apply?.()
            resolve({ data: value, error: null })
        } })
    })
}

/** Release (or fail) held requests, optionally only those of a given kind. */
export function release(kind?: string, fail = false) {
    const matched = server.pending.filter(p => !kind || p.kind === kind)
    server.pending = server.pending.filter(p => !matched.includes(p))
    matched.forEach(p => p.settle(fail))
    return matched.length
}

const visible = (userId: string | null) => server.rows.filter(r => r.user_id === userId)
const unreadCount = (userId: string) => visible(userId).filter(r => !r.is_read && (!r.expires_at || Date.parse(r.expires_at) > Date.now())).length

/** Server-side change + Realtime delivery to channels whose filter matches. */
export function emit(event: 'INSERT' | 'UPDATE' | 'DELETE', row: Row) {
    if (event === 'INSERT' && !server.rows.some(r => r.id === row.id)) server.rows.push(row)
    if (event === 'UPDATE') server.rows = server.rows.map(r => r.id === row.id ? row : r)
    if (event === 'DELETE') server.rows = server.rows.filter(r => r.id !== row.id)
    for (const channel of server.channels.filter(c => !c.removed)) {
        for (const h of channel.handlers) {
            if (h.event === event && h.filter === `user_id=eq.${row.user_id}`) {
                h.cb(event === 'DELETE' ? { old: { id: row.id } } : { new: { ...row } })
            }
        }
    }
}

export function channelStatus(status: string) {
    server.channels.filter(c => !c.removed).forEach(c => c.status?.(status))
}

export const supabase = {
    auth: {
        getUser: async () => ({ data: { user: server.authUserId ? { id: server.authUserId } : null }, error: null }),
    },
    from(table: string) {
        if (table !== 'notifications') throw new Error(`unexpected table ${table}`)
        const filters: Array<[string, unknown]> = []
        const builder: any = {
            select: () => builder,
            order: () => builder,
            eq: (column: string, value: unknown) => { filters.push([column, value]); return builder },
            range: (from: number, to: number) => {
                const viewer = server.authUserId
                return hold('list', () => visible(viewer)
                    .filter(r => filters.every(([c, v]) => (r as any)[c] === v))
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .slice(from, to + 1).map(r => ({ ...r })))
            },
            delete: () => {
                const del: any = { eq: (_c: string, id: string) => {
                    const viewer = server.authUserId
                    return hold('delete', () => null, () => { server.rows = server.rows.filter(r => !(r.id === id && r.user_id === viewer)) })
                } }
                return del
            },
        }
        return builder
    },
    rpc(name: string, args: Record<string, string> = {}) {
        const viewer = server.authUserId
        if (name === 'get_unread_notifications_count') return hold('count', () => unreadCount(args.p_user_id))
        if (name === 'mark_notification_read') return hold('markRead', () => true, () => {
            server.rows = server.rows.map(r => r.id === args.p_notification_id && r.user_id === viewer ? { ...r, is_read: true } : r)
        })
        if (name === 'mark_all_notifications_read') return hold('markAll', () => 0, () => {
            server.rows = server.rows.map(r => r.user_id === viewer ? { ...r, is_read: true } : r)
        })
        throw new Error(`unexpected rpc ${name}`)
    },
    channel(topic: string) {
        const record: Channel = { topic, removed: false, handlers: [] }
        server.channels.push(record)
        const api: any = {
            on: (_type: string, opts: { event: string; filter: string }, cb: (p: unknown) => void) => { record.handlers.push({ event: opts.event, filter: opts.filter, cb }); return api },
            subscribe: (status?: (s: string) => void) => { record.status = status; return api },
            __record: record,
        }
        return api
    },
    removeChannel: async (channel: { __record: Channel }) => { channel.__record.removed = true; return 'ok' },
}

export const handleSupabaseError = (error: { message?: string }) => error?.message ?? 'error'

