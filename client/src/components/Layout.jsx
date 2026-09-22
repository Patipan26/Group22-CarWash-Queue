import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Icon } from './Icons';

const links = [
  ['/', 'หน้าแรก'],
  ['/services', 'บริการและราคา'],
  ['/booking', 'จองคิว'],
  ['/status', 'รายการของฉัน'],
  ['/contact', 'ติดต่อเรา']
];

function NavigationLink({ to, label, onClick }) {
  return <NavLink to={to} onClick={onClick} end={to === '/'} className={({ isActive }) => `relative flex items-center gap-2 px-2 py-2 text-sm font-medium ${isActive ? 'text-blue-700' : 'text-slate-600 hover:text-blue-700'}`}>
    {({ isActive }) => <><span>{label}</span>{isActive && <span className="absolute inset-x-2 -bottom-[17px] h-0.5 bg-blue-600" />}</>}
  </NavLink>;
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

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
            {links.map(([to, label]) => <NavigationLink key={to} to={to} label={label} />)}
            {user?.role === 'admin' && <NavigationLink to="/admin" label="หลังบ้าน" />}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {user ? <><span className="max-w-40 truncate text-xs text-slate-500">{user.email}</span><button onClick={handleLogout} className="secondary-button !px-3 !py-2 text-xs"><Icon name="logout" size={15} />ออกจากระบบ</button></> : <Link to="/auth" className="primary-button !px-4 !py-2.5">เข้าสู่ระบบ <Icon name="arrow" size={16} /></Link>}
          </div>

          <button type="button" aria-label="เปิดเมนู" onClick={() => setMenuOpen((value) => !value)} className="rounded-lg border border-slate-200 p-2 text-slate-700 md:hidden"><Icon name={menuOpen ? 'close' : 'menu'} size={21} /></button>
        </div>
        {menuOpen && <div className="border-t border-slate-100 bg-white px-5 py-3 md:hidden"><nav className="space-y-1">{links.map(([to, label]) => <NavigationLink key={to} to={to} label={label} onClick={() => setMenuOpen(false)} />)}{user?.role === 'admin' && <NavigationLink to="/admin" label="หลังบ้าน" onClick={() => setMenuOpen(false)} />}</nav><div className="mt-3 border-t border-slate-100 pt-3">{user ? <button onClick={handleLogout} className="secondary-button w-full !py-2.5 text-xs"><Icon name="logout" size={15} />ออกจากระบบ</button> : <Link to="/auth" onClick={() => setMenuOpen(false)} className="primary-button w-full !py-2.5">เข้าสู่ระบบ <Icon name="arrow" size={16} /></Link>}</div></div>}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-[#0b1f3a] text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div><span className="font-bold text-white">CarWash <span className="text-blue-300">Queue</span></span><p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">ระบบจองคิวล้างรถที่ช่วยให้คุณวางแผนเวลาได้ง่ายขึ้น</p></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">เมนูหลัก</p><div className="mt-4 space-y-2 text-sm text-slate-400"><Link className="block hover:text-white" to="/services">บริการและราคา</Link><Link className="block hover:text-white" to="/booking">จองคิว</Link><Link className="block hover:text-white" to="/status">รายการของฉัน</Link></div></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">เวลาทำการ</p><p className="mt-4 text-sm leading-6 text-slate-400">เปิดทุกวัน<br />09:00 - 16:00 น.</p></div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-slate-500">© 2026 CarWash Queue System</div>
      </footer>
    </div>
  );
}
