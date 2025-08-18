// Survey utilities: building URLs, messages, tokens, and WhatsApp helpers
// ---------------------------------------------------------------

import toast from 'react-hot-toast'
// Get app origin from env if available, otherwise window origin
export const getAppOrigin = (): string => {
  // Vite-style env (may not exist, fallback safely)
  const envOrigin = (import.meta as any)?.env?.VITE_PUBLIC_APP_URL || (import.meta as any)?.env?.PUBLIC_URL
  let origin = ''
  if (envOrigin && typeof envOrigin === 'string' && envOrigin.trim()) {
    origin = envOrigin.trim().replace(/\/$/, '')
  } else if (typeof window !== 'undefined' && window.location?.origin) {
    origin = window.location.origin
  }
  // Ensure scheme exists
  if (origin && !/^https?:\/\//i.test(origin)) {
    origin = `https://${origin}`
  }
  // Warn if local origin is used (will produce non-clickable WA links for customers)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(origin)) {
    try { toast.error('تحذير: يتم استخدام رابط محلي في رابط الاستبيان. فضلاً اضبط VITE_PUBLIC_APP_URL بعنوان موقعك العام') } catch {}
  }
  return origin
}

// Build public survey URL from token
export const buildSurveyUrl = (token: string): string => {
  const origin = getAppOrigin()
  return `${origin}/survey/${token}`
}

// Generate a URL-safe random token
export const generateSurveyToken = (length = 32): string => {
  try {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length)
  } catch {
    // Fallback to Math.random
    return Array.from({ length })
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('')
  }
}

// WhatsApp phone formatter (default country EG: 20)
export const formatPhoneForWhatsApp = (raw: string, defaultCountryCode = '20'): string => {
  let phone = (raw || '').replace(/[^0-9]/g, '')
  if (!phone) return ''
  if (phone.startsWith('00')) phone = phone.slice(2)
  if (phone.startsWith('0')) phone = phone.slice(1)
  if (!phone.startsWith(defaultCountryCode)) phone = defaultCountryCode + phone
  return phone
}

// Build WhatsApp message for survey
export const buildWhatsAppSurveyMessage = (params: {
  orderNumber?: string
  customerName?: string
  url: string
}): string => {
  const { orderNumber, customerName, url } = params
  
  // Greeting with Egyptian dialect
  const greeting = customerName 
    ? `أهلاً وسهلاً ${customerName} 🌹`
    : 'أهلاً وسهلاً حضرتك 🌹'
  
  // Order reference if available
  const orderLine = orderNumber 
    ? `\n\n🏠 بخصوص الخدمة رقم: *${orderNumber}*`
    : ''
  
  // Main message body
  const mainMessage = `\n\nإحنا في HOME CARE بنحرص دايماً على تقديم أفضل خدمة ليكم 💙\n\nعشان نقدر نطور من خدماتنا أكتر، نتمنى تشاركونا رأيكم الصريح في الخدمة اللي قدمناها لحضرتك`
  
  // Call to action
  const callToAction = `\n\n⭐ تقدر تقيم الخدمة من هنا (هياخد دقيقتين بس):`
  
  // Survey link (URL on its own line to ensure clickability in WhatsApp)
  const link = `\n${url}\n`
  
  // Closing message
  const closing = `\n🙏 رأيك مهم جداً بالنسبة لنا ويساعدنا نكون أحسن\n\nشكراً لثقتكم فينا وإختياركم لخدماتنا 💚\n\n*HOME CARE TEAM*`
  
  return `${greeting}${orderLine}${mainMessage}${callToAction}${link}${closing}`
}

// Open WhatsApp chat for given number with prefilled message
export const openWhatsAppTo = (rawNumber: string, message: string) => {
  const waNumber = formatPhoneForWhatsApp(rawNumber)
  if (!waNumber) return
  const encoded = encodeURIComponent(message || '')
  const apiUrl = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encoded}`
  const waMeUrl = `https://wa.me/${waNumber}?text=${encoded}`
  if (typeof window !== 'undefined') {
    // Try to copy message to clipboard to help if prefill fails
    const copyWithFallback = () => {
      try {
        const nav: any = navigator
        if (nav?.clipboard?.writeText) {
          nav.clipboard.writeText(message).then(() => {
            try { toast.success('تم نسخ الرسالة، الصقها إذا لم تظهر تلقائيًا') } catch {}
          }).catch(() => {
            // Fallback using a temporary textarea
            const ta = document.createElement('textarea')
            ta.value = message
            ta.style.position = 'fixed'
            ta.style.opacity = '0'
            document.body.appendChild(ta)
            ta.focus()
            ta.select()
            try { document.execCommand('copy') } catch {}
            document.body.removeChild(ta)
            try { toast.success('تم نسخ الرسالة، الصقها إذا لم تظهر تلقائيًا') } catch {}
          })
        } else {
          const ta = document.createElement('textarea')
          ta.value = message
          ta.style.position = 'fixed'
          ta.style.opacity = '0'
          document.body.appendChild(ta)
          ta.focus()
          ta.select()
          try { document.execCommand('copy') } catch {}
          document.body.removeChild(ta)
          try { toast.success('تم نسخ الرسالة، الصقها إذا لم تظهر تلقائيًا') } catch {}
        }
      } catch {}
    }
    // Copy first while within the user gesture, then open WhatsApp
    copyWithFallback()
    // Use api.whatsapp.com (more reliable for Desktop), fallback to wa.me if blocked
    const win = window.open(apiUrl, '_blank')
    if (!win) window.open(waMeUrl, '_blank')
  }
}
