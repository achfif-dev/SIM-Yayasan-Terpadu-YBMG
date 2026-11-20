'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Download, Facebook, Loader2, MessageCircle, Share2, X } from 'lucide-react';
import { bagikanFoto, bisaLembarBagikan, bukaFacebookFoto, bukaWAFoto, salinTeks, teksFoto, unduhFoto } from '../lib/bagikan';

// Tombol "Bagikan" untuk foto galeri → lembar tindakan: lembar bagikan HP (Instagram, Facebook, WhatsApp, dll.),
// WhatsApp, Facebook, unduh foto, dan salin keterangan (untuk Instagram/TikTok yang tidak punya tautan bagikan web).
// Props: foto { gambarUrl, keterangan, tanggal, lembaga }, opsi { namaYayasan, statusHukum }, gelap (di atas latar gelap), kecil.
export default function BagikanFoto({ foto, opsi = {}, gelap = false, kecil = false }) {
  const [buka, setBuka] = useState(false);
  const [bisaShare, setBisaShare] = useState(false);
  const [sibuk, setSibuk] = useState('');
  const [pesan, setPesan] = useState('');

  useEffect(() => { setBisaShare(bisaLembarBagikan()); }, []);
  useEffect(() => {
    if (!buka) return undefined;
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setBuka(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [buka]);

  if (!foto?.gambarUrl) return null;
  const tutup = () => { setBuka(false); setPesan(''); };
  const jalan = async (kunci, fn, ok) => {
    setSibuk(kunci); setPesan('');
    try { const r = await fn(); setPesan(r === 'batal' ? '' : r === 'gagal' ? 'Gagal. Coba unduh foto lalu bagikan manual.' : ok); } catch (e) { setPesan('Gagal. Coba lagi.'); }
    setSibuk('');
  };
  const item = 'flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
  const ikon = (k, I) => (sibuk === k ? <Loader2 size={18} className="animate-spin" /> : <I size={18} />);

  const pemicu = kecil
    ? 'inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline'
    : gelap
      ? 'inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-white'
      : 'btn-light !px-3 !py-1.5 !text-xs';

  return (
    <>
      <button type="button" className={pemicu} onClick={(e) => { e.stopPropagation(); setBuka(true); }}>
        <Share2 size={kecil ? 12 : 15} /> Bagikan
      </button>
      {buka && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={(e) => { e.stopPropagation(); tutup(); }} role="dialog" aria-modal="true" aria-label="Bagikan foto">
          <div className="max-h-[90vh] w-full max-w-sm space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-slate-800">Bagikan foto</p>
              <button type="button" className="rounded-full p-1.5 hover:bg-slate-200" onClick={tutup} aria-label="Tutup"><X size={18} /></button>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white p-2">
              <img src={foto.gambarUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              <p className="line-clamp-2 min-w-0 break-words text-xs text-slate-600">{foto.keterangan || 'Dokumentasi kegiatan'}</p>
            </div>
            {bisaShare && (
              <button type="button" className={item} disabled={!!sibuk} onClick={() => jalan('app', () => bagikanFoto(foto, opsi), 'Lembar bagikan dibuka.')}>
                {ikon('app', Share2)} Bagikan ke aplikasi (Instagram, Facebook, dll.)
              </button>
            )}
            <button type="button" className={item} disabled={!!sibuk} onClick={() => bukaWAFoto(foto, opsi)}><MessageCircle size={18} /> WhatsApp</button>
            <button type="button" className={item} disabled={!!sibuk} onClick={() => bukaFacebookFoto(foto)}><Facebook size={18} /> Facebook</button>
            <button type="button" className={item} disabled={!!sibuk} onClick={() => jalan('unduh', async () => ((await unduhFoto(foto)) ? 'ok' : 'gagal'), 'Foto diunduh.')}>{ikon('unduh', Download)} Unduh foto</button>
            <button type="button" className={item} disabled={!!sibuk} onClick={() => jalan('salin', async () => ((await salinTeks(teksFoto(foto, opsi))) ? 'ok' : 'gagal'), 'Keterangan disalin.')}>{ikon('salin', Copy)} Salin keterangan</button>
            {pesan && <p className="flex items-center gap-1.5 text-xs text-slate-600" role="status"><Check size={13} className="shrink-0 text-emerald-600" /> {pesan}</p>}
            <p className="text-xs text-slate-500">Instagram dan TikTok tidak punya tautan bagikan web: unduh foto, salin keterangan, lalu tempel di aplikasinya.</p>
          </div>
        </div>
      )}
    </>
  );
}
