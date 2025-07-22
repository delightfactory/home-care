# دليل تطبيق الويب التقدمي (PWA)

## نظام إدارة الرعاية المنزلية - PWA

هذا التطبيق تم تطويره ليكون تطبيق ويب تقدمي (Progressive Web App) يوفر تجربة مشابهة للتطبيقات الأصلية مع ميزات متقدمة.

## 🚀 الميزات الرئيسية

### ✅ الميزات المُنفذة

#### 1. **Service Worker**
- ✅ تخزين مؤقت ذكي للملفات الثابتة
- ✅ دعم العمل دون اتصال بالإنترنت
- ✅ تحديثات تلقائية في الخلفية
- ✅ مزامنة البيانات في الخلفية
- ✅ إدارة ذاكية للتخزين المؤقت

#### 2. **Web App Manifest**
- ✅ إعدادات التطبيق الكاملة
- ✅ أيقونات متعددة الأحجام
- ✅ اختصارات سريعة للأقسام الرئيسية
- ✅ لقطات شاشة للمتاجر
- ✅ دعم اللغة العربية والاتجاه RTL

#### 3. **التثبيت والتحديث**
- ✅ مطالبة تثبيت ذكية
- ✅ إشعارات التحديثات
- ✅ تحديث سلس دون انقطاع
- ✅ إدارة دورة حياة التطبيق

#### 4. **الإشعارات**
- ✅ إشعارات المتصفح
- ✅ إشعارات الدفع (Push Notifications)
- ✅ إدارة أذونات الإشعارات
- ✅ إشعارات مخصصة للأحداث

#### 5. **العمل دون اتصال**
- ✅ مؤشر حالة الاتصال
- ✅ صفحة دون اتصال مخصصة
- ✅ تخزين البيانات محلياً
- ✅ مزامنة عند العودة للاتصال

#### 6. **الأداء والتحسين**
- ✅ تقسيم الكود (Code Splitting)
- ✅ تحميل كسول للصفحات
- ✅ ضغط الملفات
- ✅ تحسين الصور
- ✅ تخزين مؤقت ذكي

#### 7. **الأمان**
- ✅ HTTPS (مطلوب للإنتاج)
- ✅ Content Security Policy
- ✅ حماية من XSS
- ✅ رؤوس أمان متقدمة

#### 8. **تجربة المستخدم**
- ✅ شاشة تحميل مخصصة
- ✅ انتقالات سلسة
- ✅ دعم اللمس والإيماءات
- ✅ تصميم متجاوب

## 📁 هيكل ملفات PWA

```
public/
├── manifest.json          # إعدادات التطبيق
├── sw.js                 # Service Worker
├── robots.txt            # إعدادات محركات البحث
├── sitemap.xml           # خريطة الموقع
├── .htaccess            # إعدادات الخادم
└── icons/               # أيقونات التطبيق
    ├── icon-192x192.png
    ├── icon-512x512.png
    ├── apple-touch-icon.png
    └── favicon-*.png

src/
├── components/PWA/       # مكونات PWA
│   ├── InstallPrompt.tsx
│   ├── OfflineIndicator.tsx
│   ├── UpdateNotification.tsx
│   └── index.ts
├── hooks/
│   └── usePWA.ts        # Hook لإدارة PWA
└── vite-env.d.ts        # تعريفات TypeScript
```

## ⚙️ الإعداد والتكوين

### 1. متغيرات البيئة

انسخ ملف `.env.example` إلى `.env` وقم بتعديل القيم:

```bash
cp .env.example .env
```

### 2. متغيرات PWA المهمة

```env
# معلومات التطبيق
VITE_APP_NAME="نظام إدارة الرعاية المنزلية"
VITE_APP_SHORT_NAME="الرعاية المنزلية"
VITE_APP_DESCRIPTION="نظام شامل لإدارة خدمات الرعاية المنزلية"

# الألوان والمظهر
VITE_APP_THEME_COLOR="#3b82f6"
VITE_APP_BACKGROUND_COLOR="#ffffff"

# الإشعارات
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key

# الميزات
VITE_ENABLE_PUSH_NOTIFICATIONS=true
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_INSTALL_PROMPT=true
```

### 3. إنتاج مفاتيح VAPID

```bash
npx web-push generate-vapid-keys
```

## 🛠️ التطوير

### تشغيل التطبيق

```bash
npm run dev
```

### بناء التطبيق

```bash
npm run build
```

### معاينة الإنتاج

```bash
npm run preview
```

## 📱 اختبار PWA

### 1. اختبار محلي

- افتح التطبيق في Chrome
- اذهب إلى Developer Tools > Application > Service Workers
- تحقق من تسجيل Service Worker
- اختبر العمل دون اتصال

### 2. اختبار التثبيت

- في Chrome: اضغط على أيقونة التثبيت في شريط العناوين
- في Edge: اذهب إلى القائمة > Apps > Install this site as an app

### 3. أدوات الاختبار

- **Lighthouse**: لتقييم جودة PWA
- **Chrome DevTools**: لمراقبة Service Worker
- **PWA Builder**: لاختبار الميزات

## 🚀 النشر

### 1. متطلبات الإنتاج

- ✅ HTTPS مطلوب
- ✅ Service Worker مُسجل
- ✅ Web App Manifest صحيح
- ✅ أيقونات بأحجام مختلفة

### 2. خطوات النشر

1. **بناء التطبيق**:
   ```bash
   npm run build
   ```

2. **رفع الملفات**: ارفع محتويات مجلد `dist`

3. **إعداد الخادم**: تأكد من إعدادات `.htaccess`

4. **اختبار PWA**: استخدم Lighthouse للتحقق

### 3. إعدادات الخادم

تأكد من:
- ✅ تفعيل HTTPS
- ✅ إعدادات CORS صحيحة
- ✅ ضغط الملفات
- ✅ تخزين مؤقت مناسب

## 📊 مراقبة الأداء

### 1. مقاييس PWA

- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **First Input Delay (FID)**: < 100ms
- **Cumulative Layout Shift (CLS)**: < 0.1

### 2. أدوات المراقبة

- Google Analytics
- Google Search Console
- Web Vitals
- Lighthouse CI

## 🔧 استكشاف الأخطاء

### مشاكل شائعة

#### 1. Service Worker لا يعمل
```javascript
// تحقق من التسجيل
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('SW Registrations:', registrations);
});
```

#### 2. التطبيق لا يظهر للتثبيت
- تحقق من HTTPS
- تحقق من manifest.json
- تحقق من Service Worker

#### 3. الإشعارات لا تعمل
- تحقق من أذونات المتصفح
- تحقق من مفاتيح VAPID
- تحقق من Service Worker

### سجلات التشخيص

```javascript
// في Console المتصفح
console.log('PWA Status:', {
  serviceWorker: 'serviceWorker' in navigator,
  notification: 'Notification' in window,
  pushManager: 'PushManager' in window
});
```

## 📚 موارد إضافية

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

## 🤝 المساهمة

لتحسين ميزات PWA:

1. Fork المشروع
2. إنشاء فرع للميزة الجديدة
3. تطوير واختبار الميزة
4. إرسال Pull Request

## 📄 الترخيص

هذا المشروع مرخص تحت رخصة MIT.

---

**ملاحظة**: هذا التطبيق يدعم جميع معايير PWA الحديثة ويوفر تجربة مستخدم متميزة على جميع الأجهزة والمنصات.