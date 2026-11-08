import { useState } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icons';

export default function ContactPage() {
  const [form, setForm] = useState({ senderName: '', senderContact: '', subject: 'สอบถามบริการ', message: '' });
  const [attachment, setAttachment] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const body = new FormData(); Object.entries(form).forEach(([key, value]) => body.append(key, value)); if (attachment) body.append('attachment', attachment);
      await api('/contacts', { method: 'POST', body });
      setMessage('ส่งข้อความเรียบร้อยแล้ว ทางร้านจะติดต่อกลับโดยเร็วที่สุด'); setForm({ senderName: '', senderContact: '', subject: 'สอบถามบริการ', message: '' }); setAttachment(null); event.target.reset();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:py-16 lg:grid-cols-[0.75fr_1.25fr] lg:items-start"><div><p className="eyebrow">Get in touch</p><h1 className="mt-3 text-4xl font-bold tracking-tight text-[#0b1f3a] md:text-5xl">ติดต่อเรา</h1><p className="mt-4 max-w-md leading-7 text-slate-500">มีคำถามเกี่ยวกับบริการหรือการจอง ส่งข้อความมาได้เลย ทีมงานพร้อมช่วยเหลือคุณ</p><div className="mt-10 space-y-5 border-t border-slate-200 pt-5"><div><p className="font-semibold text-[#0b1f3a]">เวลาทำการ</p><p className="mt-1 text-sm text-slate-500">เปิดวันจันทร์–เสาร์ 09:00 - 16:00 น.</p></div><div><p className="font-semibold text-[#0b1f3a]">สอบถามข้อมูล</p><p className="mt-1 text-sm text-slate-500">ทีมงานจะตอบกลับโดยเร็วที่สุด</p></div></div></div>
    <form onSubmit={submit} className="surface rounded-xl p-6 md:p-8"><div className="border-b border-slate-100 pb-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Message us</p><h2 className="mt-2 text-xl font-bold text-[#0b1f3a]">ฝากข้อความถึงทีมงาน</h2></div>{message && <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}{error && <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="block text-sm font-semibold">ชื่อ - นามสกุล<input required value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} className="field" /></label><label className="block text-sm font-semibold">ช่องทางติดต่อ<input required value={form.senderContact} onChange={(e) => setForm({ ...form, senderContact: e.target.value })} placeholder="เบอร์โทรศัพท์หรืออีเมล" className="field" /></label></div><label className="mt-5 block text-sm font-semibold">หัวข้อ<select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="field bg-white"><option>สอบถามบริการ</option><option>สอบถามการจอง</option><option>แจ้งปัญหา</option><option>ข้อเสนอแนะ</option></select></label><label className="mt-5 block text-sm font-semibold">ข้อความ<textarea required rows="5" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="field resize-y" /></label><label className="mt-5 block text-sm font-semibold">ไฟล์แนบ <span className="font-normal text-xs text-slate-400">(รูปภาพหรือ PDF ไม่เกิน 5 MB)</span><span className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3.5 py-3 text-sm font-normal text-slate-500 hover:border-blue-400 hover:text-blue-600"><Icon name="upload" size={18} />{attachment ? attachment.name : 'เลือกไฟล์แนบ'}<input type="file" accept="image/*,.pdf" onChange={(e) => { const file = e.target.files?.[0] || null; if (file?.size > 5 * 1024 * 1024) { setError('ไฟล์มีขนาดใหญ่เกินไป กรุณาแนบไฟล์ที่มีขนาดไม่เกิน 5 MB'); setAttachment(null); e.target.value = ''; return; } setError(''); setAttachment(file); }} className="sr-only" /></span></label><button type="submit" disabled={busy} className="primary-button mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'กำลังส่ง...' : 'ส่งข้อความ'} <Icon name="arrow" size={17} /></button></form>
  </div>;
}
