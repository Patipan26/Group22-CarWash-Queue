import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import { formatThaiDate, getBangkokToday, isSunday, toDateInputValue } from '../utils/date';

const labels = {
  pending: 'รอยืนยันการจอง',
  confirmed: 'รับรถเข้าคิวแล้ว',
  in_service: 'กำลังให้บริการ',
  completed: 'พร้อมรับรถแล้ว',
  cancelled: 'ยกเลิกการจอง'
};
const colors = {
  pending: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  in_service: 'bg-indigo-50 text-indigo-700',
  completed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-rose-50 text-rose-700'
};
const paymentLabels = { unpaid: 'ยังไม่ชำระ', pending_review: 'รอตรวจสอบ', verified: 'ชำระแล้ว', rejected: 'สลิปไม่ผ่าน' };

function isUpcoming(booking) {
  if (!booking || !['pending', 'confirmed'].includes(booking.status)) return false;
  const date = toDateInputValue(booking.bookingDate);
  const startTime = String(booking.bookingTime || '').split(' - ')[0];
  const start = new Date(`${date}T${startTime}:00+07:00`);
  return Number.isFinite(start.getTime()) && start.getTime() > Date.now();
}

export default function StatusPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState({ search: '', status: 'all', date: '' });
  const [selected, setSelected] = useState(null);
  const [statusNotice, setStatusNotice] = useState(null);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [working, setWorking] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const previousStatuses = useRef(null);

  async function load(notify = false) {
    try {
      const data = await api('/bookings/me');
      const next = data.bookings || [];
      if (notify && previousStatuses.current) {
        const changed = next.find((item) => previousStatuses.current.get(item.id) && previousStatuses.current.get(item.id) !== item.status);
        if (changed) setStatusNotice(changed);
      }
      previousStatuses.current = new Map(next.map((item) => [item.id, item.status]));
      setBookings(next);
      setError('');
    } catch (err) { setError(err.message); }
  }

  useEffect(() => {
    if (!user) return undefined;
    void load();
    const timer = window.setInterval(() => { void load(true); }, 15000);
    return () => window.clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (!selected || !rescheduleOpen || !rescheduleDate) return undefined;
    let active = true;
    setAvailabilityLoading(true);
    setAvailabilityError('');
    api(`/bookings/availability?date=${encodeURIComponent(rescheduleDate)}`)
      .then((data) => { if (active) setAvailableSlots(data.slots || []); })
      .catch((err) => { if (active) { setAvailableSlots([]); setAvailabilityError(err.message); } })
      .finally(() => { if (active) setAvailabilityLoading(false); });
    return () => { active = false; };
  }, [selected, rescheduleOpen, rescheduleDate]);

  const visible = useMemo(() => bookings.filter((item) =>
    (!filter.search || `${item.bookingCode} ${item.service}`.toLowerCase().includes(filter.search.toLowerCase()))
      && (filter.status === 'all' || item.status === filter.status)
      && (!filter.date || toDateInputValue(item.bookingDate) === filter.date)
  ), [bookings, filter]);

  function openDetails(booking) {
    setSelected(booking);
    setActionMessage('');
    setError('');
    setRescheduleOpen(false);
  }

  function startReschedule() {
    setRescheduleDate(toDateInputValue(selected.bookingDate));
    setRescheduleTime(selected.bookingTime);
    setAvailabilityError('');
    setActionMessage('');
    setRescheduleOpen(true);
  }

  async function cancelBooking() {
    const paid = selected.paymentStatus === 'verified';
    const prompt = paid
      ? 'ยืนยันยกเลิกการจองนี้หรือไม่? รายการชำระแล้ว โปรดติดต่อร้านเพื่อดำเนินการเรื่องเงินที่ชำระไว้'
      : 'ยืนยันยกเลิกการจองนี้หรือไม่?';
    if (!window.confirm(prompt)) return;
    setWorking(true);
    setError('');
    try {
      const result = await api(`/bookings/${encodeURIComponent(selected.bookingCode)}/cancel`, { method: 'PATCH' });
      setActionMessage(result.message);
      await load();
      setSelected(null);
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  }

  async function submitReschedule(event) {
    event.preventDefault();
    if (isSunday(rescheduleDate)) {
      setAvailabilityError('ร้านปิดทุกวันอาทิตย์ กรุณาเลือกวันจันทร์–เสาร์');
      return;
    }
    setWorking(true);
    setError('');
    try {
      const result = await api(`/bookings/${encodeURIComponent(selected.bookingCode)}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({ bookingDate: rescheduleDate, bookingTime: rescheduleTime })
      });
      setActionMessage(result.message);
      setRescheduleOpen(false);
      await load();
      setSelected(null);
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  }

  if (!user) return <div className="mx-auto max-w-xl px-4 py-24 text-center"><h1 className="text-2xl font-bold">กรุณาเข้าสู่ระบบ</h1><p className="mt-2 text-slate-500">เข้าสู่ระบบเพื่อดูประวัติการจองของคุณ</p></div>;

  const currentDate = selected ? toDateInputValue(selected.bookingDate) : '';
  const selectedSlotAvailable = availableSlots.some((slot) => slot.time === rescheduleTime && slot.available);
  const sameCurrentSlot = Boolean(selected && rescheduleDate === currentDate && rescheduleTime === selected.bookingTime);

  return <div className="mx-auto max-w-7xl px-5 py-12 md:py-16">
    <div className="mb-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div><p className="eyebrow">My bookings</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0b1f3a] md:text-5xl">ประวัติการจอง</h1><p className="mt-2 text-sm text-slate-500">ตรวจสอบสถานะการรับบริการของคุณ · อัปเดตอัตโนมัติทุก 15 วินาที</p></div>
      <button onClick={() => { void load(); }} className="secondary-button !px-3 !py-2 text-sm"><Icon name="clock" size={16} />รีเฟรช</button>
    </div>
    {error && !selected && <p role="alert" className="mb-4 text-rose-600">{error}</p>}
    {actionMessage && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{actionMessage}</p>}
    <div className="surface mb-6 grid gap-4 rounded-xl p-5 md:grid-cols-3">
      <input placeholder="ค้นหารหัสจองหรือบริการ" value={filter.search} onChange={(event) => setFilter({ ...filter, search: event.target.value })} className="field !mt-0" />
      <select value={filter.status} onChange={(event) => setFilter({ ...filter, status: event.target.value })} className="field !mt-0 bg-white"><option value="all">ทุกสถานะ</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <input type="date" value={filter.date} onChange={(event) => setFilter({ ...filter, date: event.target.value })} className="field !mt-0" />
    </div>
    <div className="space-y-3 md:hidden">
      {visible.length ? visible.map((item) => <article key={item.id} className="surface rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-slate-500">{formatThaiDate(item.bookingDate, { withWeekday: true })} · {item.bookingTime}</p><p className="mt-1 break-all font-mono text-xs text-slate-500">{item.bookingCode}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[item.status] || colors.pending}`}>{labels[item.status] || item.status}</span></div>
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#0b1f3a]">{item.service}</p><p className="mt-1 text-sm font-bold text-blue-600">฿{Number(item.totalPrice).toLocaleString()}</p></div><button onClick={() => openDetails(item)} className="secondary-button shrink-0 !px-3 !py-2 text-xs">ดูรายละเอียด</button></div>
      </article>) : <div className="surface rounded-xl p-8 text-center text-sm text-slate-400">ยังไม่มีรายการจอง</div>}
    </div>
    <div className="surface hidden overflow-x-auto rounded-xl md:block">
      <table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr><th className="p-4">วันที่ / เวลา</th><th className="p-4">รหัสการจอง</th><th className="p-4">บริการ</th><th className="p-4">สถานะ</th><th className="p-4">ราคา</th><th className="p-4">รายละเอียด</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{visible.length ? visible.map((item) => <tr key={item.id} className="hover:bg-slate-50">
          <td className="p-4">{formatThaiDate(item.bookingDate, { withWeekday: true })}<br /><span className="text-xs text-slate-400">{item.bookingTime}</span></td><td className="p-4 font-mono text-xs">{item.bookingCode}</td><td className="p-4 font-semibold">{item.service}</td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[item.status] || colors.pending}`}>{labels[item.status] || item.status}</span></td><td className="p-4 font-bold text-blue-600">฿{Number(item.totalPrice).toLocaleString()}</td><td className="p-4"><button onClick={() => openDetails(item)} className="font-semibold text-blue-600 hover:underline">ดูรายละเอียด</button></td>
        </tr>) : <tr><td colSpan="6" className="p-10 text-center text-slate-400">ยังไม่มีรายการจอง</td></tr>}</tbody>
      </table>
    </div>
    <p className="mt-3 text-xs text-slate-500">แสดง {visible.length} รายการ</p>

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="ปิดรายละเอียด" disabled={working} onClick={() => setSelected(null)} className="absolute inset-0 cursor-default bg-slate-900/50 disabled:cursor-wait" />
      <section role="dialog" aria-modal="true" aria-labelledby="booking-detail-title" className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex justify-between border-b border-slate-100 pb-3"><div><p className="eyebrow">Booking details</p><h2 id="booking-detail-title" className="mt-2 font-bold">รายละเอียดการจอง</h2></div><button type="button" aria-label="ปิดรายละเอียด" onClick={() => setSelected(null)}><Icon name="close" size={18} /></button></div>
        <div className="mt-4 space-y-3 text-sm"><p><b>รหัส:</b> {selected.bookingCode}</p><p><b>วันเวลา:</b> {formatThaiDate(selected.bookingDate, { withWeekday: true })} | {selected.bookingTime}</p><p><b>บริการ:</b> {selected.service}</p><p><b>บริการเสริม:</b> {selected.addons?.map((addon) => addon.name).join(', ') || 'ไม่มี'}</p><p><b>รถ:</b> {selected.carModel} / {selected.carPlate}</p><p><b>ติดต่อ:</b> {selected.customerName} / {selected.customerPhone}</p><p><b>สถานะ:</b> {labels[selected.status] || selected.status}</p><p><b>การชำระเงิน:</b> {paymentLabels[selected.paymentStatus] || selected.paymentStatus}</p></div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {isUpcoming(selected) && !rescheduleOpen && <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button disabled={working} onClick={startReschedule} className="secondary-button flex-1 justify-center !py-2.5 text-sm">เลื่อนวันและเวลา</button><button disabled={working} onClick={cancelBooking} className="flex-1 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60">{working ? 'กำลังบันทึก...' : 'ยกเลิกการจอง'}</button></div>}
        {isUpcoming(selected) && rescheduleOpen && <form onSubmit={submitReschedule} className="mt-5 space-y-3 border-t border-slate-100 pt-4">
          <h3 className="font-semibold text-slate-800">เลือกวันและเวลาใหม่</h3>
          <label className="block text-xs font-semibold text-slate-600">วันที่<input type="date" required min={getBangkokToday()} value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} className="field !mt-1.5" /></label>
          {isSunday(rescheduleDate) && <p className="text-xs text-rose-600">ร้านปิดทุกวันอาทิตย์</p>}
          <label className="block text-xs font-semibold text-slate-600">ช่วงเวลา<select required value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} className="field !mt-1.5 bg-white" disabled={availabilityLoading || Boolean(availabilityError)}><option value="">เลือกเวลา</option>{availableSlots.map((slot) => <option key={slot.time} value={slot.time} disabled={!slot.available && !(rescheduleDate === currentDate && slot.time === selected.bookingTime)}>{slot.time}{slot.available ? ` · ว่าง ${slot.remaining} คิว` : rescheduleDate === currentDate && slot.time === selected.bookingTime ? ' · เวลาปัจจุบัน' : ' · เต็ม'}</option>)}</select></label>
          {availabilityLoading && <p className="text-xs text-slate-500">กำลังตรวจสอบคิวว่าง...</p>}
          {availabilityError && <p role="alert" className="text-xs text-rose-600">{availabilityError}</p>}
          <p className="text-xs text-slate-500">เลื่อนได้เฉพาะรายการที่ยังไม่เริ่ม และช่วงเวลาที่มีคิวว่าง</p>
          <div className="flex gap-2"><button type="button" disabled={working} onClick={() => setRescheduleOpen(false)} className="secondary-button flex-1 justify-center !py-2.5 text-sm">กลับ</button><button type="submit" disabled={working || availabilityLoading || Boolean(availabilityError) || (!selectedSlotAvailable && !sameCurrentSlot)} className="primary-button flex-1 justify-center !py-2.5 text-sm disabled:opacity-50">{working ? 'กำลังบันทึก...' : 'ยืนยันเลื่อนคิว'}</button></div>
        </form>}
        {!isUpcoming(selected) && <p className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">รายการนี้เริ่มแล้วหรือสิ้นสุดแล้ว หากต้องการเปลี่ยนแปลงกรุณาติดต่อร้านค้า</p>}
        {!rescheduleOpen && <button onClick={() => setSelected(null)} className="secondary-button mt-4 w-full justify-center">ปิด</button>}
      </section>
    </div>}
    {statusNotice && <div role="dialog" aria-modal="true" aria-labelledby="status-notice-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"><div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-xl text-blue-600">●</span><h2 id="status-notice-title" className="mt-4 text-lg font-bold text-[#0b1f3a]">สถานะการจองมีการอัปเดต</h2><p className="mt-2 text-sm text-slate-600">รายการ <b>{statusNotice.bookingCode}</b> เปลี่ยนเป็น <b>{labels[statusNotice.status] || statusNotice.status}</b></p><button autoFocus onClick={() => setStatusNotice(null)} className="primary-button mt-5 w-full justify-center">รับทราบ</button></div></div>}
  </div>;
}
