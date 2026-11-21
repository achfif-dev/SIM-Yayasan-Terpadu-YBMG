'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, Upload, X, Trash2 } from 'lucide-react';
import { getDb } from '../lib/firebase';
import { PRIVAT_PREFIX, RECEIPT_PREFIX, uploadBukti } from '../lib/upload';

// value: URL (Cloudinary) atau "receipt:<id>" (disimpan di koleksi receipts)
export function useBuktiSrc(value) {
  const [src, setSrc] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (!value) { setSrc(''); setLoading(false); return undefined; }
    const privat = value.startsWith(PRIVAT_PREFIX);
    if (!privat && !value.startsWith(RECEIPT_PREFIX)) { setSrc(value); setLoading(false); return undefined; }
    setSrc('');
    setLoading(true);
    getDoc(doc(getDb(), privat ? 'bukti_donasi' : 'receipts', value.slice((privat ? PRIVAT_PREFIX : RECEIPT_PREFIX).length)))
      .then((s) => { if (!alive) return; if (s.exists()) setSrc(s.data().data || ''); else setFailed(true); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [value]);

  return { src, loading, failed };
}

export function BuktiModal({ value, onClose }) {
  const { src, loading, failed } = useBuktiSrc(value);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative max-h-full max-w-3xl rounded-2xl bg-white p-3" onClick={(e) => e.stopPropagation()}>
        <button className="absolute right-2 top-2 rounded-full bg-white p-1 shadow" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        {loading && <div className="flex h-40 w-64 items-center justify-center"><Loader2 className="animate-spin text-brand-700" /></div>}
        {failed && <p className="p-8 text-sm text-slate-500">Bukti tidak dapat dimuat.</p>}
        {src && <img src={src} alt="Bukti transaksi" className="max-h-[80vh] max-w-full rounded-lg object-contain" />}
      </div>
    </div>
  );
}

export function BuktiField({ value, onChange, label = 'Upload foto nota', privat = false }) {
  const [busy, setBusy] = useState(false);
  const { src } = useBuktiSrc(value);

  const handle = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { onChange(await uploadBukti(file, { privat })); } catch (err) { alert('Upload gagal: ' + err.message); }
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-3">
      {src
        ? <img src={src} alt="" className="h-16 w-16 rounded-lg border object-cover" />
        : <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100"><Upload size={18} /></div>}
      <label className="btn-light cursor-pointer">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {value ? 'Ganti' : label}
        <input type="file" accept="image/*" className="hidden" onChange={handle} />
      </label>
      {value && <button type="button" className="btn-light !text-red-600" onClick={() => onChange('')} aria-label="Hapus bukti"><Trash2 size={14} /></button>}
    </div>
  );
}
