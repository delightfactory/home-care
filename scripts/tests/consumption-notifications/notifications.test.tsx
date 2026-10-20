// Drives the real NotificationsProvider + useNotifications through React with a synthetic
// Supabase boundary (supabase.ts) and synthetic auth (auth.ts). Built and run by
// scripts/test-consumption-notifications.mjs.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { NotificationsProvider } from '../../../src/contexts/NotificationsContext'
import { useNotifications } from '../../../src/hooks/useNotifications'
import { server, resetServer, makeRow, release, emit, channelStatus } from './supabase'
import { setIdentity } from './auth'

type Snapshot = ReturnType<typeof useNotifications>
const seen: Record<string, Snapshot> = {}
const shownBrowserNotifications: string[] = []

// Minimal browser globals: window events, a container node and the Notification API.
const win = Object.assign(new EventTarget(), { HTMLIFrameElement: class {}, document: { activeElement: null } })
;(globalThis as any).window = win
;(globalThis as any).document = win.document
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
;(win as any).Notification = (globalThis as any).Notification = class {
    static permission = 'granted'
    constructor(_title: string, options: { tag: string }) { shownBrowserNotifications.push(options.tag) }
}
const container: any = { nodeType: 1, tagName: 'DIV', ownerDocument: { addEventListener() {}, removeEventListener() {} }, addEventListener() {}, removeEventListener() {} }

// Bell and panel consume the same hook, as NotificationBell.tsx does.
const Consumer: React.FC<{ name: string }> = ({ name }) => { seen[name] = useNotifications(); return null }

let root: Root | null = null
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)) })
const wait = (ms: number) => act(async () => { await new Promise(r => setTimeout(r, ms)) })
// Starts an action inside a short act scope and returns its bare promise, so a held
// authoritative read never keeps an act scope open (which would suppress renders).
async function start(action: () => Promise<void>) { let p!: Promise<void>; await act(async () => { p = action() }); return [p] as const }
const reads = () => server.requests.filter(k => k === 'list').length
const live = () => server.channels.filter(c => !c.removed)

async function mount() {
    root = createRoot(container)
    await act(async () => { root!.render(<NotificationsProvider><Consumer name="bell" /><Consumer name="panel" /></NotificationsProvider>) })
    await flush()
}
/** Complete one in-flight snapshot (list, then the count RPC it triggers). */
async function completeRead(fail = false) {
    await act(async () => { release('list', fail) })
    await flush()
    await act(async () => { release('count', fail) })
    await flush()
}
async function signIn(userId: string) {
    server.authUserId = userId
    await act(async () => { setIdentity(userId) })
    await flush()
}
async function ready(userId: string) {
    await signIn(userId)
    await completeRead()
    await act(async () => channelStatus('SUBSCRIBED'))
    await completeRead()
    server.requests = []
}

beforeEach(async () => {
    resetServer()
    shownBrowserNotifications.length = 0
    await act(async () => { setIdentity(null) })
    await mount()
})
afterEach(async () => {
    await act(async () => { root?.unmount() })
    root = null
    release()
    await flush()
})

test('bell and panel share one initial read and one Realtime subscription', async () => {
    server.rows.push(makeRow('u1'), makeRow('u1'), makeRow('u1', { is_read: true }))
    await signIn('u1')
    assert.equal(live().length, 1, 'one channel for both consumers')
    assert.equal(reads(), 1, 'one list read for both consumers')
    assert.equal(seen.bell.isLoading, true)
    // SUBSCRIBED during the first read: that read may predate the subscription, so it is discarded.
    await act(async () => channelStatus('SUBSCRIBED'))
    await completeRead()
    assert.equal(seen.bell.isLoading, true, 'pre-subscription snapshot not applied')
    assert.equal(reads(), 2, 'single trailing reconciliation')
    await completeRead()
    assert.equal(server.pending.length, 0)
    assert.equal(seen.bell.unreadCount, 2)
    assert.equal(seen.panel.unreadCount, 2)
    assert.equal(seen.panel.notifications.length, 3)
    assert.equal(seen.bell.notifications, seen.panel.notifications, 'same shared array')
    assert.equal(seen.bell.isLoading, false)
    assert.match(live()[0].handlers[0].filter, /^user_id=eq\.u1$/)
})

