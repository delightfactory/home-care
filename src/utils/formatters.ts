// Utility formatting functions
// دوال مساعدة للتنسيقات العامة

// تحويل بايتات إلى تمثيل مقروء (KB, MB, GB)
export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
