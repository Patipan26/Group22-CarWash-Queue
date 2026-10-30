import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Icon } from '../components/Icons';
import { formatThaiDate } from '../utils/date';

function money(value) {
  return `฿${Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PaymentPage() {
  const { bookingCode } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [promptPayNumber, setPromptPayNumber] = useState('');
  const [slip, setSlip] = useState(null);
  const slipInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    let active = true;
    api(`/bookings/${encodeURIComponent(bookingCode)}`)
      .then((data) => {
        if (!active) return;
        setBooking(data.booking);
        setPromptPayNumber(data.promptPayNumber || '');
      })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [bookingCode]);

  const subtotal = Number(booking?.subtotal || 0);
  const discount = Number(booking?.discountAmount || 0);
  const vat = Math.round((subtotal - discount) * 0.07 * 100) / 100;
  const storedAmountDue = Number(booking?.amountDue || 0);
  const hasSubmittedPayment = ['pending_review', 'verified'].includes(booking?.paymentStatus);
  const amountDue = hasSubmittedPayment && storedAmountDue > 0
    ? storedAmountDue
    : Math.round((subtotal - discount + vat) * 100) / 100;
  const qrUrl = useMemo(() => promptPayNumber && amountDue > 0
    ? `https://promptpay.io/${encodeURIComponent(promptPayNumber)}/${amountDue.toFixed(2)}.png`
    : '', [promptPayNumber, amountDue]);

  async function submitPayment(event) {
    event.preventDefault(); setError(''); setSuccess(null);
    if (!slip) { setError('กรุณาแนบสลิปการโอนเงิน'); return; }
    setBusy(true);
    try {
      const body = new FormData();
      body.append('slip', slip);
      const result = await api(`/bookings/${encodeURIComponent(bookingCode)}/payment`, { method: 'POST', body });
      setBooking((current) => ({ ...current, discountAmount: result.discount, vatAmount: result.vat, amountDue: result.amountDue, paymentStatus: result.paymentStatus }));
      setSlip(null);
      if (slipInputRef.current) slipInputRef.current.value = '';
      if (result.paymentStatus === 'verified') {
        setSuccess({
          message: result.message || 'ระบบตรวจสอบและยืนยันการชำระเงินเรียบร้อยแล้ว',
          amountDue: Number(result.amountDue ?? amountDue)
        });
      } else setError(result.message || 'ระบบยังยืนยันการชำระเงินไม่ได้ กรุณาตรวจสอบสถานะอีกครั้ง');
    } catch (err) {
      setError(err.message);
      setSlip(null);
      if (slipInputRef.current) slipInputRef.current.value = '';
    }
    finally { setBusy(false); }
  }

  if (!booking) return <div className="mx-auto max-w-5xl px-5 py-20 text-center">{error ? <><h1 className="text-xl font-bold text-slate-800">เปิดรายการชำระเงินไม่ได้</h1><p className="mt-2 text-sm text-rose-600">{error}</p><Link to="/booking" className="primary-button mt-5 inline-flex">กลับไปจองคิว</Link></> : <p className="text-slate-500">กำลังโหลดรายการชำระเงิน...</p>}</div>;

  const verified = booking.paymentStatus === 'verified';
  const pendingReview = booking.paymentStatus === 'pending_review';
  return <div className="mx-auto max-w-6xl px-5 py-10 md:py-14">
    <Link to="/booking" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"><span aria-hidden="true">←</span> กลับไปหน้าเลือกบริการ</Link>
    <div className="mb-7"><p className="eyebrow">Payment</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0b1f3a] md:text-4xl">ชำระเงิน</h1><p className="mt-2 text-sm text-slate-500">ตรวจสอบรายละเอียดและสแกน QR Code เพื่อชำระเงิน</p></div>
    {error && <div className="mb-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    {pendingReview && !success && <div className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">ส่งสลิปแล้ว กำลังรอเจ้าหน้าที่ตรวจสอบ</div>}
    {booking.paymentStatus === 'rejected' && <div className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">สลิปก่อนหน้าไม่ผ่านการตรวจสอบ กรุณาตรวจสอบยอดแล้วส่งสลิปใหม่</div>}

    <div className="grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-5">
        <section className="surface rounded-2xl p-5 md:p-6"><h2 className="text-sm font-bold text-[#0b1f3a]">เลือกช่องทางการชำระเงิน</h2><div className="mt-4 flex items-center gap-3 rounded-xl border border-indigo-300 bg-indigo-50/50 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-100 text-indigo-700"><Icon name="sparkle" size={18} /></span><span><b className="block text-sm">พร้อมเพย์ / QR Code</b><small className="mt-1 block text-xs text-slate-500">สแกนชำระผ่านแอปธนาคารได้ทุกธนาคาร</small></span><span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-indigo-600 text-xs text-white">✓</span></div>
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <div className="space-y-2 text-xs"><div className="flex justify-between text-slate-500"><span>ยอดบริการ</span><span>{money(subtotal)}</span></div>{discount > 0 && <div className="flex justify-between text-emerald-700"><span>ส่วนลด</span><span>-{money(discount)}</span></div>}<div className="flex justify-between text-slate-500"><span>ภาษีมูลค่าเพิ่ม (7%)</span><span>{money(vat)}</span></div><div className="flex justify-between border-t border-slate-200 pt-3 text-sm font-bold text-[#0b1f3a]"><span>ยอดชำระสุทธิ</span><span className="text-xl text-indigo-700">{money(amountDue)}</span></div></div>
          </div>
        </section>
        <section className="surface rounded-2xl p-5 md:p-6"><h2 className="text-sm font-bold text-[#0b1f3a]">รายละเอียดการจอง</h2><dl className="mt-4 space-y-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-slate-500">รหัสการจอง</dt><dd className="font-mono font-bold">{booking.bookingCode}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">บริการ</dt><dd className="font-semibold text-blue-700">{booking.service}</dd></div>{booking.addons?.map((addon) => <div key={addon.id} className="flex justify-between gap-3"><dt className="text-slate-500">บริการเสริม · {addon.name}</dt><dd>{money(addon.price)}</dd></div>)}<div className="flex justify-between gap-3"><dt className="text-slate-500">วันที่</dt><dd>{formatThaiDate(booking.bookingDate, { withWeekday: true })}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">เวลา</dt><dd>{booking.bookingTime}</dd></div></dl></section>
      </div>

      <section className="surface rounded-2xl p-5 shadow-sm md:p-7"><div className="text-center"><h2 className="text-base font-semibold text-slate-700">QR Payment</h2><p className="mt-1 text-xs text-slate-500">สแกน QR Code ด้วยแอปธนาคาร</p></div>
        <div className="mx-auto mt-5 grid min-h-64 max-w-[330px] place-items-center rounded-xl border border-slate-200 bg-white p-4">{qrUrl && !qrError ? <img src={qrUrl} alt={`PromptPay QR Code ยอด ${amountDue.toFixed(2)} บาท`} onError={() => setQrError(true)} className="h-56 w-56 object-contain" /> : <div className="max-w-xs px-3 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600"><Icon name="shield" size={22} /></span><p className="mt-3 text-sm font-semibold text-slate-700">ยังไม่สามารถแสดง QR ได้</p><p className="mt-1 text-xs leading-5 text-slate-500">{promptPayNumber ? 'โหลด QR ไม่สำเร็จ กรุณาลองใหม่หรือติดต่อร้าน' : 'ร้านค้ายังไม่ได้ตั้งค่า PromptPay กรุณาติดต่อร้านเพื่อขอช่องทางชำระเงิน'}</p></div>}</div>
        {qrUrl && <p className="mt-3 text-center text-xs text-slate-500">ยอดโอน {money(amountDue)}</p>}
        {qrUrl && <a href={qrUrl} target="_blank" rel="noreferrer" className="mx-auto mt-3 flex w-fit items-center gap-2 text-xs font-semibold text-blue-700 hover:underline"><Icon name="upload" size={14} />เปิด QR Code ขนาดเต็ม</a>}
        <form onSubmit={submitPayment} className="mt-6 border-t border-slate-100 pt-5">
          {!verified && !pendingReview && <><label className="block text-xs font-semibold text-slate-600">แนบรูปสลิปที่มี QR Code<input ref={slipInputRef} type="file" required accept="image/jpeg,image/png,image/webp" onChange={(event) => setSlip(event.target.files?.[0] || null)} className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-normal file:mr-3 file:rounded-md file:border-0 file:bg-indigo-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-indigo-700" /><small className="mt-1 block font-normal text-slate-400">รองรับ JPG, PNG, WEBP · ระบบตรวจ QR, ยอดเงิน, บัญชีผู้รับ และสลิปซ้ำอัตโนมัติ</small></label><button disabled={busy || !slip} className="primary-button mt-4 w-full justify-center !py-3 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'กำลังตรวจสอบสลิป...' : 'ตรวจสอบและยืนยันการชำระเงิน'}</button></>}
          {pendingReview && !verified && !success && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-center text-[11px] text-amber-800">ได้รับสลิปแล้วและกำลังรอตรวจสอบ</p>}
          {verified && <Link to="/tracking" className="primary-button mt-2 flex w-full justify-center !py-3">ติดตามสถานะการจอง</Link>}
        </form>
        <p className="mt-4 text-center text-[10px] text-slate-400">ระบบจะยืนยันเมื่อ QR, ยอดเงิน, บัญชีผู้รับ และสถานะสลิปถูกต้องครบถ้วน</p>
      </section>
    </div>
    {success && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSuccess(null); }} className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="payment-success-title" className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-7 text-center shadow-2xl md:p-9">
        <button type="button" aria-label="ปิดหน้าต่าง" onClick={() => setSuccess(null)} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><Icon name="close" size={19} /></button>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50"><Icon name="check" size={31} /></span>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Payment complete</p>
        <h2 id="payment-success-title" className="mt-2 text-2xl font-bold text-[#0b1f3a]">ชำระเงินสำเร็จ</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{success.message}</p>
        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm"><p className="text-xs text-slate-500">รหัสการจอง</p><p className="mt-1 font-mono font-bold text-[#0b1f3a]">{booking.bookingCode}</p><p className="mt-2 text-xs text-slate-500">ยอดที่ชำระ</p><p className="mt-1 text-lg font-bold text-emerald-700">{money(success.amountDue)}</p></div>
        <Link to="/tracking" className="primary-button mt-6 w-full justify-center !py-3">ติดตามสถานะการจอง<Icon name="arrow" size={17} /></Link>
        <button type="button" onClick={() => setSuccess(null)} className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">ปิด</button>
      </section>
    </div>}
  </div>;
}
