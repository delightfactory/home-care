/**
 * formatters.ts — دوال تنسيق موحدة لتطبيق الفنى
 * جميع الأرقام تظهر بالإنجليزية (0-9) بدلاً من العربية (٠-٩)
 */

// تحويل الأرقام العربية/الفارسية إلى إنجليزية
export const toEnglishDigits = (str: string): string =>
  str.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

/** تنسيق رقم بأرقام إنجليزية مع فواصل آلاف */
export const formatNumber = (n: number | null | undefined): string => {
  if (n == null) return '0'
  return toEnglishDigits(n.toLocaleString('en-US'))
}

/** تنسيق عملة: "1,250 ج.م" */
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount == null) return '0 ج.م'
  const formatted = toEnglishDigits(Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }))
  return amount < 0 ? `-${formatted} ج.م` : `${formatted} ج.م`
}

/** تنسيق عملة بدون "ج.م" */
export const formatAmount = (amount: number | null | undefined): string => {
  if (amount == null) return '0'
  return toEnglishDigits(Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }))
}

/** تنسيق وقت من ISO string: "02:35 م" بأرقام إنجليزية */
export const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const date = new Date(iso)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const period = hours >= 12 ? 'م' : 'ص'
  const h = hours % 12 || 12
  return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`
}

/** تنسيق تاريخ: "16 فبراير 2026" بأرقام إنجليزية */
export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const date = new Date(iso)
  return `${date.getDate()} ${MONTHS_AR[date.getMonth()]} ${date.getFullYear()}`
}

/** تنسيق تاريخ مختصر: "16/02" بأرقام إنجليزية */
export const formatDateShort = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const date = new Date(iso)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** تنسيق تاريخ ووقت: "16 فبراير 2026 02:35 م" */
export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  return `${formatDate(iso)} ${formatTime(iso)}`
}

/** تنسيق اسم الشهر والسنة: "فبراير 2026" */
export const formatMonthYear = (month: number, year: number): string => {
  return `${MONTHS_AR[month - 1]} ${year}`
}

/** اسم الشهر فقط: "فبراير" */
export const getMonthName = (monthIndex: number): string => {
  return MONTHS_AR[monthIndex] || ''
}

/** اسم اليوم: "الاثنين" */
export const getWeekdayName = (date: Date): string => {
  return DAYS_AR[date.getDay()] || ''
}

/** تنسيق تاريخ مع اليوم: "الاثنين، 16 فبراير 2026" */
export const formatDateFull = (iso?: string): string => {
  const date = iso ? new Date(iso) : new Date()
  return `${DAYS_AR[date.getDay()]}، ${date.getDate()} ${MONTHS_AR[date.getMonth()]} ${date.getFullYear()}`
}

/** تنسيق نسبة مئوية */
export const formatPercent = (value: number | null | undefined): string => {
  if (value == null) return '0%'
  return `${Math.round(value)}%`
}

/** تنسيق حجم ملف: "1.5 MB" */
export const formatBytes = (bytes: number | null | undefined): string => {
  if (bytes == null || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * ضغط صورة قبل الرفع
 * يُقلّص الأبعاد لـ maxSize ويضغط الجودة
 */
export const compressImage = (file: File, maxSize = 1200, quality = 0.7): Promise<File> => {
  return new Promise((resolve, reject) => {
    // لو الصورة أصغر من 500KB — لا حاجة للضغط
    if (file.size < 500 * 1024) {
      resolve(file)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // تقليص الأبعاد
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width)
            width = maxSize
          } else {
            width = Math.round((width * maxSize) / height)
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file) // fallback
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file)
              return
            }
            const compressed = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            resolve(compressed)
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => resolve(file) // fallback
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('فشل قراءة الصورة'))
    reader.readAsDataURL(file)
  })
}
