import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Icon } from '../components/Icons';

function formatDate(value) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await api('/notifications');
      setItems(data.notifications || []);
      setError('');
    } catch (err) { setError(err.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markAllRead() {
    try {
      await api('/notifications/read-all', { method: 'PATCH' });
      setItems((current) => current.map((item) => ({ ...item, isRead: 1 })));
    } catch (err) { setError(err.message); }
  }

  async function openNotification(item) {
    if (!item.isRead) {
      try {
        await api(`/notifications/${item.id}/read`, { method: 'PATCH' });
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: 1 } : entry));
      } catch (err) { setError(err.message); return; }
    }
    if (item.bookingId) navigate('/tracking');
  }

  const unreadCount = items.filter((item) => !item.isRead).length;
  return <div className="mx-auto max-w-4xl px-5 py-12 md:py-16">
    <div className="mb-8 flex items-end justify-between gap-4"><div><p className="eyebrow">Notifications</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0b1f3a] md:text-5xl">การแจ้งเตือน</h1><p className="mt-2 text-sm text-slate-500">ติดตามสถานะการจองและบริการของคุณ</p></div>{unreadCount > 0 && <button onClick={markAllRead} className="secondary-button shrink-0 !px-3 !py-2 text-xs">ทำเครื่องหมายว่าอ่านแล้วทั้งหมด</button>}</div>
    {error && <div className="mb-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    <div className="surface divide-y divide-slate-100 overflow-hidden rounded-2xl">
      {items.length ? items.map((item) => <button key={item.id} onClick={() => openNotification(item)} className={`flex w-full gap-4 p-5 text-left transition hover:bg-slate-50 ${!item.isRead ? 'bg-blue-50/40' : 'bg-white'}`}>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${item.type === 'booking_created' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}><Icon name={item.type === 'booking_created' ? 'check' : 'car'} size={20} /></span>
        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm text-[#0b1f3a]">{item.title}</b><time className="text-xs text-slate-400">{formatDate(item.createdAt)}</time></span><span className="mt-1 block text-sm leading-6 text-slate-600">{item.message}</span>{item.bookingId && <span className="mt-2 inline-block text-xs font-semibold text-blue-600">ดูรายการจอง →</span>}</span>
        {!item.isRead && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" aria-label="ยังไม่อ่าน" />}
      </button>) : <div className="px-6 py-16 text-center"><Icon name="bell" size={30} className="mx-auto text-slate-300" /><h2 className="mt-4 font-semibold text-slate-700">ยังไม่มีการแจ้งเตือน</h2><p className="mt-1 text-sm text-slate-500">เมื่อจองหรือมีการเปลี่ยนสถานะ รายการจะแสดงที่นี่</p><Link to="/booking" className="primary-button mt-5 inline-flex">จองคิวเลย</Link></div>}
    </div>
  </div>;
}
