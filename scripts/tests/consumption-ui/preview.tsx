import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { NotificationsProvider } from '../../../src/contexts/NotificationsContext';
import NotificationBell from '../../../src/components/Notifications/NotificationBell';
import { useResourceCounts } from '../../../src/hooks/useResourceCounts';
import { CacheManager } from '../../../src/utils/query-cache';
import { eventBus } from '../../../src/utils/EventBus';
import { OrdersAPI } from '../../../src/api/orders';
import { server, resetServer, makeRow, release, emit } from '../consumption-notifications/supabase';
import { setIdentity } from '../consumption-notifications/auth';
import '../../../src/index.css';

const countsQuery = () => CacheManager.load('enhanced:orders:counts', () => OrdersAPI.getCounts(), 60000);
function Counts({ label }: { label: string }) {
  const { counts, error, refresh } = useResourceCounts(countsQuery, 'orders', 60000);
  return <section className="rounded border p-3"><p>{label}: <strong>{counts?.total ?? 'غير متاح'}</strong></p>
    {error && <p role="alert">تعذّر تحديث العدد</p>}
    <button onClick={() => { void refresh(); }}>تحديث {label}</button></section>;
}

function Preview() {
  const [offline, setOffline] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [viewer, setViewer] = useState('u1');
  const [metrics, setMetrics] = useState('');
  useEffect(() => {
    const timer = setInterval(() => {
      release(undefined, offline);
      setMetrics(`القائمة: ${server.requests.filter(request => request === 'list').length}، عدد الإشعارات: ${server.requests.filter(request => request === 'count').length}، عد الطلبات: ${server.requests.filter(request => request === 'order-counts').length}، الاشتراكات: ${server.channels.filter(channel => !channel.removed).length}`);
    }, 50);
    return () => clearInterval(timer);
  }, [offline]);
  const switchUser = () => {
    const id = viewer === 'u1' ? 'u2' : 'u1';
    CacheManager.setScope(`synthetic-session-${id}`);
    server.authUserId = id;
    setIdentity(id);
    setViewer(id);
  };
  return <main className="max-w-3xl mx-auto p-6 space-y-4">
    <h1 className="text-xl font-bold">تأهيل استهلاك هوم كير — بيانات صناعية</h1>
    <p>المستخدم: {viewer} — جميع البيانات والطلبات هنا محلية وصناعية.</p>
    <div className="flex flex-wrap gap-3 [&>button]:border [&>button]:rounded [&>button]:p-2">
      <button onClick={switchUser}>تبديل الحساب</button>
      <button onClick={() => setOffline(!offline)}>{offline ? 'استعادة الاتصال' : 'تعطيل الاتصال'}</button>
      <button onClick={() => { window.dispatchEvent(new Event('online')); eventBus.emit('orders:changed'); }}>إعادة المحاولة بعد الاتصال</button>
      <button onClick={() => emit('INSERT', makeRow(viewer, { title: 'إشعار اختبار جديد' }))}>إشعار جديد</button>
      <button onClick={() => setMounted(!mounted)}>{mounted ? 'إخفاء المستهلكين' : 'إظهار المستهلكين'}</button>
    </div>
    <p role="status">{metrics}</p>
    {mounted && <NotificationsProvider><MemoryRouter><div className="relative flex justify-end h-12"><NotificationBell /></div>
      <div className="grid grid-cols-2 gap-3"><Counts label="عداد أول" /><Counts label="عداد ثان" /></div>
    </MemoryRouter></NotificationsProvider>}
  </main>;
}
resetServer();
server.rows.push(makeRow('u1', { title: 'طلب صناعي أول' }), makeRow('u1', { title: 'طلب صناعي ثان' }), makeRow('u2', { title: 'إشعار الحساب الثاني' }));
server.authUserId = 'u1';
CacheManager.setScope('synthetic-session-u1');
setIdentity('u1');
createRoot(document.getElementById('root')!).render(<Preview />);
