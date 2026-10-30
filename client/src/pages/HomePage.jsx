import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icons';

const highlights = [
  ['01', 'เลือกบริการ', 'ดูแพ็กเกจและราคาที่เหมาะกับรถของคุณ'],
  ['02', 'เลือกวันเวลา', 'เห็นจำนวนคิวว่างก่อนยืนยันการจอง'],
  ['03', 'ติดตามสถานะ', 'ตรวจสอบรายการจองได้จากบัญชีของคุณ']
];

const gallery = [
  { src: '/images/car-wash-1.png', alt: 'ล้างรถด้วยโฟมและฉีดน้ำแรงดันสูง', label: 'ล้างรถด้วยโฟม' },
  { src: '/images/car-wash-2.png', alt: 'ฉีดล้างรถและทำความสะอาดล้อ', label: 'ฉีดล้างทำความสะอาด' },
  { src: '/images/car-wash-3.png', alt: 'ใช้ฟองน้ำล้างรถสีแดงอย่างละเอียด', label: 'ใส่ใจทุกรายละเอียด' },
  { src: '/images/car-wash-4.png', alt: 'เช็ดรถให้สะอาดหลังล้าง', label: 'เช็ดแห้งพร้อมส่งมอบ' }
];

export default function HomePage() {
  const [slide, setSlide] = useState({ active: 0, previous: null, fadeIn: false });

  function changeSlide(nextIndex) {
    setSlide((current) => current.active === nextIndex
      ? current
      : { active: nextIndex, previous: current.active, fadeIn: false });
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSlide((current) => ({
        active: (current.active + 1) % gallery.length,
        previous: current.active,
        fadeIn: false
      }));
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (slide.previous === null) return undefined;
    const outgoingImage = slide.previous;
    const frameId = window.requestAnimationFrame(() => {
      setSlide((current) => current.previous === outgoingImage ? { ...current, fadeIn: true } : current);
    });
    const timeoutId = window.setTimeout(() => {
      setSlide((current) => current.previous === outgoingImage
        ? { ...current, previous: null, fadeIn: false }
        : current);
    }, 1100);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [slide.active, slide.previous]);

  return (
    <div>
      <section className="relative isolate min-h-[600px] overflow-hidden bg-[#0b1f3a] text-white md:min-h-[670px]">
        {slide.previous !== null && <img src={gallery[slide.previous].src} alt="" aria-hidden="true" className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-in-out ${slide.fadeIn ? 'opacity-0' : 'opacity-100'}`} />}
        <img src={gallery[slide.active].src} alt="" aria-hidden="true" className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-in-out ${slide.previous !== null && !slide.fadeIn ? 'opacity-0' : 'opacity-100'}`} />
        <div className="absolute inset-0 bg-[#0b1f3a]/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07172d]/95 via-[#0b1f3a]/75 to-[#0b1f3a]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07172d]/50 via-transparent to-[#07172d]/15" />
        <div className="absolute -right-40 -top-48 h-[32rem] w-[32rem] rounded-full border-[70px] border-blue-400/10" />
        <div className="absolute -bottom-52 left-1/3 h-[28rem] w-[28rem] rounded-full border-[45px] border-white/5" />
        <div className="relative mx-auto grid min-h-[600px] max-w-7xl items-center gap-10 px-5 py-14 md:min-h-[670px] md:grid-cols-[1.05fr_0.95fr] md:gap-10 md:py-20 lg:gap-16 lg:py-24">
          <div className="max-w-3xl">
            <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.24em] text-blue-300"><span className="h-px w-8 bg-blue-400" /> Carwash / Online booking</p>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.15] tracking-tight md:text-6xl">ล้างรถแบบมีแผน<br /><span className="text-blue-300">ไม่ต้องเสียเวลารอ</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 md:text-lg">จองคิวล่วงหน้า เลือกบริการและช่วงเวลาที่สะดวก พร้อมติดตามสถานะการจองได้ในที่เดียว</p>
            <div className="mt-9 flex flex-wrap gap-3"><Link to="/booking" className="primary-button bg-blue-500 hover:bg-blue-400">จองคิวทันที <Icon name="arrow" size={17} /></Link><Link to="/services" className="secondary-button border-white/20 bg-white/5 text-white hover:border-blue-300 hover:bg-white/10 hover:text-white">ดูบริการและราคา</Link></div>
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-xs text-slate-300"><span className="flex items-center gap-2"><Icon name="check" size={16} className="text-blue-300" />เลือกเวลาได้ล่วงหน้า</span><span className="flex items-center gap-2"><Icon name="check" size={16} className="text-blue-300" />แจ้งสถานะทุกขั้นตอน</span></div>
          </div>
          <div className="relative z-10 mt-8 flex justify-center md:mt-0 md:self-end md:justify-end md:pb-2">
            <div className="flex items-center gap-2.5" role="group" aria-label="เลือกภาพบริการล้างรถ">
              {gallery.map((item, index) => <button key={item.src} type="button" onClick={() => changeSlide(index)} aria-label={`แสดงภาพที่ ${index + 1}: ${item.label}`} aria-current={slide.active === index ? 'true' : undefined} className={`h-2.5 w-2.5 rounded-full bg-white transition-all duration-300 ${slide.active === index ? 'scale-125 opacity-100' : 'opacity-55 hover:opacity-90'}`} />)}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:py-20">
        <div className="max-w-2xl"><p className="eyebrow">How it works</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0b1f3a] md:text-4xl">จองง่าย เป็นขั้นตอน</h2><p className="mt-3 text-slate-500">ลดเวลารอที่หน้าร้านด้วยการวางแผนล่วงหน้า</p></div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-3">{highlights.map(([number, title, description]) => <div key={number} className="bg-white p-6 md:p-8"><span className="text-sm font-bold text-blue-600">{number}</span><h3 className="mt-8 text-lg font-bold text-[#0b1f3a]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div>)}</div>
      </section>

      <section className="border-y border-emerald-100 bg-emerald-50/70">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-[1fr_auto] md:items-center">
          <div className="max-w-3xl">
            <p className="eyebrow !text-emerald-700">Loyalty rewards</p>
            <h2 className="mt-3 text-2xl font-bold text-[#0b1f3a] md:text-3xl">ล้างรถทุกครั้ง รับแต้มสะสม</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">รับ 1 แต้มทุกยอดใช้จ่าย 25 บาท เมื่อบริการเสร็จสิ้น แต้มสะสมมีไว้แลกรับส่วนลดหรือสิทธิพิเศษในอนาคต</p>
          </div>
          <Link to="/profile" className="secondary-button justify-self-start border-emerald-200 text-emerald-800 hover:border-emerald-300 md:justify-self-end">ดูแต้มสะสมของฉัน <Icon name="arrow" size={17} /></Link>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-[1fr_auto] md:items-center"><div><p className="eyebrow">พร้อมเมื่อคุณพร้อม</p><h2 className="mt-3 text-2xl font-bold text-[#0b1f3a] md:text-3xl">เลือกแพ็กเกจที่เหมาะกับรถของคุณ</h2></div><Link to="/services" className="secondary-button justify-self-start md:justify-self-end">ดูแพ็กเกจทั้งหมด <Icon name="arrow" size={17} /></Link></div></section>
    </div>
  );
}
