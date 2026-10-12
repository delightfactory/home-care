import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import ExtendRouteModal from '../../../src/components/Forms/ExtendRouteModal'
import { qa } from './api'
import '../../../src/index.css'
function Preview() {
  const [open, setOpen] = useState(true)
  const [refreshes, setRefreshes] = useState(0)
  const [releaseCount, setReleaseCount] = useState(0)
  const route = { id: 'b5000000-0000-0000-0000-000000000001', name: 'خط سير الاختبار', date: '2026-10-12' } as any
  return <><Toaster /><div className="p-3"><button onClick={() => setOpen(true)}>فتح النموذج</button><output data-testid="refreshes">{refreshes}</output></div>
    {open && <ExtendRouteModal route={route} onClose={() => setOpen(false)} onSuccess={() => setRefreshes(value => value + 1)} />}
    <div className="fixed bottom-0 left-0 z-[60] bg-gray-200 p-1 text-xs"><select aria-label="نتيجة الاختبار" onChange={event => qa.setMode(event.target.value)}><option value="failure">فشل</option><option value="replay">تأكيد إعادة المحاولة</option><option value="success">نجاح</option></select><button onClick={() => { qa.release(); setReleaseCount(value => value + 1) }}>إنهاء القراءة المؤجلة</button><output data-testid="submits">{qa.submits}</output><span>{releaseCount}</span></div>
  </>
}
createRoot(document.getElementById('root')!).render(<Preview />)
