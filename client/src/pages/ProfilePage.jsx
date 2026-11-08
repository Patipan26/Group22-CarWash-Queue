import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';

const statusLabels = { pending: 'รอยืนยันการจอง', confirmed: 'รับรถเข้าคิวแล้ว', in_service: 'กำลังให้บริการ', completed: 'พร้อมรับรถแล้ว', cancelled: 'ยกเลิกการจอง' };
const statusColors = { pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-emerald-100 text-emerald-700', in_service: 'bg-indigo-100 text-indigo-700', completed: 'bg-blue-100 text-blue-700', cancelled: 'bg-rose-100 text-rose-700' };

function dateLabel(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function ProfilePage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [carForm, setCarForm] = useState({ carModel: '', carPlate: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);

  async function handleLogout() {
    setLogoutBusy(true);
    try {
      await logout();
      navigate('/');
    } catch (err) {
      setError(err.message || 'ออกจากระบบไม่สำเร็จ');
      setLogoutBusy(false);
    }
  }

  async function load() {
    try {
      const data = await api('/profile');
      setProfile(data);
      setForm({ name: data.user?.name || '', phone: data.user?.phone || '' });
      setError('');
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { void load(); }, []);

  async function saveProfile(event) {
    event.preventDefault(); setError(''); setNotice('');
    try {
      await api('/profile', { method: 'PATCH', body: JSON.stringify(form) });
      setNotice('บันทึกข้อมูลส่วนตัวแล้ว');
      setEditOpen(false);
      await load();
    } catch (err) { setError(err.message); }
  }

  async function addCar(event) {
    event.preventDefault(); setError(''); setNotice('');
    try {
      await api('/profile/cars', { method: 'POST', body: JSON.stringify(carForm) });
      setCarForm({ carModel: '', carPlate: '' });
      setNotice('เพิ่มรถในประวัติแล้ว');
      await load();
    } catch (err) { setError(err.message); }
  }

  async function changePassword(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');
      return;
    }
    try {
      await api('/profile/password', { method: 'POST', body: JSON.stringify(passwordForm) });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setNotice('เปลี่ยนรหัสผ่านแล้ว');
      setPasswordOpen(false);
    } catch (err) { setError(err.message); }
  }

  if (!profile) return <div className="mx-auto max-w-6xl px-5 py-16 text-center text-slate-500">{error || 'กำลังโหลดโปรไฟล์...'}</div>;

  const { user, stats, cars, recentBookings } = profile;
  return <div className="mx-auto max-w-7xl px-5 py-10 md:py-14">
    <div className="mb-8"><p className="eyebrow">My account</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0b1f3a] md:text-5xl">โปรไฟล์ของฉัน</h1><p className="mt-2 text-sm text-slate-500">จัดการข้อมูลส่วนตัว รถ และประวัติการใช้บริการ</p></div>
    {error && <div className="mb-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}{notice && <div className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
    <div className="grid items-start gap-6 lg:grid-cols-[330px_1fr]">
      <aside className="space-y-5">
        <section className="surface rounded-2xl p-6 text-center">
          <div className="relative mx-auto h-20 w-20"><div className="grid h-20 w-20 place-items-center rounded-lg border border-slate-200 bg-slate-200 text-slate-900"><Icon name="user" size={38} /></div><button type="button" aria-label="แก้ไขโปรไฟล์" onClick={() => { setError(''); setEditOpen(true); }} className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-md bg-indigo-600 text-white shadow"><Icon name="user" size={13} /></button></div>
          <h2 className="mt-4 text-sm font-semibold text-[#0b1f3a]">{user.name || 'สมาชิก CarWash Queue'}</h2><p className="mt-1 text-[11px] text-slate-500">Premium Member</p>
          <button type="button" onClick={() => { setError(''); setEditOpen(true); }} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-100 px-3 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-200"><Icon name="user" size={14} />Edit Profile</button>
        </section>
        <section className="surface rounded-2xl p-5"><h2 className="text-xs font-bold text-[#0b1f3a]">Personal Info</h2><div className="mt-4 space-y-4 text-xs"><div className="flex gap-3"><span className="mt-0.5 text-slate-500">✉</span><div className="min-w-0"><p className="text-slate-500">Email</p><p className="mt-1 break-all font-medium text-slate-700">{user.email}</p></div></div><div className="flex gap-3"><Icon name="phone" size={15} className="text-slate-500" /><div><p className="text-slate-500">Phone</p><p className="mt-1 font-medium text-slate-700">{user.phone || 'ยังไม่ได้ระบุ'}</p></div></div></div><button type="button" onClick={() => { setError(''); setPasswordOpen(true); }} className="mt-4 flex w-full items-center gap-2 border-t border-slate-100 pt-3 text-left text-[11px] font-semibold text-blue-700 hover:text-blue-900"><Icon name="shield" size={13} />Change Password</button></section>
        <button type="button" disabled={logoutBusy} onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"><Icon name="logout" size={17} />{logoutBusy ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}</button>
      </aside>
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-indigo-600 p-5 text-white"><p className="text-xs text-indigo-100">การจองทั้งหมด</p><p className="mt-3 text-3xl font-bold">{stats.bookingCount}</p><p className="mt-1 text-xs text-indigo-100">รายการ</p></div>
          <div className="rounded-2xl bg-emerald-700 p-5 text-white"><p className="text-xs text-emerald-100">แต้มสะสม</p><p className="mt-3 text-3xl font-bold">{Number(user.loyaltyPoints).toLocaleString()}</p><p className="mt-1 text-xs text-emerald-100">แต้ม · รับเมื่อบริการเสร็จสิ้น</p></div>
          <div className="rounded-2xl bg-slate-200 p-5 text-slate-800"><p className="text-xs text-slate-500">ยอดใช้บริการสำเร็จ</p><p className="mt-3 text-2xl font-bold">฿{Number(stats.totalSpent).toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">{stats.completedCount} ครั้ง</p></div>
        </section>
        <section className="surface rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4"><div><h2 className="font-bold text-[#0b1f3a]">ประวัติรถ</h2><p className="mt-1 text-xs text-slate-500">รถจากรายการจองและรถที่บันทึกไว้</p></div><Icon name="car" className="text-blue-600" /></div>
          <div className="divide-y divide-slate-100">{cars.length ? cars.map((car) => <div key={`${car.carPlate}-${car.carModel}`} className="flex items-center gap-4 py-4"><div className="h-12 w-16 shrink-0 rounded-lg bg-slate-200" /><div className="min-w-0 flex-1"><b className="block text-sm">{car.carModel}</b><span className="text-xs text-slate-500">ทะเบียน {car.carPlate}</span></div>{car.lastUsedAt && <span className="text-right text-[11px] text-slate-400">ใช้ล่าสุด<br />{dateLabel(car.lastUsedAt)}</span>}</div>) : <p className="py-6 text-center text-sm text-slate-400">ยังไม่มีประวัติรถ</p>}</div>
          <form onSubmit={addCar} className="mt-3 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_auto]"><input required maxLength={120} placeholder="รุ่นรถ เช่น Honda Civic" value={carForm.carModel} onChange={(e) => setCarForm({ ...carForm, carModel: e.target.value })} className="field !mt-0" /><input required maxLength={60} placeholder="ทะเบียนรถ" value={carForm.carPlate} onChange={(e) => setCarForm({ ...carForm, carPlate: e.target.value })} className="field !mt-0" /><button type="submit" className="secondary-button justify-center !py-2.5 text-sm">+ เพิ่มรถ</button></form>
        </section>
        <section className="surface rounded-2xl p-5 md:p-6"><div className="flex items-center justify-between border-b border-slate-100 pb-4"><h2 className="font-bold text-[#0b1f3a]">การจองล่าสุด</h2><Link to="/status" className="text-xs font-semibold text-blue-600 hover:underline">ดูประวัติทั้งหมด</Link></div>
          <div className="divide-y divide-slate-100">{recentBookings.length ? recentBookings.map((booking) => <div key={booking.id} className="flex items-center gap-3 py-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Icon name="check" size={18} /></span><div className="min-w-0 flex-1"><b className="block truncate text-sm">{booking.service} · {booking.carModel}</b><span className="text-xs text-slate-500">{dateLabel(booking.bookingDate)} · {booking.bookingTime}</span></div><span className="text-right"><b className="block text-sm">฿{Number(booking.totalPrice).toLocaleString()}</b><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[booking.status] || 'bg-slate-100 text-slate-600'}`}>{statusLabels[booking.status] || booking.status}</span></span></div>) : <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีรายการจอง · <Link to="/booking" className="text-blue-600 hover:underline">จองคิวเลย</Link></p>}</div>
        </section>
      </div>
    </div>
    {(editOpen || passwordOpen) && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setEditOpen(false); setPasswordOpen(false); } }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between border-b border-slate-100 pb-4"><div><p className="eyebrow">Account settings</p><h2 id="profile-dialog-title" className="mt-1 text-xl font-bold text-[#0b1f3a]">{editOpen ? 'Edit Profile' : 'Change Password'}</h2></div><button type="button" aria-label="ปิด" onClick={() => { setEditOpen(false); setPasswordOpen(false); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Icon name="close" size={18} /></button></div>{error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {editOpen ? <form onSubmit={saveProfile} className="mt-5 space-y-4"><label className="block text-sm font-semibold">ชื่อที่แสดง<input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" /></label><label className="block text-sm font-semibold">เบอร์โทรศัพท์<input maxLength={30} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="field" /></label><div className="flex gap-3 pt-2"><button type="button" onClick={() => setEditOpen(false)} className="secondary-button flex-1 justify-center">ยกเลิก</button><button type="submit" className="primary-button flex-1 justify-center">บันทึก</button></div></form> : <form onSubmit={changePassword} className="mt-5 space-y-4"><p className="text-xs leading-5 text-slate-500">บัญชี Google ที่ยังไม่มีรหัสผ่านสามารถตั้งรหัสผ่านใหม่ได้เลย</p><label className="block text-sm font-semibold">รหัสผ่านปัจจุบัน<input type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="field" /></label><label className="block text-sm font-semibold">รหัสผ่านใหม่<input required minLength={6} type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="field" /></label><label className="block text-sm font-semibold">ยืนยันรหัสผ่านใหม่<input required minLength={6} type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="field" /></label><div className="flex gap-3 pt-2"><button type="button" onClick={() => setPasswordOpen(false)} className="secondary-button flex-1 justify-center">ยกเลิก</button><button type="submit" className="primary-button flex-1 justify-center">เปลี่ยนรหัสผ่าน</button></div></form>}
    </section></div>}
  </div>;
}
