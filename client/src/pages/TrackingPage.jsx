import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import { formatThaiDate } from '../utils/date';

const stages = [
  { status: 'pending', title: 'รอยืนยันการจอง', detail: 'รับคำขอจองแล้ว', icon: 'calendar' },
  { status: 'confirmed', title: 'รับรถเข้าคิวแล้ว', detail: 'รถเข้าคิวบริการ', icon: 'user' },
  { status: 'in_service', title: 'กำลังให้บริการ', detail: 'พนักงานกำลังดูแลรถ', icon: 'sparkle' },
  { status: 'completed', title: 'พร้อมรับรถแล้ว', detail: 'บริการเสร็จเรียบร้อย', icon: 'car' }
];
const statusIndex = { pending: 0, confirmed: 1, in_service: 2, completed: 3 };
const statusNames = { pending: 'รอยืนยันการจอง', confirmed: 'รับรถเข้าคิวแล้ว', in_service: 'กำลังให้บริการ', completed: 'พร้อมรับรถแล้ว', cancelled: 'ยกเลิกการจอง' };
const paymentNames = { unpaid: 'ยังไม่ชำระ', pending_review: 'รอตรวจสอบ', verified: 'ตรวจสอบแล้ว', rejected: 'ไม่ผ่านการตรวจสอบ' };

