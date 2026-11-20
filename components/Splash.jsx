'use client';

import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';

// Layar pembuka berlogo saat aplikasi dimuat / di-refresh. Logo & nama datang dari server (app/layout.js),
// sehingga sudah ada di HTML pertama sebelum JavaScript atau Firestore selesai dimuat.
// Beranda memanggil `window.dispatchEvent(new Event(EVENT_SIAP))` setelah profil, tema, dan foto hero siap;
// halaman lain (admin, login, laporan) menutupnya segera setelah waktu tampil minimum.
export const EVENT_SIAP = 'ybmg:siap';
const MIN_MS = 700; // tampil minimal (hindari kedip bila data sudah di cache)
const MAX_MS = 8000; // batas aman: tidak pernah menahan halaman lebih lama dari ini
const FADE_MS = 450; // harus sama dengan transisi .splash di globals.css

export default function Splash({ logo = '', nama = '', status = '' }) {
  const [ada, setAda] = useState(true); // masih dipasang di DOM
  const [pudar, setPudar] = useState(false); // sedang memudar

  useEffect(() => {
    const mulai = Date.now();
    const timers = [];
    let selesai = false;
    const tutup = () => {
      if (selesai) return;
      selesai = true;
      const sisa = Math.max(0, MIN_MS - (Date.now() - mulai));
      timers.push(setTimeout(() => setPudar(true), sisa));
      timers.push(setTimeout(() => setAda(false), sisa + FADE_MS));
    };
    const beranda = window.location.pathname === '/';
    if (!beranda || window.__ybmgSiap) tutup();
    else window.addEventListener(EVENT_SIAP, tutup);
    timers.push(setTimeout(tutup, MAX_MS));
    return () => { window.removeEventListener(EVENT_SIAP, tutup); timers.forEach(clearTimeout); };
  }, []);

  if (!ada) return null;
  return (
    <div id="splash" className={`splash${pudar ? ' selesai' : ''}`} role="status" aria-label="Memuat aplikasi">
      {logo
        ? <img src={logo} alt="" className="splash-logo" />
        : <Building2 size={64} className="splash-logo" style={{ color: 'rgb(var(--brand-700))' }} />}
      {nama && <p className="splash-nama">{nama}</p>}
      {status && <p className="splash-status">{status}</p>}
      <div className="splash-bar" />
    </div>
  );
}
