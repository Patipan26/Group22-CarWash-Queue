import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Icon } from './Icons';

const links = [
  ['/', 'หน้าแรก'],
  ['/services', 'บริการและราคา'],
  ['/booking', 'จองคิว'],
  ['/tracking', 'ติดตามสถานะ'],
  ['/status', 'รายการของฉัน'],
  ['/contact', 'ติดต่อเรา']
];

function NavigationLink({ to, label, onClick }) {
  return <NavLink to={to} onClick={onClick} end={to === '/'} className={({ isActive }) => `relative flex items-center gap-2 text-sm font-medium ${onClick ? `w-full rounded-xl px-3 py-3 ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-700'}` : `px-2 py-2 ${isActive ? 'text-blue-700' : 'text-slate-600 hover:text-blue-700'}`}`}>
    {({ isActive }) => <><span>{label}</span>{isActive && !onClick && <span className="absolute inset-x-2 -bottom-[17px] h-0.5 bg-blue-600" />}</>}
  </NavLink>;
}

function AdminTabLink({ tab, label, onClick }) {
  const location = useLocation();
  const activeTab = new URLSearchParams(location.search).get('tab') || 'bookings';
  const active = location.pathname === '/admin' && activeTab === tab;
  return <Link to={`/admin?tab=${tab}`} onClick={onClick} className={`relative flex items-center text-sm font-semibold ${onClick ? `w-full rounded-xl px-3 py-3 ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-700'}` : `px-2 py-2 ${active ? 'text-blue-700' : 'text-slate-600 hover:text-blue-700'}`} `}>
    {label}{active && !onClick && <span className="absolute inset-x-2 -bottom-[17px] h-0.5 bg-blue-600" />}
  </Link>;
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const knownNotificationIds = useRef(null);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      setToast(null);
      knownNotificationIds.current = null;
      return undefined;
    }
    let active = true;
    const loadNotifications = () => api('/notifications').then((data) => {
      if (!active) return;
      const items = data.notifications || [];
      if (knownNotificationIds.current) {
        const latestNew = items.find((item) => !knownNotificationIds.current.has(String(item.id)));
        if (latestNew) setToast(latestNew);
      }
      knownNotificationIds.current = new Set(items.map((item) => String(item.id)));
      setNotifications(items.slice(0, 5));
      setUnreadCount(Number(data.unreadCount || 0));
    }).catch(() => undefined);
    void loadNotifications();
    const timer = window.setInterval(() => { void loadNotifications(); }, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleLogout() {
    await logout();
    setMenuOpen(false);
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-5 px-5">
          <Link to="/" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
            <span className="leading-none"><span className="block text-[17px] font-bold tracking-tight text-[#0b1f3a]">CarWash <span className="text-blue-600">Queue</span></span><span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">จองคิวล้างรถ</span></span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            {user?.role === 'admin' ? <><AdminTabLink tab="bookings" label="รายการจอง" /><AdminTabLink tab="customers" label="ข้อมูลลูกค้า" /><AdminTabLink tab="catalog" label="บริการและราคา" /><AdminTabLink tab="revenue" label="รายรับ" /><AdminTabLink tab="contacts" label="ข้อความ" /></> : links.map(([to, label]) => <NavigationLink key={to} to={to} label={label} />)}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {user ? <><span className="max-w-40 truncate text-xs text-slate-500">{user.email}</span><Link to="/profile" aria-label="โปรไฟล์" title="โปรไฟล์" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"><Icon name="user" size={19} /></Link>{user.role === 'admin' && <button onClick={handleLogout} className="secondary-button !px-3 !py-2 text-xs"><Icon name="logout" size={15} />ออกจากระบบ</button>}<div className="relative">
              <button type="button" aria-label={`การแจ้งเตือน${unreadCount ? ` มี ${unreadCount} รายการที่ยังไม่อ่าน` : ''}`} aria-expanded={bellOpen} onClick={() => setBellOpen((value) => !value)} className={`relative grid h-9 w-9 place-items-center rounded-lg transition ${bellOpen ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-700'}`}>
                <Icon name="bell" size={21} />
                {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {bellOpen && <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><b className="text-sm text-[#0b1f3a]">การแจ้งเตือน</b>{unreadCount > 0 && <span className="text-[11px] font-semibold text-blue-600">ยังไม่อ่าน {unreadCount}</span>}</div>
                {notifications.length ? <div className="divide-y divide-slate-100">{notifications.map((item) => <Link key={item.id} to="/notifications" onClick={() => setBellOpen(false)} className={`block px-4 py-3 hover:bg-slate-50 ${!item.isRead ? 'bg-blue-50/50' : ''}`}><span className="flex items-start gap-2"><Icon name="bell" size={15} className="mt-0.5 shrink-0 text-blue-600" /><span className="min-w-0"><b className="block truncate text-xs text-slate-800">{item.title}</b><span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-slate-500">{item.message}</span></span></span></Link>)}</div> : <p className="px-4 py-7 text-center text-xs text-slate-400">ยังไม่มีการแจ้งเตือน</p>}
                <Link to="/notifications" onClick={() => setBellOpen(false)} className="block border-t border-slate-100 px-4 py-3 text-center text-xs font-semibold text-blue-700 hover:bg-slate-50">ดูการแจ้งเตือนทั้งหมด</Link>
              </div>}
            </div></> : <Link to="/auth" className="primary-button !px-4 !py-2.5">เข้าสู่ระบบ <Icon name="arrow" size={16} /></Link>}
          </div>

          <button type="button" aria-label="เปิดเมนู" onClick={() => setMenuOpen((value) => !value)} className="rounded-lg border border-slate-200 p-2 text-slate-700 md:hidden"><Icon name={menuOpen ? 'close' : 'menu'} size={21} /></button>
        </div>
        {menuOpen && <div className="border-t border-slate-100 bg-white px-5 py-3 md:hidden"><nav className="space-y-1">{user?.role === 'admin' ? <><AdminTabLink tab="bookings" label="รายการจอง" onClick={() => setMenuOpen(false)} /><AdminTabLink tab="customers" label="ข้อมูลลูกค้า" onClick={() => setMenuOpen(false)} /><AdminTabLink tab="catalog" label="บริการและราคา" onClick={() => setMenuOpen(false)} /><AdminTabLink tab="revenue" label="รายรับ" onClick={() => setMenuOpen(false)} /><AdminTabLink tab="contacts" label="ข้อความ" onClick={() => setMenuOpen(false)} /></> : links.map(([to, label]) => <NavigationLink key={to} to={to} label={label} onClick={() => setMenuOpen(false)} />)}{user && <NavigationLink to="/notifications" label={<span className="flex items-center gap-2"><Icon name="bell" size={17} />แจ้งเตือน{unreadCount > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}</span>} onClick={() => setMenuOpen(false)} />}</nav><div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">{user ? <><Link to="/profile" aria-label="โปรไฟล์" title="โปรไฟล์" onClick={() => setMenuOpen(false)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-slate-700 hover:bg-slate-50"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-slate-100 text-slate-600"><Icon name="user" size={20} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.name || 'โปรไฟล์ของฉัน'}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{user.email}</span></span></Link>{user.role === 'admin' && <button onClick={handleLogout} className="secondary-button shrink-0 justify-center !px-3 !py-2.5 text-xs"><Icon name="logout" size={15} />ออกจากระบบ</button>}</> : <Link to="/auth" onClick={() => setMenuOpen(false)} className="primary-button w-full !py-2.5">เข้าสู่ระบบ <Icon name="arrow" size={16} /></Link>}</div></div>}
      </header>
      {toast && <div role="status" className="fixed right-4 top-20 z-[60] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-blue-100 bg-white p-4 shadow-xl"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><Icon name="bell" size={18} /></span><div className="min-w-0 flex-1"><b className="block text-sm text-[#0b1f3a]">{toast.title || 'มีการแจ้งเตือนใหม่'}</b><p className="mt-1 text-xs leading-5 text-slate-600">{toast.message}</p><Link to="/notifications" onClick={() => setToast(null)} className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline">ดูการแจ้งเตือน</Link></div><button type="button" aria-label="ปิดการแจ้งเตือน" onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-700"><Icon name="close" size={16} /></button></div></div>}
      <main className="flex-1">{children}</main>
      <footer className="bg-[#0b1f3a] text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div><span className="font-bold text-white">CarWash <span className="text-blue-300">Queue</span></span><p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">ระบบจองคิวล้างรถที่ช่วยให้คุณวางแผนเวลาได้ง่ายขึ้น</p></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">เมนูหลัก</p><div className="mt-4 space-y-2 text-sm text-slate-400"><Link className="block hover:text-white" to="/services">บริการและราคา</Link><Link className="block hover:text-white" to="/booking">จองคิว</Link><Link className="block hover:text-white" to="/status">รายการของฉัน</Link></div></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">เวลาทำการ</p><p className="mt-4 text-sm leading-6 text-slate-400">เปิดวันจันทร์–เสาร์<br />09:00 - 16:00 น.</p></div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-slate-500">© 2026 CarWash Queue System</div>
      </footer>
    </div>
  );
}
