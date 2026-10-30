import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { formatThaiDate, getBangkokToday, isSunday } from '../utils/date';
import { Icon } from '../components/Icons';

const timeSlots = [
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '13:00 - 14:00',
  '14:00 - 15:00',
  '15:00 - 16:00'
];

export default function BookingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [catalog, setCatalog] = useState({ services: [], addons: [] });
  const [serviceId, setServiceId] = useState('');
  const [addonIds, setAddonIds] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [slotCapacity, setSlotCapacity] = useState(1);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [form, setForm] = useState({
    bookingDate: '',
    bookingTime: '',
    customerName: '',
    customerPhone: '',
    carModel: '',
    carPlate: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedDateClosed = isSunday(form.bookingDate);

  useEffect(() => {
    api('/services')
      .then((data) => {
        setCatalog(data);
        const wanted = new URLSearchParams(location.search).get('service');
        const selected = data.services.find((item) => item.name === wanted);
        setServiceId(String(selected?.id || data.services[0]?.id || ''));
      })
      .catch((err) => setError(err.message));
  }, [location.search]);

  useEffect(() => {
    if (!form.bookingDate || isSunday(form.bookingDate)) {
      setAvailability([]);
      setAvailabilityLoading(false);
      if (form.bookingDate && isSunday(form.bookingDate)) {
        setForm((current) => current.bookingTime ? { ...current, bookingTime: '' } : current);
      }
      return undefined;
    }

    let cancelled = false;
    setAvailabilityLoading(true);
    api(`/bookings/availability?date=${encodeURIComponent(form.bookingDate)}`)
      .then((data) => {
        if (cancelled) return;
        setAvailability(data.slots);
        setSlotCapacity(data.capacity);
        setForm((current) => {
          const selected = data.slots.find((slot) => slot.time === current.bookingTime);
          return selected?.available ? current : { ...current, bookingTime: '' };
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });

    return () => { cancelled = true; };
  }, [form.bookingDate]);

  const selectedService = catalog.services.find((item) => String(item.id) === String(serviceId));
  const selectedAddons = catalog.addons.filter((item) => addonIds.includes(Number(item.id)));
  const total = useMemo(
    () => Number(selectedService?.price || 0) + selectedAddons.reduce((sum, item) => sum + Number(item.price), 0),
    [selectedService, selectedAddons]
  );

  const update = (key, value) => {
    if (key === 'bookingDate') setError('');
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'bookingDate' ? { bookingTime: '' } : {})
    }));
  };

  function getSlot(time) {
    return availability.find((slot) => slot.time === time) || {
      time,
      available: true,
      remaining: slotCapacity,
      bookedCount: 0
    };
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (selectedDateClosed) {
      setError('ร้านปิดทุกวันอาทิตย์ กรุณาเลือกวันอื่น');
      return;
    }
    if (!user) return navigate(`/auth?return=${encodeURIComponent('/booking')}`);
    setBusy(true);

    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      body.append('serviceId', serviceId);
      body.append('addonIds', JSON.stringify(addonIds));
      const result = await api('/bookings', { method: 'POST', body });
      setAvailability((current) => current.map((slot) => slot.time === form.bookingTime
        ? { ...slot, bookedCount: slot.bookedCount + 1, remaining: Math.max(slot.remaining - 1, 0), available: slot.remaining - 1 > 0 }
        : slot));
      navigate(`/payment/${encodeURIComponent(result.bookingCode)}`);
    } catch (err) {
      setError(err.message);
      if (err.message.includes('เต็มแล้ว')) {
        setAvailability((current) => current.map((slot) => slot.time === form.bookingTime
          ? { ...slot, remaining: 0, available: false }
          : slot));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:py-12">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Make a booking</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#10284a] md:text-[42px]">จองคิวออนไลน์</h1>
          <p className="mt-2 text-sm text-slate-500">เลือกบริการและเวลาที่สะดวก แล้วชำระเงินในขั้นตอนถัดไป</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm sm:self-auto">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">1</span>
          <span className="text-blue-700">เลือกรายละเอียด</span><span className="mx-1 h-px w-6 bg-slate-200" />
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">2</span><span>ชำระเงิน</span>
        </div>
      </div>

      {error && <div className="mb-5 bg-rose-50 text-rose-700 rounded-xl p-3 text-sm">{error}</div>}

      <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-5 lg:col-span-2">
          <section className="surface rounded-2xl p-5 md:p-7">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon name="calendar" /></span>
              <div><h2 className="font-bold text-[#10284a]">เลือกวันและเวลา</h2><p className="mt-1 text-xs text-slate-500">เลือกวันก่อน แล้วเลือกช่วงเวลาที่คิวว่าง</p></div>
            </div>
            <label className="block max-w-sm text-sm font-semibold text-slate-700">
              วันที่เข้ารับบริการ
              <input type="date" required min={getBangkokToday()} value={form.bookingDate} onChange={(e) => update('bookingDate', e.target.value)} className={`field ${selectedDateClosed ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : ''}`} />
              {form.bookingDate && <span className="mt-2 block text-xs font-medium text-blue-700">{formatThaiDate(form.bookingDate, { withWeekday: true })}</span>}
              {selectedDateClosed && <span className="mt-2 block text-xs font-semibold text-rose-600">ร้านปิดทุกวันอาทิตย์ กรุณาเลือกวันจันทร์–เสาร์</span>}
            </label>
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">ช่วงเวลา</p>{availabilityLoading && <span className="text-xs text-blue-600">กำลังตรวจสอบคิว...</span>}</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {timeSlots.map((time) => {
                  const slot = getSlot(time);
                  const selected = form.bookingTime === time;
                  const canSelect = Boolean(form.bookingDate) && !selectedDateClosed && slot.available;
                  return <label key={time} className={`relative flex flex-col rounded-xl border p-3 transition ${selected ? 'cursor-pointer border-blue-500 bg-blue-50 ring-2 ring-blue-100' : canSelect ? 'cursor-pointer border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50' : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'} focus-within:ring-2 focus-within:ring-blue-200`}>
                    <input type="radio" name="bookingTime" required value={time} checked={selected} disabled={!canSelect} onChange={() => update('bookingTime', time)} className="sr-only" />
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-800"><Icon name="clock" size={16} className={selected ? 'text-blue-600' : 'text-slate-400'} />{time}</span>
                    <span className={`mt-1 pl-6 text-[11px] ${slot.available ? 'text-slate-500' : 'text-rose-500'}`}>{selectedDateClosed ? 'ร้านปิด' : !form.bookingDate ? 'เลือกวันที่ก่อน' : slot.available ? `ว่าง ${slot.remaining}/${slotCapacity} คิว` : 'คิวเต็ม'}</span>
                  </label>;
                })}
              </div>
              {form.bookingDate && <p className="mt-3 text-xs text-slate-400">จำกัด {slotCapacity} คันต่อช่วงเวลา</p>}
            </div>
          </section>

          <section className="surface rounded-2xl p-5 md:p-7">
            <div className="mb-5 flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon name="sparkle" /></span><div><h2 className="font-bold text-[#10284a]">บริการหลัก</h2><p className="mt-1 text-xs text-slate-500">เลือกแพ็กเกจที่เหมาะกับรถของคุณ</p></div></div>
            <div className="grid gap-3 sm:grid-cols-3">
              {catalog.services.map((service) => <label key={service.id} className={`relative cursor-pointer rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-blue-200 ${String(service.id) === String(serviceId) ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-white ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-200'}`}>
                <input type="radio" name="service" value={service.id} checked={String(service.id) === String(serviceId)} onChange={(e) => setServiceId(e.target.value)} className="sr-only" />
                {String(service.id) === String(serviceId) && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white"><Icon name="check" size={13} /></span>}
                <span className="block pr-5 text-sm font-bold text-slate-800">{service.name}</span>
                <span className="mt-2 block min-h-10 text-xs leading-5 text-slate-500">{service.description}</span>
                <span className="mt-3 block text-lg font-bold text-blue-600">฿{Number(service.price).toLocaleString()}</span>
              </label>)}
            </div>
          </section>

          <section className="surface rounded-2xl p-5 md:p-7">
            <div className="mb-5 flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Icon name="sparkle" /></span><div><h2 className="font-bold text-[#10284a]">บริการเสริม <span className="font-normal text-slate-400">(เลือกได้)</span></h2><p className="mt-1 text-xs text-slate-500">เพิ่มความสะอาดและการดูแลให้ครบยิ่งขึ้น</p></div></div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {catalog.addons.map((addon) => {
                const checked = addonIds.includes(Number(addon.id));
                return <label key={addon.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 transition ${checked ? 'border-blue-300 bg-blue-50/70' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'}`}>
                <span className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={checked} onChange={(e) => setAddonIds(e.target.checked ? [...addonIds, Number(addon.id)] : addonIds.filter((id) => id !== Number(addon.id)))} className="h-4 w-4 accent-blue-600" /><span className="min-w-0"><b className="block text-sm text-slate-800">{addon.name}</b><small className="mt-0.5 block text-xs leading-4 text-slate-500">{addon.description}</small></span></span>
                <b className="shrink-0 text-sm text-blue-600">฿{Number(addon.price).toLocaleString()}</b>
                </label>;
              })}
            </div>
          </section>

          <section className="surface rounded-2xl p-5 md:p-7">
            <div className="mb-5 flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Icon name="car" /></span><div><h2 className="font-bold text-[#10284a]">ข้อมูลลูกค้าและรถ</h2><p className="mt-1 text-xs text-slate-500">ใช้สำหรับติดต่อและเตรียมรับรถ</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[['customerName', 'ชื่อ - นามสกุล'], ['customerPhone', 'เบอร์โทรศัพท์'], ['carModel', 'รุ่นรถ'], ['carPlate', 'ทะเบียนรถ']].map(([key, label]) => <label key={key} className="text-sm font-semibold">
                {label}<input required value={form[key]} onChange={(e) => update(key, e.target.value)} placeholder={key === 'customerPhone' ? '08X-XXX-XXXX' : key === 'carPlate' ? 'เช่น กข 1234' : `กรอก${label}`} className="field" />
              </label>)}
            </div>
            <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"><Icon name="shield" size={17} className="mt-0.5 shrink-0 text-emerald-600" /><span>ข้อมูลของคุณใช้สำหรับการจองครั้งนี้เท่านั้น หลังยืนยัน ระบบจะแสดง QR สำหรับชำระเงินและช่องทางส่งสลิป</span></div>
          </section>
        </div>

        <aside className="surface h-fit overflow-hidden rounded-2xl lg:sticky lg:top-24">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white"><p className="text-xs font-semibold tracking-wide text-blue-100">YOUR BOOKING</p><h2 className="mt-1 text-lg font-bold">สรุปรายการจอง</h2></div>
          <div className="p-5 md:p-6">
          <div className="space-y-4 text-sm">
            <div className="flex items-start justify-between gap-4"><span className="text-slate-500">บริการหลัก</span><b className="text-right text-slate-800">{selectedService?.name || 'เลือกบริการ'}</b></div>
            {selectedAddons.map((addon) => <div key={addon.id} className="flex justify-between gap-4 text-xs"><span className="text-slate-500">+ {addon.name}</span><b className="text-slate-700">฿{Number(addon.price).toLocaleString()}</b></div>)}
            <div className="flex items-start justify-between gap-4 border-t border-dashed pt-4"><span className="text-slate-500">วันและเวลา</span><b className="max-w-[65%] text-right text-slate-800">{form.bookingDate ? formatThaiDate(form.bookingDate, { withWeekday: true }) : 'เลือกวันที่'}<span className="block text-xs font-medium text-slate-500">{form.bookingTime || 'เลือกช่วงเวลา'}</span></b></div>
          </div>
          <div className="mt-5 flex items-end justify-between border-t pt-4"><span className="pb-1 font-semibold text-slate-700">ยอดรวม</span><span className="text-3xl font-bold tracking-tight text-blue-600">฿{total.toLocaleString()}</span></div>
          <button disabled={busy || !catalog.services.length || availabilityLoading || selectedDateClosed} className="primary-button mt-5 w-full rounded-xl py-3.5 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'กำลังบันทึก...' : user ? 'ยืนยันการจอง' : 'เข้าสู่ระบบเพื่อจอง'}<Icon name="arrow" size={18} /></button>
          <p className="mt-3 text-center text-[11px] text-slate-400">ตรวจสอบข้อมูลให้ถูกต้องก่อนยืนยัน</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
