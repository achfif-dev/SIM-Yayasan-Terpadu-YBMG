'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, Loader2, Share2 } from 'lucide-react';
import { bagikanPdf, bisaBagikanFile, unduhBlob } from '../lib/bagikan';

// buat: async () => ({ blob, nama }). PDF dibuat dulu, baru dibagikan lewat ketukan kedua
// (browser HP hanya mengizinkan "bagikan file" tepat setelah ketukan pengguna).
export default function PdfAksi({ buat, teks = '', versi = '', label = 'Buat PDF' }) {
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { setFile(null); setMsg(''); }, [versi]);

  const siapkan = async () => {
    setBusy(true);
    setMsg('');
    try { setFile(await buat()); } catch (e) { setMsg(`Gagal membuat PDF: ${e.message}`); }
    setBusy(false);
  };
  const bagikan = async () => {
    const r = await bagikanPdf(file.blob, file.nama, teks);
    if (r === 'diunduh') setMsg('Browser ini tidak bisa membagikan file langsung, jadi PDF diunduh. Lampirkan dari folder Unduhan saat mengirim di WhatsApp.');
    else if (r === 'dibagikan') setMsg('');
  };

  if (!file) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-light" onClick={siapkan} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} {busy ? 'Membuat PDF…' : label}
        </button>
        {msg && <span className="text-sm text-red-600">{msg}</span>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={bagikan}><Share2 size={14} /> Bagikan PDF{bisaBagikanFile(file.blob, file.nama) ? ' (WhatsApp, dll.)' : ''}</button>
        <button type="button" className="btn-light" onClick={() => unduhBlob(file.blob, file.nama)}><Download size={14} /> Unduh</button>
        <button type="button" className="btn-light" onClick={siapkan} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : null} Buat ulang</button>
      </div>
      <p className="text-xs text-slate-500">{file.nama} · {Math.max(1, Math.round(file.blob.size / 1024))} KB {msg && `· ${msg}`}</p>
    </div>
  );
}
