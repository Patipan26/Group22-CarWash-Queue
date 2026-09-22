import { Link } from 'react-router-dom';
import { Icon } from '../components/Icons';

const highlights = [
  ['01', 'เลือกบริการ', 'ดูแพ็กเกจและราคาที่เหมาะกับรถของคุณ'],
  ['02', 'เลือกวันเวลา', 'เห็นจำนวนคิวว่างก่อนยืนยันการจอง'],
  ['03', 'ติดตามสถานะ', 'ตรวจสอบรายการจองได้จากบัญชีของคุณ']
];

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden bg-[#0b1f3a] text-white">
        <div className="absolute -right-40 -top-48 h-[32rem] w-[32rem] rounded-full border-[70px] border-blue-400/10" />
        <div className="absolute -bottom-52 left-1/3 h-[28rem] w-[28rem] rounded-full border-[45px] border-white/5" />
        <div className="relative mx-auto max-w-7xl px-5 py-20 md:py-28">
          <div className="max-w-3xl">
            <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.24em] text-blue-300"><span className="h-px w-8 bg-blue-400" /> Carwash / Online booking</p>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.15] tracking-tight md:text-6xl">ล้างรถแบบมีแผน<br /><span className="text-blue-300">ไม่ต้องเสียเวลารอ</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 md:text-lg">จองคิวล่วงหน้า เลือกบริการและช่วงเวลาที่สะดวก พร้อมติดตามสถานะการจองได้ในที่เดียว</p>
            <div className="mt-9 flex flex-wrap gap-3"><Link to="/booking" className="primary-button bg-blue-500 hover:bg-blue-400">จองคิวทันที <Icon name="arrow" size={17} /></Link><Link to="/services" className="secondary-button border-white/20 bg-white/5 text-white hover:border-blue-300 hover:bg-white/10 hover:text-white">ดูบริการและราคา</Link></div>
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-xs text-slate-300"><span className="flex items-center gap-2"><Icon name="check" size={16} className="text-blue-300" />เลือกเวลาได้ล่วงหน้า</span><span className="flex items-center gap-2"><Icon name="check" size={16} className="text-blue-300" />แจ้งสถานะทุกขั้นตอน</span></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:py-20">
        <div className="max-w-2xl"><p className="eyebrow">How it works</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0b1f3a] md:text-4xl">จองง่าย เป็นขั้นตอน</h2><p className="mt-3 text-slate-500">ลดเวลารอที่หน้าร้านด้วยการวางแผนล่วงหน้า</p></div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-3">{highlights.map(([number, title, description]) => <div key={number} className="bg-white p-6 md:p-8"><span className="text-sm font-bold text-blue-600">{number}</span><h3 className="mt-8 text-lg font-bold text-[#0b1f3a]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div>)}</div>
      </section>

      <section className="border-y border-slate-200 bg-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-[1fr_auto] md:items-center"><div><p className="eyebrow">พร้อมเมื่อคุณพร้อม</p><h2 className="mt-3 text-2xl font-bold text-[#0b1f3a] md:text-3xl">เลือกแพ็กเกจที่เหมาะกับรถของคุณ</h2></div><Link to="/services" className="secondary-button justify-self-start md:justify-self-end">ดูแพ็กเกจทั้งหมด <Icon name="arrow" size={17} /></Link></div></section>
    </div>
  );
}