test('markAsRead racing its UPDATE event decrements once, either order', async () => {
    const [a, b] = [makeRow('u1'), makeRow('u1')]
    server.rows.push(a, b, makeRow('u1'))
    await ready('u1')
    assert.equal(seen.bell.unreadCount, 3)

    // Event first, then the API response.
    const [pending] = await start(() => seen.panel.markAsRead(a.id))
    await flush()
    await act(async () => { release('markRead') })
    await act(async () => emit('UPDATE', { ...a, is_read: true }))
    await pending
    assert.equal(seen.bell.unreadCount, 2)

    // Response first, then the event.
    const [second] = await start(() => seen.panel.markAsRead(b.id))
    await flush()
    await act(async () => { release('markRead') })
    await second
    assert.equal(seen.bell.unreadCount, 1)
    await act(async () => emit('UPDATE', { ...server.rows.find(r => r.id === b.id)!, is_read: true }))
    assert.equal(seen.bell.unreadCount, 1, 'no double decrement')

    await wait(300)
    assert.equal(reads(), 1, 'events + mutations coalesced into one reconciliation')
    await completeRead()
    assert.equal(seen.panel.unreadCount, 1)
})

test('count reconciles from the server for events outside the first 50 entries', async () => {
    for (let i = 0; i < 60; i++) server.rows.push(makeRow('u1'))
    await ready('u1')
    assert.equal(seen.bell.notifications.length, 50)
    assert.equal(seen.bell.unreadCount, 60)
    const oldest = server.rows[0]
    await act(async () => emit('UPDATE', { ...oldest, is_read: true }))
    assert.equal(seen.bell.unreadCount, 60, 'no local guess for an unseen row')
    await wait(300)
    await completeRead()
    assert.equal(seen.bell.unreadCount, 59)
})

test('Realtime bursts coalesce; duplicate INSERTs add one row and one browser notification', async () => {
    await ready('u1')
    const rows = Array.from({ length: 20 }, () => makeRow('u1'))
    await act(async () => { rows.forEach(r => emit('INSERT', r)); emit('INSERT', rows[0]) })
    // Redelivery of an INSERT (e.g. duplicate delivery) must not double count or re-notify.
    await act(async () => { for (const handler of live()[0].handlers.filter(h => h.event === 'INSERT')) handler.cb({ new: { ...rows[3] } }) })
    assert.equal(seen.bell.unreadCount, 20)
    assert.equal(new Set(seen.bell.notifications.map(n => n.id)).size, seen.bell.notifications.length)
    assert.deepEqual(shownBrowserNotifications, rows.map(r => r.id))
    await wait(300)
    assert.equal(reads(), 1, 'one read for the burst')
    await completeRead()
    assert.equal(seen.bell.unreadCount, 20)
    assert.equal(reads(), 1)
})

test('expired or foreign INSERTs do not notify or count', async () => {
    await ready('u1')
    const expired = makeRow('u1', { expires_at: '2020-01-01T00:00:00.000Z' })
    await act(async () => emit('INSERT', expired))
    await act(async () => { for (const h of live()[0].handlers.filter(h => h.event === 'INSERT')) h.cb({ new: makeRow('u2') }) })
    assert.equal(seen.bell.unreadCount, 0)
    assert.deepEqual(shownBrowserNotifications, [])
    assert.deepEqual(seen.bell.notifications.map(n => n.id), [expired.id], 'expired row still listed as before')
})

test('network failure is an error, never a successful zero, and online reconciles', async () => {
    server.rows.push(makeRow('u1'), makeRow('u1'))
    await signIn('u1')
    await completeRead(true)
    assert.equal(seen.bell.error, 'حدث خطأ أثناء جلب الإشعارات')
    assert.equal(seen.bell.isLoading, false)

    await act(async () => { win.dispatchEvent(new Event('online')) })
    await completeRead()
    assert.equal(seen.bell.error, null)
    assert.equal(seen.bell.unreadCount, 2)

    // A later failing refresh keeps the last good data.
    const [refresh] = await start(() => seen.panel.refresh())
    await flush()
    await act(async () => { release('list', true) })
    await refresh
    assert.equal(seen.bell.unreadCount, 2)
    assert.equal(seen.bell.notifications.length, 2)
    assert.ok(seen.bell.error)

    // A failing count RPC alone is also not converted to zero.
    await act(async () => { win.dispatchEvent(new Event('online')) })
    await completeRead()
    await act(async () => { win.dispatchEvent(new Event('online')) })
    await act(async () => { release('list') }); await flush()
    await act(async () => { release('count', true) }); await flush()
    assert.equal(seen.bell.unreadCount, 2)
    assert.ok(seen.bell.error)
})

