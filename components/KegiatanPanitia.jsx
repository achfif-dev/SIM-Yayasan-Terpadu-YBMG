'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Copy, Loader2, MessageCircle, Plus, Save, Trash2 } from 'lucide-react';
import { getDb } from '../lib/firebase';
import { bukaWA, salinTeks } from '../lib/bagikan';
import { kelompokSeksi, newId, teksStruktur } from '../lib/kegiatan';
import { pdfStruktur } from '../lib/pdfdoc';
import PdfAksi from './PdfAksi';

export default function KegiatanPanitia({ k, profil, onSaved }) {
  const [rows, setRows] = useState(k.struktur || []);
  const [seksiBaru, setSeksiBaru] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { setRows(k.struktur || []); }, [k.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ubah = (id, patch) => setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const hapus = (id) => setRows((p) => p.filter((r) => r.id !== id));
  const tambah = (seksi, jabatan = 'Anggota') => setRows((p) => [...p, { id: newId(), seksi, jabatan, nama: '' }]);
  const ganti = (lama, baru) => setRows((p) => p.map((r) => (r.seksi === lama ? { ...r, seksi: baru } : r)));
  const hapusSeksi = (seksi) => { if (confirm(`Hapus seksi "${seksi}" beserta seluruh anggotanya?`)) setRows((p) => p.filter((r) => r.seksi !== seksi)); };
  const groups = useMemo(() => kelompokSeksi(rows), [rows]);

  const simpan = async () => {
    setBusy(true);
    setMsg('');
    try {
      const bersih = rows.map((r) => ({ id: r.id, seksi: String(r.seksi || '').trim() || 'Lainnya', jabatan: String(r.jabatan || '').trim(), nama: String(r.nama || '').trim() }));
      await updateDoc(doc(getDb(), 'panitia', k.id), { struktur: bersih });
      setRows(bersih);
      setMsg('Tersimpan ✓');
      await onSaved?.();
    } catch (e) { setMsg(`Gagal: ${e.message}`); }
    setBusy(false);
  };

  const kk = { ...k, struktur: rows };
  const teks = teksStruktur({ k: kk, yayasan: profil.namaYayasan, statusHukum: profil.statusHukum });
  const versi = JSON.stringify(rows.map((r) => [r.seksi, r.jabatan, r.nama]));

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">Isi nama pada tiap jabatan. Baris yang namanya kosong tidak ikut tampil di teks/PDF. Jabatan <b>Ketua Panitia</b> dan <b>Bendahara</b> otomatis dipakai sebagai penandatangan laporan.</p>
      {groups.map((g, gi) => (
        <div key={gi} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <input className="inp font-semibold" value={g.seksi} onChange={(e) => ganti(g.seksi, e.target.value)} aria-label="Nama seksi" />
            <button type="button" className="btn-light !text-red-600" onClick={() => hapusSeksi(g.seksi)} aria-label="Hapus seksi"><Trash2 size={14} /></button>
          </div>
          {g.anggota.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_auto] items-start gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
              <input className="inp" placeholder="Jabatan" value={r.jabatan} onChange={(e) => ubah(r.id, { jabatan: e.target.value })} />
              <input className="inp col-span-2 sm:col-span-1 sm:order-none order-last" placeholder="Nama" value={r.nama} onChange={(e) => ubah(r.id, { nama: e.target.value })} />
              <button type="button" className="btn-light" onClick={() => hapus(r.id)} aria-label="Hapus baris"><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="btn-light" onClick={() => tambah(g.seksi)}><Plus size={14} /> Tambah anggota</button>
        </div>
      ))}
      <div className="flex gap-2">
        <input className="inp" placeholder="Nama seksi baru, mis. Seksi Kebersihan" value={seksiBaru} onChange={(e) => setSeksiBaru(e.target.value)} />
        <button type="button" className="btn-light whitespace-nowrap" disabled={!seksiBaru.trim()} onClick={() => { tambah(seksiBaru.trim(), 'Koordinator'); setSeksiBaru(''); }}><Plus size={14} /> Seksi</button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn" onClick={simpan} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan susunan panitia</button>
        <span className="text-sm text-slate-500">{msg}</span>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-bold">Bagikan susunan panitia</h3>
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">{teks}</pre>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => bukaWA(teks)}><MessageCircle size={14} /> Kirim lewat WhatsApp</button>
          <button type="button" className="btn-light" onClick={async () => setMsg((await salinTeks(teks)) ? 'Teks disalin ✓' : 'Gagal menyalin')}><Copy size={14} /> Salin teks</button>
        </div>
        <PdfAksi buat={() => pdfStruktur({ profil, k: kk })} teks={teks} versi={versi} label="Buat PDF susunan panitia" />
      </div>
    </div>
  );
}