export default function TrackingPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [changedBooking, setChangedBooking] = useState(null);
  const [error, setError] = useState('');
  const previousStatuses = useRef(null);

  const load = useCallback(async (notify = false) => {
    try {
      const data = await api('/bookings/me');
      const next = data.bookings || [];
      if (notify && previousStatuses.current) {
        const changed = next.find((item) => previousStatuses.current.has(String(item.id)) && previousStatuses.current.get(String(item.id)) !== item.status);
        if (changed) setChangedBooking(changed);
      }
      previousStatuses.current = new Map(next.map((item) => [String(item.id), item.status]));
      setBookings(next);
      setSelectedId((current) => current && next.some((item) => String(item.id) === current) ? current : String(next[0]?.id || ''));
      setError('');
    } catch (err) { setError(err.message); }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    load();
    const timer = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(timer);
  }, [user, load]);

  const selected = useMemo(() => bookings.find((item) => String(item.id) === selectedId) || bookings[0], [bookings, selectedId]);
  if (!user) return <div className="mx-auto max-w-xl px-5 py-24 text-center"><h1 className="text-2xl font-bold">กรุณาเข้าสู่ระบบ</h1><p className="mt-2 text-slate-500">เข้าสู่ระบบเพื่อดูสถานะการจอง</p></div>;

  const currentStep = statusIndex[selected?.status] ?? -1;
  const isCancelled = selected?.status === 'cancelled';
  return <div className="mx-auto max-w-7xl px-5 py-10 md:py-14">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Booking tracker</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0b1f3a] md:text-5xl">ติดตามสถานะ</h1><p className="mt-2 text-sm text-slate-500">ตรวจสอบความคืบหน้าการดูแลรถของคุณแบบอัปเดตอัตโนมัติ</p></div>{bookings.length > 1 && <label className="text-xs font-semibold text-slate-500">เลือกรายการจอง<select value={selected ? String(selected.id) : ''} onChange={(event) => setSelectedId(event.target.value)} className="field mt-1 min-w-60 bg-white">{bookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.bookingCode} · {formatThaiDate(booking.bookingDate)}</option>)}</select></label>}</div>
    {error && <div className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {!selected ? <section className="surface rounded-2xl px-6 py-16 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-blue-600"><Icon name="calendar" size={24} /></div><h2 className="mt-4 text-lg font-bold text-[#0b1f3a]">ยังไม่มีรายการจอง</h2><p className="mt-2 text-sm text-slate-500">เมื่อจองคิวแล้ว คุณสามารถติดตามสถานะได้จากหน้านี้</p><Link to="/booking" className="primary-button mt-5 inline-flex">จองคิวล้างรถ</Link></section> : <>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.9fr)]">
        <div className="space-y-5">
          <section className="surface rounded-2xl border border-slate-200 p-4 md:p-6">
            <div className="mb-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-slate-100 pb-4 sm:gap-4"><div className="min-w-0"><span className="rounded bg-indigo-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">Order ID</span><h2 className="mt-2 break-all font-mono text-sm font-bold text-[#0b1f3a] sm:text-base md:text-lg">#{selected.bookingCode}</h2></div><div className="min-w-0 text-right"><span className="text-[11px] text-slate-500 sm:text-xs">เวลานัดหมาย</span><p className="mt-1 text-sm font-bold text-indigo-700">{selected.bookingTime}</p><p className="text-[10px] leading-4 text-slate-500 sm:text-xs">{formatThaiDate(selected.bookingDate, { withWeekday: true })}</p></div></div>
            {isCancelled ? <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">รายการจองนี้ถูกยกเลิกแล้ว หากต้องการจองใหม่ <Link to="/booking" className="font-semibold underline">เลือกวันและเวลาใหม่</Link></div> : <div className="relative grid grid-cols-4 gap-1 pt-2">
              <div className="absolute left-[12.5%] right-[12.5%] top-[26px] h-0.5 bg-slate-200" /><div className="absolute left-[12.5%] top-[26px] h-0.5 bg-indigo-600 transition-all" style={{ width: `${Math.max(0, currentStep) * 25}%` }} />
              {stages.map((stage, index) => {
                const done = index < currentStep || selected.status === 'completed';
                const active = index === currentStep;
                return <div key={stage.status} className="relative z-10 flex flex-col items-center text-center"><span className={`grid h-10 w-10 place-items-center rounded-xl border-2 ${done || active ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm' : 'border-slate-200 bg-slate-100 text-slate-400'}`}><Icon name={done ? 'check' : stage.icon} size={17} /></span><b className={`mt-3 text-[10px] leading-4 md:text-xs ${active ? 'text-indigo-700' : done ? 'text-slate-700' : 'text-slate-400'}`}>{stage.title}</b><span className="mt-1 hidden text-[10px] text-slate-400 sm:block">{stage.detail}</span></div>;
              })}
            </div>}
          </section>

          <section className="relative flex min-h-[250px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 p-6 md:min-h-[300px]">
            <div className="absolute -right-10 -top-14 h-52 w-52 rounded-full border-[24px] border-white/20" /><div className="absolute right-24 top-20 h-4 w-4 rounded-full bg-white/60" /><div className="absolute right-40 top-12 h-2 w-2 rounded-full bg-white/70" />
            <div className="relative flex items-start justify-between"><div><span className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Service update</span><h2 className="mt-3 text-lg font-bold text-slate-800">{statusNames[selected.status] || 'กำลังอัปเดตสถานะ'}</h2><p className="mt-1 text-xs text-slate-600">{selected.status === 'in_service' ? 'พนักงานกำลังดูแลรถของคุณ' : selected.status === 'completed' ? 'สามารถติดต่อร้านเพื่อรับรถได้แล้ว' : 'ระบบจะอัปเดตเมื่อมีความคืบหน้า'}</p></div><span className="rounded-xl bg-white/70 p-3 text-indigo-700"><Icon name="car" size={26} /></span></div>
            <div className="relative mt-10 rounded-xl border border-white/60 bg-white/50 p-4 backdrop-blur-sm"><div className="flex items-center justify-between text-xs"><b className="text-slate-700">{selected.carModel}</b><span className="font-mono text-slate-600">{selected.carPlate}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70"><div className={`h-full rounded-full bg-indigo-600 transition-all ${isCancelled ? 'w-0' : currentStep === 0 ? 'w-1/4' : currentStep === 1 ? 'w-1/2' : currentStep === 2 ? 'w-3/4' : 'w-full'}`} /></div></div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="surface rounded-2xl p-5"><h2 className="border-b border-slate-100 pb-3 text-sm font-bold text-[#0b1f3a]">ข้อมูลบริการ</h2><div className="space-y-4 py-4 text-xs">
            <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-indigo-700"><Icon name="car" size={17} /></span><div><p className="text-slate-500">รถของคุณ</p><b className="mt-1 block text-slate-800">{selected.carModel}</b><span className="text-slate-500">ทะเบียน {selected.carPlate}</span></div></div>
            <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Icon name="sparkle" size={17} /></span><div><p className="text-slate-500">บริการที่เลือก</p><b className="mt-1 block text-slate-800">{selected.service}</b></div></div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4"><div><p className="text-slate-500">ยอดชำระ</p><b className="mt-1 block text-sm text-slate-800">฿{Number(selected.totalPrice).toLocaleString()}</b></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600">{paymentNames[selected.paymentStatus] || selected.paymentStatus}</span></div>
          </div>{['unpaid', 'rejected'].includes(selected.paymentStatus) && <Link to={`/payment/${encodeURIComponent(selected.bookingCode)}`} className="primary-button mb-4 w-full justify-center !py-2.5 text-sm">{selected.paymentStatus === 'rejected' ? 'แก้ไขและชำระเงินอีกครั้ง' : 'ชำระเงินต่อ'}</Link>}{selected.paymentStatus === 'pending_review' && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-center text-xs text-amber-800">ส่งสลิปแล้ว · รอเจ้าหน้าที่ตรวจสอบ</p>}<Link to="/status" className="block border-t border-slate-100 pt-3 text-center text-xs font-semibold text-blue-600 hover:underline">ดูประวัติการจองทั้งหมด</Link></section>
          <section className="rounded-2xl bg-slate-100 p-5"><h2 className="text-xs font-bold text-slate-700">มีข้อสงสัยเกี่ยวกับบริการ?</h2><p className="mt-2 text-xs leading-5 text-slate-500">ติดต่อร้านได้ หากต้องการสอบถามหรือเปลี่ยนแปลงการจอง</p><Link to="/contact" className="secondary-button mt-4 w-full justify-center !py-2.5 text-xs">ติดต่อเรา</Link></section>
        </aside>
      </div>
      <p className="mt-4 text-center text-[11px] text-slate-400">ตรวจสอบสถานะอัตโนมัติทุก 15 วินาที · <Link to="/notifications" className="text-blue-600 hover:underline">ดูการแจ้งเตือน</Link></p>
    </>}
    {changedBooking && <div role="dialog" aria-modal="true" aria-labelledby="tracking-notice-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"><section className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-indigo-50 text-indigo-700"><Icon name="bell" size={22} /></span><h2 id="tracking-notice-title" className="mt-4 text-lg font-bold text-[#0b1f3a]">สถานะการจองอัปเดตแล้ว</h2><p className="mt-2 text-sm text-slate-600">รายการ <b>{changedBooking.bookingCode}</b>: {statusNames[changedBooking.status] || changedBooking.status}</p><button autoFocus onClick={() => setChangedBooking(null)} className="primary-button mt-5 w-full justify-center">รับทราบ</button></section></div>}
  </div>;
}
