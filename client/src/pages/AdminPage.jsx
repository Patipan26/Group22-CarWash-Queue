import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, apiFile } from '../api';
import { Icon } from '../components/Icons';
import { formatThaiDate, getBangkokToday, toDateInputValue } from '../utils/date';

const statusLabels = {
  pending: 'รอยืนยันการจอง',
  confirmed: 'รับรถเข้าคิวแล้ว',
  in_service: 'กำลังให้บริการ',
  completed: 'พร้อมรับรถแล้ว',
  cancelled: 'ยกเลิกการจอง'
};
const nextStatus = { pending: 'confirmed', confirmed: 'in_service', in_service: 'completed' };
const nextStatusActions = { pending: 'รับรถเข้าคิว', confirmed: 'เริ่มให้บริการ', in_service: 'พร้อมรับรถ' };
const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  in_service: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-rose-100 text-rose-800'
};

const paymentLabels = {
  unpaid: 'ยังไม่ชำระ',
  pending_review: 'รอตรวจสอบ',
  verified: 'ตรวจสอบแล้ว',
  rejected: 'ไม่ผ่านการตรวจสอบ'
};

function includesText(item, search) {
  if (!search.trim()) return true;
  const value = [
    item.bookingCode,
    item.customerName,
    item.customerPhone,
    item.carPlate,
    item.carModel,
    item.service
  ].join(' ').toLowerCase();
  return value.includes(search.trim().toLowerCase());
}

