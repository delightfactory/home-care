// Local synthetic UI only. All API reads/writes are in-memory; no Supabase connection.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import '../../../src/index.css'
import TechDashboard from '../../../src/pages/Tech/TechDashboard'
import { TechnicianAPI } from '../../../src/api/technician'
import { AttendanceAPI } from '../../../src/api/hr'
import { InvoicesAPI } from '../../../src/api/invoices'
import { calls, handlers } from './supabase'
let routeId = 'qa-route', orderId = 'qa-order', leader = true, fail = false
let pending: Array<() => void> = []
TechnicianAPI.getTechnicianStatus = async () => {
    const snapshot = { workerId: 'qa-worker', workerName: 'عامل تجريبي', teamId: 'qa-team', teamName: 'فريق تجريبي', isTeamMember: true, isLeader: leader, hasLeader: true, leaderName: 'عامل تجريبي', teamMembers: [] }
    await new Promise<void>(resolve => pending.push(resolve))
    if (fail) throw new Error('synthetic-read-failure')
    return snapshot
}
TechnicianAPI.getMyTodayRoute = async () => ({ id: routeId, name: 'خط تجريبي', route_orders: [{ order_id: orderId }] } as any)
TechnicianAPI.getCurrentOrder = async () => ({ id: orderId, order_number: orderId, status: 'completed', team_id: 'qa-team', payment_status: 'unpaid', total_amount: 1175, items: [{ id: 'item', quantity: 1, unit_price: 1175, service: { name_ar: 'خدمة تجريبية' } }] } as any)
TechnicianAPI.getTodayProgress = async () => ({ completed: 1, total: 2, percentage: 50 })
AttendanceAPI.getTodayAttendance = async () => ({ check_in_time: new Date().toISOString(), check_out_time: null } as any)
InvoicesAPI.updateInvoice = async () => { calls.saves++; return { success: true, data: {} as any } }
function Controls() {
    const [result, setResult] = React.useState('')
    const release = (reverse = false) => { const reads = pending; pending = []; (reverse ? reads.reverse() : reads).forEach(fn => fn()); setResult(`uploads=${calls.uploads};saves=${calls.saves}`) }
    return <aside className="relative z-[100] bg-white p-3 border" dir="rtl">
        <button onClick={() => release()}>إكمال القراءة</button> ·
        <button onClick={() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')) }}>عودة من المعرض</button> ·
        <button onClick={() => { routeId = 'other-route'; handlers.find(h => h.table === 'routes')?.callback() }}>تبديل الخط</button> ·
        <button onClick={() => { orderId = 'other-order'; window.dispatchEvent(new Event('focus')) }}>تبديل الطلب</button> ·
        <button onClick={() => { leader = false; window.dispatchEvent(new Event('focus')) }}>سحب القيادة</button> ·
        <button onClick={() => { fail = true; window.dispatchEvent(new Event('focus')) }}>فشل التحديث</button> ·
        <button onClick={() => { fail = false; release() }}>استعادة القراءة</button> ·
        <button onClick={() => release(true)}>إكمال القراءات بالعكس</button> ·
        <button onClick={() => setResult(`uploads=${calls.uploads};saves=${calls.saves}`)}>عداد الإرسال</button>
        <output>{result}</output>
    </aside>
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><Controls /><TechDashboard /><Toaster /></MemoryRouter>)
