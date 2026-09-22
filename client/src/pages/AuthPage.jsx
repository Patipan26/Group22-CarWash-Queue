import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function AuthPage() {
  const [registerMode, setRegisterMode] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login, register, googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleGoogleCredential = useCallback(async (response) => {
    setError(''); setBusy(true);
    try {
      const user = await googleLogin(response.credential);
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }, [googleLogin, navigate]);

  async function submit(event) {
    event.preventDefault(); setError('');
    if (registerMode && form.password !== form.confirmPassword) {
      setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }
    setBusy(true);
    try { const user = registerMode ? await register(form.email, form.password) : await login(form.email, form.password); navigate(user.role === 'admin' ? '/admin' : '/'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return <div className="mx-auto grid min-h-[calc(100vh-180px)] max-w-5xl items-center gap-10 px-5 py-12 lg:grid-cols-2">
    <div className="hidden rounded-xl bg-[#0b1f3a] p-10 text-white lg:block"><p className="eyebrow !text-blue-300">Carwash queue</p><h2 className="mt-5 text-4xl font-bold leading-tight">จัดการทุกการจอง<br /><span className="text-blue-300">ไว้ในบัญชีเดียว</span></h2><p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">เข้าสู่ระบบเพื่อจองคิว ดูรายการย้อนหลัง และติดตามสถานะการรับบริการ</p><div className="mt-12 space-y-4 border-t border-white/10 pt-5 text-sm text-slate-300"><p className="border-l border-blue-400 pl-3">เลือกบริการและเวลาที่ต้องการ</p><p className="border-l border-blue-400 pl-3">ตรวจสอบสถานะได้ตลอดเวลา</p></div></div>
    <div className="surface mx-auto w-full max-w-md rounded-xl p-7 md:p-9"><div className="mb-8 flex border-b border-slate-200"><button onClick={() => setRegisterMode(false)} className={`relative w-1/2 pb-3 text-sm font-semibold ${!registerMode ? 'text-blue-600' : 'text-slate-400'}`}>เข้าสู่ระบบ{!registerMode && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-blue-600" />}</button><button onClick={() => setRegisterMode(true)} className={`relative w-1/2 pb-3 text-sm font-semibold ${registerMode ? 'text-blue-600' : 'text-slate-400'}`}>สมัครสมาชิก{registerMode && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-blue-600" />}</button></div><div className="mb-7"><p className="eyebrow">Account access</p><h1 className="mt-2 text-2xl font-bold text-[#0b1f3a]">{registerMode ? 'สร้างบัญชีใหม่' : 'ยินดีต้อนรับกลับ'}</h1><p className="mt-2 text-sm text-slate-500">{registerMode ? 'สมัครเพื่อเริ่มจองคิวล้างรถ' : 'ใช้บัญชีของคุณเพื่อจัดการการจอง'}</p></div>{error && <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<form onSubmit={submit} className="space-y-5"><label className="block text-sm font-semibold">อีเมล<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="field" placeholder="example@mail.com" autoComplete="email" /></label><label className="block text-sm font-semibold">รหัสผ่าน<input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="field" placeholder="อย่างน้อย 6 ตัวอักษร" autoComplete={registerMode ? 'new-password' : 'current-password'} /></label>{registerMode && <label className="block text-sm font-semibold">ยืนยันรหัสผ่าน<input type="password" required minLength={6} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="field" placeholder="กรอกรหัสผ่านอีกครั้ง" autoComplete="new-password" /></label>}<button disabled={busy} className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'กำลังดำเนินการ...' : registerMode ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'} <Icon name="arrow" size={17} /></button></form><GoogleSignInButton onCredential={handleGoogleCredential} /></div>
  </div>;
}