test('Realtime reconnect (SUBSCRIBED after CHANNEL_ERROR) reconciles missed changes', async () => {
    await ready('u1')
    await act(async () => channelStatus('CHANNEL_ERROR'))
    assert.equal(reads(), 0)
    server.rows.push(makeRow('u1'), makeRow('u1')) // missed while disconnected
    await act(async () => channelStatus('SUBSCRIBED'))
    await completeRead()
    assert.equal(seen.bell.unreadCount, 2)
    assert.equal(live().length, 1, 'no extra subscriptions')
})

test('mutation during a read discards that read and runs a trailing reconciliation', async () => {
    const victim = makeRow('u1')
    server.rows.push(victim, makeRow('u1'))
    await ready('u1')
    const [refresh] = await start(() => seen.panel.refresh())
    await flush() // list read in flight, still containing victim
    const [del] = await start(() => seen.panel.deleteNotification(victim.id))
    await flush()
    await act(async () => { release('delete') })
    await del
    assert.equal(seen.bell.notifications.some(n => n.id === victim.id), false)
    assert.equal(seen.bell.unreadCount, 1)
    await completeRead() // stale read (includes victim) completes: discarded
    assert.equal(seen.bell.notifications.some(n => n.id === victim.id), false, 'stale snapshot rejected')
    assert.equal(reads(), 2, 'trailing read issued')
    await completeRead()
    await refresh
    assert.equal(seen.bell.unreadCount, 1)
    assert.equal(seen.bell.notifications.length, 1)
})

test('account switch resets immediately and rejects stale reads and mutations', async () => {
    server.rows.push(makeRow('u1'), makeRow('u1'), makeRow('u2'))
    await ready('u1')
    const target = seen.bell.notifications[0].id
    const [mutation] = await start(() => seen.panel.markAsRead(target))
    const [refresh] = await start(() => seen.panel.refresh()) // u1 list read in flight
    await flush()

    // Profile still u1 while the session already moved to u2: show nothing, start nothing.
    server.authUserId = 'u2'
    await act(async () => { setIdentity('u1', 'u2') })
    assert.equal(seen.bell.notifications.length, 0)
    assert.equal(seen.bell.unreadCount, 0)
    assert.equal(live().length, 0, 'u1 channel removed')

    await act(async () => { setIdentity('u2') })
    await flush()
    assert.equal(seen.bell.isLoading, true)
    assert.equal(live().length, 1)
    assert.match(live()[0].handlers[0].filter, /u2$/)

    // Stale u1 responses arrive now.
    await act(async () => { release('markRead'); release('list') })
    await flush()
    await act(async () => { release('count') })
    await flush()
    await Promise.all([await mutation, await refresh])
    await completeRead()
    await act(async () => channelStatus('SUBSCRIBED'))
    await completeRead()
    assert.equal(seen.bell.unreadCount, 1)
    assert.deepEqual(seen.bell.notifications.map(n => n.user_id), ['u2'])

    // Events for u1 no longer reach anything.
    await act(async () => emit('INSERT', makeRow('u1')))
    assert.equal(seen.bell.notifications.length, 1)

    // Logout clears immediately and tears down the subscription.
    server.authUserId = null
    await act(async () => { setIdentity(null) })
    assert.deepEqual(seen.panel.notifications, [])
    assert.equal(seen.panel.isLoading, false)
    assert.equal(live().length, 0)
})

test('stale snapshot is rejected when the authenticated user changed mid-read', async () => {
    server.rows.push(makeRow('u1'))
    server.authUserId = 'u2' // auth already moved, profile/session state not yet updated
    await act(async () => { setIdentity('u1') })
    await completeRead()
    assert.equal(seen.bell.notifications.length, 0)
    assert.equal(seen.bell.error, null)
})

test('unmount removes the channel, online listener and pending reconcile timer', async () => {
    await ready('u1')
    await act(async () => emit('INSERT', makeRow('u1'))) // schedules a reconcile timer
    await act(async () => { root!.unmount() })
    root = null
    assert.equal(live().length, 0)
    await wait(300)
    await act(async () => { win.dispatchEvent(new Event('online')) })
    assert.equal(server.requests.length, 0, 'no reads after unmount')
})
