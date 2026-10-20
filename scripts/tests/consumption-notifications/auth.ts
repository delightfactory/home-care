// Synthetic AuthContext replacement: tests drive the profile user and session directly.
import { useSyncExternalStore } from 'react'

type Identity = { user: { id: string } | null; session: { user: { id: string } } | null }
let identity: Identity = { user: null, session: null }
const listeners = new Set<() => void>()

export function setIdentity(profileId: string | null, sessionId: string | null = profileId) {
    identity = { user: profileId ? { id: profileId } : null, session: sessionId ? { user: { id: sessionId } } : null }
    listeners.forEach(l => l())
}

export function useAuth() {
    return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => identity)
}