function formatMoney(value) {
  return `฿${Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatThaiDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export default function AdminPage() {
  const [searchParams] = useSearchParams();
  const tab = ['contacts', 'customers', 'catalog', 'revenue'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'bookings';
  const [bookings, setBookings] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [deletingContact, setDeletingContact] = useState(false);
  const [deleteContactError, setDeleteContactError] = useState('');
  const [customers, setCustomers] = useState([]);
  const [catalog, setCatalog] = useState({ services: [], addons: [] });
  const [catalogEditor, setCatalogEditor] = useState(null);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [revenueRange, setRevenueRange] = useState(() => {
    const today = getBangkokToday();
    return { from: `${today.slice(0, 7)}-01`, to: today };
  });
  const [revenueReport, setRevenueReport] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [bookingFilter, setBookingFilter] = useState({ search: '', status: 'all', date: '', payment: 'all' });
  const [contactFilter, setContactFilter] = useState({ search: '', status: 'all' });
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedSlipBooking, setSelectedSlipBooking] = useState(null);
  const [slipHistory, setSlipHistory] = useState([]);
  const [slipHistoryLoading, setSlipHistoryLoading] = useState(false);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatingBookingId, setUpdatingBookingId] = useState(null);
  const [updatingPaymentId, setUpdatingPaymentId] = useState(null);

  async function load() {
    try {
      setError('');
      const [bookingData, contactData, customerData, catalogData] = await Promise.all([
        api('/admin/bookings'),
        api('/admin/contacts'),
        api('/admin/customers'),
        api('/admin/catalog')
      ]);
      setBookings(bookingData.bookings);
      setContacts(contactData.contacts);
      setCustomers(customerData.customers);
      setCatalog(catalogData);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (tab !== 'revenue' || !revenueRange.from || !revenueRange.to) return undefined;
    let active = true;
    setRevenueLoading(true);
    api(`/admin/revenue?from=${encodeURIComponent(revenueRange.from)}&to=${encodeURIComponent(revenueRange.to)}`)
      .then((data) => { if (active) { setRevenueReport(data); setError(''); } })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setRevenueLoading(false); });
    return () => { active = false; };
  }, [tab, revenueRange.from, revenueRange.to]);

  async function updateStatus(id, status) {
    if (status === 'cancelled' && !window.confirm('ยืนยันยกเลิกการจองนี้หรือไม่')) return;
    setUpdatingBookingId(id);
    try {
      await api(`/admin/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingBookingId(null);
    }
  }

  async function updatePaymentStatus(booking, paymentStatus) {
    if (paymentStatus === 'rejected' && !window.confirm(`ยืนยันปฏิเสธสลิปของรายการ ${booking.bookingCode} หรือไม่`)) return;
    setUpdatingPaymentId(booking.id);
    try {
      await api(`/admin/bookings/${booking.id}/payment`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentStatus })
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingPaymentId(null);
    }
  }

  async function deleteContact() {
    if (!contactToDelete) return;
    setDeletingContact(true);
    setDeleteContactError('');
    try {
      await api(`/admin/contacts/${contactToDelete.id}`, { method: 'DELETE' });
      if (selectedContact?.id === contactToDelete.id) setSelectedContact(null);
      setContactToDelete(null);
      await load();
    } catch (err) {
      setDeleteContactError(err.message);
    } finally {
      setDeletingContact(false);
    }
  }

  async function openContact(item) {
    setSelectedContact(item);
    setError('');
    if (item.status !== 'unread') return;
    try {
      await api(`/admin/contacts/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'read' })
      });
      const readItem = { ...item, status: 'read' };
      setContacts((current) => current.map((contact) => contact.id === item.id ? readItem : contact));
      setSelectedContact(readItem);
    } catch (err) {
      setError(err.message);
    }
  }

  function editCatalogItem(type, item = null) {
    setError('');
    setCatalogEditor({
      type,
      id: item?.id ?? null,
      name: item?.name ?? '',
      description: item?.description ?? '',
      price: item?.price ?? '',
      durationMinutes: type === 'service' ? (item?.durationMinutes ?? 60) : undefined,
      active: item ? Boolean(item.active) : true
    });
  }

  async function saveCatalogItem(event) {
    event.preventDefault();
    if (!catalogEditor) return;
    setSavingCatalog(true);
    setError('');
    const { type, id, ...fields } = catalogEditor;
    const path = type === 'service' ? '/admin/services' : '/admin/addons';
    try {
      await api(id ? `${path}/${id}` : path, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(fields)
      });
      setCatalogEditor(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingCatalog(false);
    }
  }

  async function toggleCatalogItem(type, item) {
    const path = type === 'service' ? '/admin/services' : '/admin/addons';
    const fields = {
      name: item.name,
      description: item.description,
      price: Number(item.price),
      active: !Boolean(item.active),
      ...(type === 'service' ? { durationMinutes: Number(item.durationMinutes) } : {})
    };
    setError('');
    try {
      await api(`${path}/${item.id}`, { method: 'PATCH', body: JSON.stringify(fields) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function openCustomer(id) {
    setSelectedCustomer(null);
    setCustomerDetailLoading(true);
    try {
      setSelectedCustomer(await api(`/admin/customers/${id}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setCustomerDetailLoading(false);
    }
  }

  async function openSlipHistory(booking) {
    setSelectedSlipBooking(booking);
    setSlipHistory([]);
    setSlipHistoryLoading(true);
    try {
      const data = await api(`/admin/bookings/${booking.id}/slip-verifications`);
      setSlipHistory(data.verifications);
    } catch (err) {
      setError(err.message);
      setSelectedSlipBooking(null);
    } finally {
      setSlipHistoryLoading(false);
    }
  }

  async function openPrivateFile(path) {
    const fileWindow = window.open('about:blank', '_blank');
    if (!fileWindow) {
      setError('เบราว์เซอร์บล็อกหน้าต่างไฟล์ กรุณาอนุญาต Pop-up แล้วลองอีกครั้ง');
      return;
    }
    fileWindow.opener = null;
    try {
      const file = await apiFile(path);
      fileWindow.location.href = URL.createObjectURL(file);
    } catch (err) {
      fileWindow.close();
      setError(err.message);
    }
  }

  const filteredBookings = useMemo(() => bookings.filter((item) => {
    const bookingDate = toDateInputValue(item.bookingDate);
    return includesText(item, bookingFilter.search)
      && (bookingFilter.status === 'all' || item.status === bookingFilter.status)
      && (!bookingFilter.date || bookingDate === bookingFilter.date)
      && (bookingFilter.payment === 'all' || item.paymentStatus === bookingFilter.payment);
  }), [bookings, bookingFilter]);

  const filteredContacts = useMemo(() => contacts.filter((item) => {
    const value = [item.senderName, item.senderContact, item.subject, item.message].join(' ').toLowerCase();
    return (!contactFilter.search.trim() || value.includes(contactFilter.search.trim().toLowerCase()))
      && (contactFilter.status === 'all' || item.status === contactFilter.status);
  }), [contacts, contactFilter]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => [customer.name, customer.email, customer.phone].join(' ').toLowerCase().includes(query));
  }, [customers, customerSearch]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:py-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0b1f3a] md:text-5xl">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-2">จัดการการจอง ข้อความ ลูกค้า และรายการบริการ</p>
        </div>
        <button onClick={load} className="secondary-button !px-3 !py-2 text-sm"><Icon name="dashboard" size={16} />รีเฟรช</button>
      </div>

      {error && <p className="text-rose-600 mb-4">{error}</p>}

      {tab === 'bookings' ? (
        <>
          <div className="surface mb-6 rounded-xl p-5">
            <div className="grid md:grid-cols-4 gap-3">
              <input
                value={bookingFilter.search}
                onChange={(e) => setBookingFilter({ ...bookingFilter, search: e.target.value })}
                placeholder="ค้นหารหัสจอง ชื่อลูกค้า ทะเบียนรถ"
                className="border rounded-xl px-3 py-2 text-sm md:col-span-2"
              />
              <select value={bookingFilter.status} onChange={(e) => setBookingFilter({ ...bookingFilter, status: e.target.value })} className="border rounded-xl px-3 py-2 text-sm bg-white">
                <option value="all">ทุกสถานะการจอง</option>
                {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <input type="date" value={bookingFilter.date} onChange={(e) => setBookingFilter({ ...bookingFilter, date: e.target.value })} className="border rounded-xl px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <select value={bookingFilter.payment} onChange={(e) => setBookingFilter({ ...bookingFilter, payment: e.target.value })} className="border rounded-xl px-3 py-2 text-sm bg-white">
                <option value="all">ทุกสถานะการชำระเงิน</option>
                {Object.entries(paymentLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <button onClick={() => setBookingFilter({ search: '', status: 'all', date: '', payment: 'all' })} className="text-sm text-slate-500 hover:text-blue-600">ล้างตัวกรอง</button>
              <span className="text-xs text-slate-400">พบ {filteredBookings.length} รายการ</span>
            </div>
          </div>

          <div className="surface overflow-x-auto rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b">
                <tr><th className="p-4">วันเวลา</th><th className="p-4">ลูกค้า</th><th className="p-4">รถ</th><th className="p-4">บริการ</th><th className="p-4">ยอดรวม</th><th className="p-4">สถานะ</th></tr>
              </thead>
              <tbody className="divide-y">
                {filteredBookings.map((item) => (
                  <tr key={item.id}>
                    <td className="p-4">{formatThaiDate(item.bookingDate, { withWeekday: true })}<br /><span className="text-xs text-slate-400">{item.bookingTime}</span></td>
                    <td className="p-4">{item.customerName}<br /><span className="text-xs text-slate-400">{item.customerPhone}</span></td>
                    <td className="p-4">{item.carPlate}<br /><span className="text-xs text-slate-400">{item.carModel}</span></td>
                    <td className="p-4 font-semibold">{item.service}<br /><span className="text-xs text-slate-500">{item.addons?.map((a) => `+ ${a.name}`).join(', ') || 'ไม่มีบริการเสริม'}</span></td>
                    <td className="p-4 font-bold text-blue-600">฿{Number(item.totalPrice).toLocaleString()}</td>
                    <td className="p-4 min-w-52">
                      <div className="flex flex-col items-start gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColors[item.status] || 'bg-slate-100 text-slate-700'}`}>{statusLabels[item.status] || item.status}</span>
                        {nextStatus[item.status] && item.paymentStatus === 'verified' && <button type="button" disabled={updatingBookingId === item.id} onClick={() => updateStatus(item.id, nextStatus[item.status])} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"><Icon name="arrow" size={14} />{updatingBookingId === item.id ? 'กำลังบันทึก...' : nextStatusActions[item.status]}</button>}
                        {nextStatus[item.status] && item.paymentStatus !== 'verified' && <span className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">ยืนยันการชำระเงินก่อนดำเนินงาน</span>}
                        {!['completed', 'cancelled'].includes(item.status) && <button type="button" disabled={updatingBookingId === item.id} onClick={() => updateStatus(item.id, 'cancelled')} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60">ยกเลิกการจอง</button>}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-2">ชำระเงิน: {paymentLabels[item.paymentStatus] || item.paymentStatus}</div>
                      {(item.slipPath || Number(item.slipVerificationCount) > 0) && <div className="mt-2 flex flex-wrap gap-2">{item.slipPath && <button type="button" onClick={() => openPrivateFile(`/admin/bookings/${item.id}/slip`)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"><Icon name="eye" size={14} />ดูสลิป</button>}{Number(item.slipVerificationCount) > 0 && <button type="button" onClick={() => openSlipHistory(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"><Icon name="clock" size={14} />ประวัติผลตรวจ<span className="ml-0.5 rounded-full bg-indigo-200 px-1.5 py-0.5 text-[10px] leading-none text-indigo-800">{item.slipVerificationCount}</span></button>}</div>}
                      {item.paymentStatus === 'pending_review' && item.status !== 'cancelled' && <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={updatingPaymentId === item.id} onClick={() => updatePaymentStatus(item, 'verified')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{updatingPaymentId === item.id ? 'กำลังบันทึก...' : 'อนุมัติชำระเงิน'}</button><button type="button" disabled={updatingPaymentId === item.id} onClick={() => updatePaymentStatus(item, 'rejected')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60">ปฏิเสธสลิป</button></div>}
                    </td>
                  </tr>
                ))}
                {!filteredBookings.length && <tr><td colSpan="6" className="p-10 text-center text-slate-400">ไม่พบรายการตามตัวกรอง</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : tab === 'revenue' ? (
        <div className="space-y-6">
          <section className="surface flex flex-wrap items-end gap-4 rounded-xl p-5">
            <label className="text-xs font-semibold text-slate-600">ตั้งแต่<input type="date" value={revenueRange.from} max={revenueRange.to} onChange={(event) => setRevenueRange({ ...revenueRange, from: event.target.value })} className="mt-1.5 block rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" /></label>
            <label className="text-xs font-semibold text-slate-600">ถึง<input type="date" value={revenueRange.to} min={revenueRange.from} onChange={(event) => setRevenueRange({ ...revenueRange, to: event.target.value })} className="mt-1.5 block rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" /></label>
            {revenueLoading && <span className="pb-2 text-xs text-slate-500">กำลังโหลดรายงาน...</span>}
            <p className="pb-2 text-xs text-slate-500">คำนวณจากวันที่ระบบยืนยันการชำระเงินจริง</p>
          </section>

          {revenueReport && <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="surface rounded-xl border-l-4 border-blue-600 p-5"><p className="text-sm text-slate-500">ยอดรับชำระ (รวม VAT)</p><b className="mt-2 block text-2xl font-bold text-blue-700">{formatMoney(revenueReport.summary.totalRevenue)}</b></article>
              <article className="surface rounded-xl border-l-4 border-slate-300 p-5"><p className="text-sm text-slate-500">ยอดก่อน VAT หลังส่วนลด</p><b className="mt-2 block text-2xl font-bold text-slate-800">{formatMoney(revenueReport.summary.beforeVat)}</b></article>
              <article className="surface rounded-xl border-l-4 border-indigo-400 p-5"><p className="text-sm text-slate-500">VAT ที่รวมในยอดรับ</p><b className="mt-2 block text-2xl font-bold text-indigo-700">{formatMoney(revenueReport.summary.vatTotal)}</b></article>
              <article className="surface rounded-xl border-l-4 border-emerald-500 p-5"><p className="text-sm text-slate-500">จำนวนรายการที่รับชำระ</p><b className="mt-2 block text-2xl font-bold text-emerald-700">{Number(revenueReport.summary.paidCount || 0).toLocaleString()} รายการ</b></article>
            </div>

            {Number(revenueReport.summary.cancelledPaidCount || 0) > 0 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>มีรายการชำระแล้วแต่ถูกยกเลิก {Number(revenueReport.summary.cancelledPaidCount).toLocaleString()} รายการ รวม {formatMoney(revenueReport.summary.cancelledPaidAmount)}</b><p className="mt-1 text-xs">แยกออกจากรายรับสุทธิด้านบนแล้ว โปรดตรวจสอบเรื่องคืนเงินกับลูกค้า</p></div>}

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="surface overflow-hidden rounded-xl">
                <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-[#0b1f3a]">รายรับรายวัน</h2><p className="mt-1 text-xs text-slate-500">รวมเฉพาะรายการชำระแล้วที่ไม่ถูกยกเลิก</p></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">วันที่รับชำระ</th><th className="p-3">จำนวน</th><th className="p-3 text-right">ยอดรับชำระ</th></tr></thead><tbody className="divide-y divide-slate-100">{revenueReport.daily.map((day) => <tr key={day.date}><td className="p-3">{formatThaiDate(day.date)}</td><td className="p-3">{Number(day.paidCount || 0).toLocaleString()} รายการ</td><td className="p-3 text-right font-semibold text-blue-700">{formatMoney(day.revenue)}</td></tr>)}{!revenueReport.daily.length && <tr><td colSpan="3" className="p-8 text-center text-sm text-slate-400">ไม่มีรายรับในช่วงวันที่นี้</td></tr>}</tbody></table></div>
              </section>
              <section className="surface overflow-hidden rounded-xl">
                <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-[#0b1f3a]">รายรับแยกตามบริการ</h2><p className="mt-1 text-xs text-slate-500">อิงตามบริการหลักในรายการจอง</p></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">บริการ</th><th className="p-3">จำนวน</th><th className="p-3 text-right">ยอดรับชำระ</th></tr></thead><tbody className="divide-y divide-slate-100">{revenueReport.services.map((service) => <tr key={service.service}><td className="p-3 font-medium">{service.service}</td><td className="p-3">{Number(service.paidCount || 0).toLocaleString()} รายการ</td><td className="p-3 text-right font-semibold text-blue-700">{formatMoney(service.revenue)}</td></tr>)}{!revenueReport.services.length && <tr><td colSpan="3" className="p-8 text-center text-sm text-slate-400">ไม่มีข้อมูลบริการในช่วงวันที่นี้</td></tr>}</tbody></table></div>
              </section>
            </div>

            <section className="surface overflow-hidden rounded-xl">
              <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-[#0b1f3a]">รายการรับชำระ</h2><p className="mt-1 text-xs text-slate-500">แสดงไม่เกิน 200 รายการล่าสุดในช่วงวันที่ที่เลือก</p></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">วันที่รับเงิน</th><th className="p-3">รหัสจอง</th><th className="p-3">ลูกค้า</th><th className="p-3">บริการ</th><th className="p-3">สถานะจอง</th><th className="p-3 text-right">ยอดรับ</th></tr></thead><tbody className="divide-y divide-slate-100">{revenueReport.payments.map((payment) => <tr key={payment.bookingCode} className={payment.bookingStatus === 'cancelled' ? 'bg-amber-50/60' : ''}><td className="p-3">{formatThaiDate(payment.paidDate)}</td><td className="p-3 font-mono text-xs">{payment.bookingCode}</td><td className="p-3">{payment.customerName}</td><td className="p-3">{payment.service}</td><td className="p-3">{payment.bookingStatus === 'cancelled' ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">ยกเลิก · ตรวจคืนเงิน</span> : <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">รับชำระแล้ว</span>}</td><td className="p-3 text-right font-semibold">{formatMoney(payment.amount)}</td></tr>)}{!revenueReport.payments.length && <tr><td colSpan="6" className="p-8 text-center text-sm text-slate-400">ไม่มีรายการชำระในช่วงวันที่นี้</td></tr>}</tbody></table></div>
            </section>
          </>}
        </div>
      ) : tab === 'contacts' ? (
        <>
          <div className="surface mb-6 flex flex-wrap gap-3 rounded-xl p-5">
            <input value={contactFilter.search} onChange={(e) => setContactFilter({ ...contactFilter, search: e.target.value })} placeholder="ค้นหาผู้ส่ง หัวข้อ หรือข้อความ" className="border rounded-xl px-3 py-2 text-sm flex-1 min-w-64" />
            <select value={contactFilter.status} onChange={(e) => setContactFilter({ ...contactFilter, status: e.target.value })} className="border rounded-xl px-3 py-2 text-sm bg-white">
              <option value="all">ทุกสถานะข้อความ</option><option value="unread">ยังไม่อ่าน</option><option value="read">อ่านแล้ว</option><option value="archived">เก็บถาวร</option>
            </select>
            <button onClick={() => setContactFilter({ search: '', status: 'all' })} className="text-sm text-slate-500 hover:text-blue-600">ล้างตัวกรอง</button>
          </div>

          <div className="surface overflow-x-auto rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b"><tr><th className="p-4">ผู้ส่ง</th><th className="p-4">หัวข้อและตัวอย่างข้อความ</th><th className="p-4">วันที่ส่ง</th><th className="p-4">สถานะ</th><th className="p-4">จัดการ</th></tr></thead>
              <tbody className="divide-y">
                {filteredContacts.map((item) => (
                  <tr key={item.id} tabIndex={0} aria-label={`เปิดข้อความ ${item.subject} จาก ${item.senderName}`} onClick={() => openContact(item)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openContact(item); } }} className={`cursor-pointer transition hover:bg-blue-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${item.status === 'unread' ? 'bg-blue-50/40' : ''}`}>
                    <td className="p-4"><b className={`block ${item.status === 'unread' ? 'text-slate-900' : 'font-medium text-slate-700'}`}>{item.senderName}</b><span className="mt-1 block text-xs text-slate-400">{item.senderContact}</span></td>
                    <td className="max-w-md p-4"><button type="button" onClick={(event) => { event.stopPropagation(); openContact(item); }} className="block w-full text-left"><span className={`block truncate ${item.status === 'unread' ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>{item.subject}</span><span className="mt-1 block truncate text-xs text-slate-500">{item.message}</span></button>{item.attachmentPath && <span className="mt-1 inline-block text-[10px] text-blue-600">มีไฟล์แนบ</span>}</td>
                    <td className="p-4 text-xs text-slate-500">{formatThaiDateTime(item.createdAt)}</td>
                    <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.status === 'unread' ? 'bg-blue-100 text-blue-700' : item.status === 'archived' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{item.status === 'unread' ? 'ยังไม่อ่าน' : item.status === 'archived' ? 'เก็บถาวร' : 'อ่านแล้ว'}</span></td>
                    <td className="p-4"><button type="button" onClick={(event) => { event.stopPropagation(); setDeleteContactError(''); setContactToDelete(item); }} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"><Icon name="trash" size={14} />ลบ</button></td>
                  </tr>
                ))}
                {!filteredContacts.length && <tr><td colSpan="5" className="p-10 text-center text-slate-400">ไม่พบข้อความตามตัวกรอง</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : tab === 'catalog' ? (
        <div className="space-y-8">
          <section className="surface rounded-xl p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold text-[#0b1f3a]">บริการหลัก</h2><p className="mt-1 text-sm text-slate-500">บริการที่ปิดจะไม่แสดงให้ลูกค้าเลือกจองใหม่</p></div>
              <button type="button" onClick={() => editCatalogItem('service')} className="primary-button !px-4 !py-2.5 text-sm">＋ เพิ่มบริการ</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {catalog.services.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold text-slate-800">{item.name}</h3><p className="mt-1 min-h-10 whitespace-pre-wrap text-sm text-slate-500">{item.description || 'ไม่มีรายละเอียด'}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.active ? 'เปิดจอง' : 'ปิดจอง'}</span></div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><div><b className="text-lg text-blue-700">฿{Number(item.price).toLocaleString()}</b><span className="ml-2 text-xs text-slate-400">{Number(item.durationMinutes)} นาที</span></div><div className="flex gap-2"><button type="button" onClick={() => editCatalogItem('service', item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">แก้ไข</button><button type="button" onClick={() => toggleCatalogItem('service', item)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${item.active ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>{item.active ? 'ปิดบริการ' : 'เปิดบริการ'}</button></div></div>
              </article>)}
              {!catalog.services.length && <p className="col-span-full rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">ยังไม่มีบริการหลัก</p>}
            </div>
          </section>
          <section className="surface rounded-xl p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold text-[#0b1f3a]">บริการเสริม</h2><p className="mt-1 text-sm text-slate-500">รายการเดิมในประวัติการจองจะคงราคาเดิมไว้</p></div>
              <button type="button" onClick={() => editCatalogItem('addon')} className="primary-button !px-4 !py-2.5 text-sm">＋ เพิ่มบริการเสริม</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {catalog.addons.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold text-slate-800">{item.name}</h3><p className="mt-1 min-h-10 whitespace-pre-wrap text-sm text-slate-500">{item.description || 'ไม่มีรายละเอียด'}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.active ? 'เปิดจอง' : 'ปิดจอง'}</span></div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><b className="text-lg text-blue-700">฿{Number(item.price).toLocaleString()}</b><div className="flex gap-2"><button type="button" onClick={() => editCatalogItem('addon', item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">แก้ไข</button><button type="button" onClick={() => toggleCatalogItem('addon', item)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${item.active ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>{item.active ? 'ปิดบริการ' : 'เปิดบริการ'}</button></div></div>
              </article>)}
              {!catalog.addons.length && <p className="col-span-full rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">ยังไม่มีบริการเสริม</p>}
            </div>
          </section>
        </div>
      ) : (
        <>
          <div className="surface mb-6 flex flex-wrap items-center gap-3 rounded-xl p-5">
            <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทรลูกค้า" className="border rounded-xl px-3 py-2 text-sm flex-1 min-w-64" />
            <span className="text-xs text-slate-500">ลูกค้าทั้งหมด {filteredCustomers.length} คน</span>
          </div>
          <div className="surface overflow-x-auto rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50"><tr><th className="p-4">ลูกค้า</th><th className="p-4">ติดต่อ</th><th className="p-4">แต้มสะสม</th><th className="p-4">ประวัติ</th><th className="p-4">รายละเอียด</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => <tr key={customer.id} className="hover:bg-slate-50">
                  <td className="p-4"><b className="block text-slate-800">{customer.name || 'ยังไม่ได้ระบุชื่อ'}</b><span className="mt-1 block text-xs text-slate-400">สมาชิกตั้งแต่ {formatThaiDate(customer.createdAt)}</span></td>
                  <td className="p-4"><span className="block">{customer.email}</span><span className="mt-1 block text-xs text-slate-400">{customer.phone || 'ไม่ได้ระบุเบอร์โทร'}</span></td>
                  <td className="p-4"><b className="text-emerald-700">{Number(customer.loyaltyPoints || 0).toLocaleString()} แต้ม</b></td>
                  <td className="p-4"><span>{Number(customer.bookingCount || 0)} รายการจอง</span><span className="mt-1 block text-xs text-slate-400">ใช้บริการสำเร็จ {Number(customer.completedCount || 0)} ครั้ง</span></td>
                  <td className="p-4"><button type="button" onClick={() => openCustomer(customer.id)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">ดูประวัติและรายละเอียด</button></td>
                </tr>)}
                {!filteredCustomers.length && <tr><td colSpan="5" className="p-10 text-center text-slate-400">ไม่พบข้อมูลลูกค้า</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      {catalogEditor && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingCatalog) setCatalogEditor(null); }} className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="catalog-editor-title" className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl md:p-6">
          <div className="mb-5 flex items-start justify-between"><div><p className="eyebrow">Service catalog</p><h2 id="catalog-editor-title" className="mt-2 text-xl font-bold text-[#0b1f3a]">{catalogEditor.id ? 'แก้ไข' : 'เพิ่ม'}{catalogEditor.type === 'service' ? 'บริการหลัก' : 'บริการเสริม'}</h2><p className="mt-1 text-xs text-slate-500">ราคาใหม่มีผลกับการจองใหม่เท่านั้น</p></div><button type="button" aria-label="ปิดหน้าต่าง" disabled={savingCatalog} onClick={() => setCatalogEditor(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Icon name="close" size={19} /></button></div>
          {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <form onSubmit={saveCatalogItem} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">ชื่อ<input required maxLength={120} value={catalogEditor.name} onChange={(event) => setCatalogEditor({ ...catalogEditor, name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal" /></label>
            <label className="block text-sm font-semibold text-slate-700">รายละเอียด<textarea maxLength={500} rows={3} value={catalogEditor.description} onChange={(event) => setCatalogEditor({ ...catalogEditor, description: event.target.value })} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 font-normal" /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-700">ราคา (บาท)<input required type="number" min="0" max="99999999.99" step="0.01" value={catalogEditor.price} onChange={(event) => setCatalogEditor({ ...catalogEditor, price: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal" /></label>{catalogEditor.type === 'service' && <label className="block text-sm font-semibold text-slate-700">ระยะเวลา (นาที)<input required type="number" min="1" max="1440" step="1" value={catalogEditor.durationMinutes} onChange={(event) => setCatalogEditor({ ...catalogEditor, durationMinutes: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal" /></label>}</div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={Boolean(catalogEditor.active)} onChange={(event) => setCatalogEditor({ ...catalogEditor, active: event.target.checked })} className="h-4 w-4 accent-blue-600" />เปิดให้ลูกค้าเลือกจอง</label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={savingCatalog} onClick={() => setCatalogEditor(null)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">ยกเลิก</button><button type="submit" disabled={savingCatalog} className="primary-button !px-5 !py-2.5 text-sm disabled:opacity-60">{savingCatalog ? 'กำลังบันทึก...' : 'บันทึก'}</button></div>
          </form>
        </section>
      </div>}
      {contactToDelete && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingContact) setContactToDelete(null); }} className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
        <section role="alertdialog" aria-modal="true" aria-labelledby="delete-contact-title" aria-describedby="delete-contact-description" className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="p-6 text-center md:p-8">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-8 ring-rose-50/60"><Icon name="trash" size={27} /></span>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Delete message</p>
            <h2 id="delete-contact-title" className="mt-2 text-2xl font-bold text-[#0b1f3a]">ต้องการลบข้อความนี้?</h2>
            <p id="delete-contact-description" className="mt-2 text-sm leading-6 text-slate-500">เมื่อลบแล้วจะไม่สามารถกู้คืนข้อความนี้ได้</p>
            <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left"><p className="text-xs text-slate-500">ผู้ส่ง</p><p className="mt-1 font-semibold text-slate-800">{contactToDelete.senderName}</p><p className="mt-3 text-xs text-slate-500">หัวข้อ</p><p className="mt-1 font-semibold text-slate-800">{contactToDelete.subject}</p></div>
            {deleteContactError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-left text-sm text-rose-700">{deleteContactError}</p>}
            <div className="mt-6 flex gap-3"><button type="button" autoFocus disabled={deletingContact} onClick={() => setContactToDelete(null)} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">เก็บข้อความไว้</button><button type="button" disabled={deletingContact} onClick={deleteContact} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-rose-600 bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:border-rose-700 hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"><Icon name="trash" size={16} />{deletingContact ? 'กำลังลบ...' : 'ยืนยันลบ'}</button></div>
          </div>
        </section>
      </div>}
      {selectedContact && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedContact(null); }} className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="contact-message-title" className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-100 p-5 md:p-6"><div><p className="eyebrow">Inbox message</p><h2 id="contact-message-title" className="mt-2 text-xl font-bold leading-snug text-[#0b1f3a] md:text-2xl">{selectedContact.subject}</h2></div><button type="button" aria-label="ปิดข้อความ" onClick={() => setSelectedContact(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Icon name="close" size={19} /></button></div>
          <div className="max-h-[calc(90vh-92px)] overflow-y-auto">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/70 p-5 md:p-6">
              <div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-700"><Icon name="user" size={21} /></span><div className="min-w-0"><p className="font-bold text-slate-800">{selectedContact.senderName}</p><p className="mt-1 break-all text-sm text-slate-500">{selectedContact.senderContact}</p><p className="mt-2 text-xs text-slate-400">ถึง CarWash Queue</p></div></div>
              <time className="text-xs text-slate-500">{formatThaiDateTime(selectedContact.createdAt)}</time>
            </div>
            <div className="p-5 md:p-8"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">เนื้อหาข้อความ</p><div className="min-h-40 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{selectedContact.message}</div>
              {selectedContact.attachmentPath && <div className="mt-7 border-t border-slate-100 pt-5"><p className="mb-3 text-xs font-semibold text-slate-500">ไฟล์แนบ</p><button type="button" onClick={() => openPrivateFile(`/admin/contacts/${selectedContact.id}/attachment`)} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"><Icon name="upload" size={16} />เปิดไฟล์แนบ</button></div>}
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50/70 p-4"><button type="button" onClick={() => setSelectedContact(null)} className="secondary-button !px-5 !py-2.5 text-sm">ปิดข้อความ</button></div>
          </div>
        </section>
      </div>}
      {(customerDetailLoading || selectedCustomer) && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedCustomer(null); }} className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="customer-detail-title" className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl">
          {customerDetailLoading ? <div className="p-12 text-center text-sm text-slate-500">กำลังโหลดข้อมูลลูกค้า...</div> : <>
            <div className="flex items-start justify-between border-b border-slate-100 p-5 md:p-6"><div><p className="eyebrow">Customer record</p><h2 id="customer-detail-title" className="mt-2 text-xl font-bold text-[#0b1f3a]">{selectedCustomer.customer.name || 'ยังไม่ได้ระบุชื่อ'}</h2><p className="mt-1 text-xs text-slate-500">{selectedCustomer.customer.email}{selectedCustomer.customer.phone ? ` · ${selectedCustomer.customer.phone}` : ''}</p></div><button type="button" aria-label="ปิดรายละเอียด" onClick={() => setSelectedCustomer(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Icon name="close" size={19} /></button></div>
            <div className="max-h-[calc(90vh-100px)] overflow-y-auto p-5 md:p-6">
              <div className="mb-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-4"><span className="text-xs text-emerald-700">แต้มสะสม</span><b className="mt-1 block text-2xl text-emerald-800">{Number(selectedCustomer.customer.loyaltyPoints || 0).toLocaleString()}</b></div><div className="rounded-xl bg-blue-50 p-4"><span className="text-xs text-blue-700">รายการจอง</span><b className="mt-1 block text-2xl text-blue-800">{selectedCustomer.bookings.length}</b></div><div className="rounded-xl bg-slate-100 p-4"><span className="text-xs text-slate-600">สมัครสมาชิก</span><b className="mt-2 block text-sm text-slate-800">{formatThaiDate(selectedCustomer.customer.createdAt)}</b></div></div>
              <h3 className="mb-3 font-bold text-[#0b1f3a]">ประวัติการจอง</h3>
              {selectedCustomer.bookings.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">วันที่ / เวลา</th><th className="p-3">รหัสจอง</th><th className="p-3">รถ</th><th className="p-3">บริการ</th><th className="p-3">ยอดรวม</th><th className="p-3">แต้มที่ได้</th><th className="p-3">สถานะ</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedCustomer.bookings.map((booking) => <tr key={booking.id}><td className="p-3">{formatThaiDate(booking.bookingDate)}<span className="mt-1 block text-slate-400">{booking.bookingTime}</span></td><td className="p-3 font-mono">{booking.bookingCode}</td><td className="p-3">{booking.carModel}<span className="mt-1 block text-slate-400">{booking.carPlate}</span></td><td className="p-3">{booking.service}</td><td className="p-3 font-semibold">฿{Number(booking.totalPrice).toLocaleString()}</td><td className="p-3 font-semibold text-emerald-700">+{Number(booking.pointsAwarded || 0)}</td><td className="p-3"><span className={`rounded-full px-2 py-1 font-semibold ${statusColors[booking.status] || 'bg-slate-100 text-slate-700'}`}>{statusLabels[booking.status] || booking.status}</span></td></tr>)}</tbody></table></div> : <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">ลูกค้ารายนี้ยังไม่มีประวัติการจอง</p>}
            </div>
          </>}
        </section>
      </div>}
      {selectedSlipBooking && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSlipBooking(null); }} className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="slip-history-title" className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="flex items-start justify-between border-b border-slate-100 p-5"><div><p className="eyebrow">Slip2Go</p><h2 id="slip-history-title" className="mt-2 text-xl font-bold text-[#0b1f3a]">ประวัติผลตรวจสลิป</h2><p className="mt-1 text-xs text-slate-500">รายการจอง {selectedSlipBooking.bookingCode}</p></div><button type="button" aria-label="ปิดประวัติผลตรวจ" onClick={() => setSelectedSlipBooking(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Icon name="close" size={19} /></button></div>
          <div className="max-h-[65vh] overflow-y-auto p-5">
            {slipHistoryLoading ? <p className="py-10 text-center text-sm text-slate-500">กำลังโหลดประวัติ...</p> : slipHistory.length ? <div className="space-y-3">{slipHistory.map((attempt) => <article key={attempt.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm text-slate-800">{attempt.status === 'verified' ? 'ผ่านการตรวจสอบ' : attempt.status === 'rejected' ? 'ไม่ผ่านการตรวจสอบ' : 'ตรวจสอบขัดข้อง'}</b><span className="text-xs text-slate-500">{formatThaiDate(attempt.createdAt, { withWeekday: true })}</span></div>
              <p className="mt-2 text-xs text-slate-600">{attempt.resultMessage || 'ไม่มีข้อความตอบกลับ'}{attempt.resultCode ? ` · รหัส ${attempt.resultCode}` : ''}{attempt.amount != null ? ` · ยอด ฿${Number(attempt.amount).toFixed(2)}` : ''}</p>
              {attempt.referenceId && <p className="mt-2 break-all text-xs"><span className="font-semibold text-slate-600">Reference ID: </span><span className="font-mono">{attempt.referenceId}</span></p>}
              {attempt.transactionRef && <p className="mt-1 break-all text-xs"><span className="font-semibold text-slate-600">Transaction Ref: </span><span className="font-mono">{attempt.transactionRef}</span></p>}
            </article>)}</div> : <p className="py-10 text-center text-sm text-slate-500">ยังไม่มีประวัติผลตรวจสลิปสำหรับรายการนี้</p>}
          </div>
        </section>
      </div>}
    </div>
  );
}
