// Simple global event bus using EventTarget (light-weight and performant)
// يوفر حافلة أحداث عالمية لتنسيق التحديثات بين الأجزاء المختلفة من التطبيق

class EventBus {
  private emitter: EventTarget

  constructor () {
    this.emitter = new EventTarget()
  }

  emit <T = any> (event: string, detail?: T) {
    this.emitter.dispatchEvent(new CustomEvent(event, { detail }))
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
