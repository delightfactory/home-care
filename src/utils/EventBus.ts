// Simple global event bus using EventTarget (light-weight and performant)
// يوفر حافلة أحداث عالمية لتنسيق التحديثات بين الأجزاء المختلفة من التطبيق

class EventBus {
  private emitter: EventTarget
  private channel?: BroadcastChannel

  constructor () {
    this.emitter = new EventTarget()

    // Support cross-tab communication (if browser supports BroadcastChannel)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('global_event_bus')
      // Relay incoming messages to local listeners
      this.channel.onmessage = (e) => {
        const { event, detail } = e.data || {}
        if (typeof event === 'string') {
          this.emitter.dispatchEvent(new CustomEvent(event, { detail }))
        }
      }
    }
  }

  emit <T = any> (event: string, detail?: T) {
    // Emit to local listeners
    this.emitter.dispatchEvent(new CustomEvent(event, { detail }))
    // Broadcast to other tabs if supported
    if (this.channel) {
      this.channel.postMessage({ event, detail })
    }
  }

  on<T = any> (event: string, listener: (detail: T) => void) {
    const handler = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      listener((e as CustomEvent<any>).detail as T)
    }
    this.emitter.addEventListener(event, handler)
    return () => this.emitter.removeEventListener(event, handler)
  }
}

// Singleton instance – import { eventBus } from '@/utils/EventBus'
export const eventBus = new EventBus()

export type CacheClearedPayload = { pattern?: string }
