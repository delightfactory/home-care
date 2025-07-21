// Simple clsx utility for conditional class names
export function clsx(...classes: (string | undefined | null | boolean | Record<string, boolean>)[]): string {
  const result: string[] = []
  
  for (const cls of classes) {
    if (!cls) continue
    
    if (typeof cls === 'string') {
      result.push(cls)
    } else if (typeof cls === 'object') {
      for (const [key, value] of Object.entries(cls)) {
        if (value) {
          result.push(key)
        }
      }
    }
  }
  
  return result.join(' ')
}

export default clsx
