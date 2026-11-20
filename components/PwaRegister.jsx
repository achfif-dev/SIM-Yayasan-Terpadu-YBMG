'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

const KUNCI_TUTUP = 'ybmg_pwa_tutup_v1';
const TUNDA_HARI = 14;

// Mendaftarkan service worker dan menampilkan ajakan "Pasang aplikasi".
// Android/Chrome: memakai beforeinstallprompt. iOS Safari: petunjuk manual (iOS tidak punya prompt otomatis).
export default function PwaRegister() {
  const [prompt, setPrompt] = useState(null);
  const [ios, setIos] = useState(false);
  const [tampil, setTampil] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const daftar = () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
      if (document.readyState === 'complete') daftar();
      else window.addEventListener('load', daftar, { once: true });
    }

    const sudahTerpasang = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (sudahTerpasang) return;
    if (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/login')) return;

    let tunda = false;
    try {
      const t = Number(localStorage.getItem(KUNCI_TUTUP) || 0);
      tunda = t && Date.now() - t < TUNDA_HARI * 86400000;
    } catch (e) { /* abaikan */ }
    if (tunda) return;

    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); setTampil(true); };
    const onTerpasang = () => { setTampil(false); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onTerpasang);

    const ua = window.navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)) {
      setIos(true);
      setTampil(true);
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onTerpasang);
    };
  }, []);

  const tutup = () => {
    setTampil(false);
    try { localStorage.setItem(KUNCI_TUTUP, String(Date.now())); } catch (e) { /* abaikan */ }
  };

  const pasang = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice.catch(() => {});
    setPrompt(null);
    setTampil(false);
  };

  if (!tampil || (!prompt && !ios)) return null;
  return (
    <div
      role="dialog"
      aria-label="Pasang aplikasi"
      style={{ position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 60, maxWidth: 440, margin: '0 auto' }}
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
    >
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-slate-900">Pasang aplikasi di HP</p>
          {ios ? (
            <p className="mt-0.5 text-slate-600">
              Ketuk <Share className="inline h-4 w-4 align-text-bottom" /> Bagikan, lalu pilih <b>Tambah ke Layar Utama</b>.
            </p>
          ) : (
            <p className="mt-0.5 text-slate-600">Buka lebih cepat dari layar utama, tanpa bilah alamat.</p>
          )}
          {!ios && (
            <button
              type="button"
              onClick={pasang}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white"
            >
              <Download className="h-4 w-4" /> Pasang
            </button>
          )}
        </div>
        <button type="button" onClick={tutup} aria-label="Tutup" className="rounded-lg p-1 text-slate-500">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
