// -------------------------------------------------
// Global-singleton EventBus to avoid duplicate copies
// after Vite/Rollup code-splitting in production.
// -------------------------------------------------

class EventBus {
  private emitter: EventTarget
  private channel?: BroadcastChannel

  constructor () {
    this.emitter = new EventTarget()

    // Cross-tab communication via BroadcastChannel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('global_event_bus')
      this.channel.onmessage = (e) => {
        const { event, detail } = e.data || {}
        if (typeof event === 'string') {
          this.emitter.dispatchEvent(new CustomEvent(event, { detail }))
        }
      }
    }
  }

  emit<T = any> (event: string, detail?: T) {
    this.emitter.dispatchEvent(new CustomEvent(event, { detail }))
    this.channel?.postMessage({ event, detail })
  }

  on<T = any> (event: string, listener: (detail: T) => void) {
    const handler = (e: Event) => listener((e as CustomEvent).detail as T)
    this.emitter.addEventListener(event, handler)
    return () => this.emitter.removeEventListener(event, handler)
  }
}

// 🔑 Global singleton key
const GLOBAL_KEY = '__global_event_bus__' as const

// ⬇️ Create or reuse singleton instance
export const eventBus: EventBus =
  (window as any)[GLOBAL_KEY] ||
  ((window as any)[GLOBAL_KEY] = new EventBus())

export type CacheClearedPayload = { pattern?: string }
