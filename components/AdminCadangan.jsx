'use client';

import { useEffect, useRef, useState } from 'react';
import { Timestamp, addDoc, collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { AlertTriangle, DatabaseBackup, Download, Loader2, Upload } from 'lucide-react';
import { getAuthInstance, getDb } from '../lib/firebase';
import { KOLEKSI, buatBerkas, hariSejak, hidupkan, namaBerkas, periksaBerkas, serial } from '../lib/cadangan';

const KUNCI = 'cadangan_terakhir';
const BATCH = 400; // batas Firestore 500 operasi per batch

export default function AdminCadangan({ isOwner = false }) {
  const daftar = KOLEKSI.filter((k) => !k.pemilik || isOwner);
  const [pilih, setPilih] = useState(() => Object.fromEntries(daftar.map((k) => [k.id, true])));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [terakhir, setTerakhir] = useState(null);
  const [berkas, setBerkas] = useState(null); // { nama, data, hasil }
  const [konfirmasi, setKonfirmasi] = useState('');
  const fileRef = useRef(null);

  useEffect(() => { try { setTerakhir(window.localStorage.getItem(KUNCI)); } catch (e) { /* abaikan */ } }, []);
  const umur = terakhir ? hariSejak(terakhir) : null;

  const unduh = async () => {
    setBusy(true); setStatus('');
    const hasil = {}; const gagal = [];
    try {
      for (const k of daftar.filter((x) => pilih[x.id])) {
        setStatus(`Membaca ${k.label}…`);
        try {
          const s = await getDocs(collection(getDb(), k.id));
          hasil[k.id] = s.docs.map((d) => ({ id: d.id, data: serial(d.data()) }));
        } catch (e) { gagal.push(`${k.label} (${e.code || e.message})`); }
      }
      const total = Object.values(hasil).reduce((n, a) => n + a.length, 0);
      const proyek = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
      const blob = new Blob([JSON.stringify(buatBerkas(hasil, proyek))], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = namaBerkas(); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const iso = new Date().toISOString();
      try { window.localStorage.setItem(KUNCI, iso); } catch (e) { /* abaikan */ }
      setTerakhir(iso);
      setStatus(`✅ Cadangan diunduh: ${total} dokumen, ${(blob.size / 1024).toFixed(0)} KB.${gagal.length ? ` ⚠️ Gagal dibaca: ${gagal.join(', ')}.` : ''} Simpan berkasnya di tempat aman (Google Drive / flashdisk).`);
    } catch (e) { setStatus('❌ Gagal membuat cadangan: ' + e.message); }
    setBusy(false);
  };

  const pilihBerkas = async (e) => {
    const f = e.target.files?.[0];
    setBerkas(null); setKonfirmasi(''); setStatus('');
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const hasil = periksaBerkas(data);
      if (!hasil.ok) { setStatus('❌ ' + hasil.galat); return; }
      setBerkas({ nama: f.name, data, hasil });
    } catch (err) { setStatus('❌ Berkas tidak bisa dibaca (bukan JSON yang valid).'); }
  };

  const pulihkan = async () => {
    if (!berkas || konfirmasi !== 'PULIHKAN') return;
    setBusy(true); setStatus('');
    let tulis = 0;
    try {
      const db = getDb();
      const ops = [];
      for (const r of berkas.hasil.ringkasan.filter((x) => x.pulihkan)) {
        for (const d of berkas.data.koleksi[r.id]) ops.push([r.id, d.id, hidupkan(d.data, Timestamp.fromMillis)]);
      }
      for (let i = 0; i < ops.length; i += BATCH) {
        setStatus(`Memulihkan… ${i}/${ops.length}`);
        const b = writeBatch(db);
        ops.slice(i, i + BATCH).forEach(([col, id, data]) => b.set(doc(db, col, id), data));
        await b.commit();
        tulis += Math.min(BATCH, ops.length - i);
      }
      // jejak audit (tidak bisa diubah) supaya pemulihan terlihat di Riwayat Kas
      try { await addDoc(collection(db, 'audit_log'), { koleksi: '(pemulihan)', aksi: `pulihkan ${ops.length} dokumen dari ${berkas.nama}`, docId: '-', sebelum: null, sesudah: null, oleh: getAuthInstance().currentUser?.email || '', waktu: serverTimestamp() }); } catch (e) { /* abaikan */ }
      setStatus(`✅ Selesai: ${ops.length} dokumen dipulihkan. Muat ulang halaman admin untuk melihat hasilnya.`);
      setBerkas(null); setKonfirmasi(''); if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setStatus(`❌ Pemulihan berhenti setelah ${tulis} dokumen: ${e.code || e.message}. Dokumen sebelumnya sudah tertulis; ulangi dengan berkas yang sama aman dilakukan.`);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      {(terakhir === null || (umur !== null && umur >= 30)) && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {terakhir === null ? 'Belum pernah mencadangkan dari perangkat ini.' : `Cadangan terakhir dari perangkat ini ${umur} hari lalu.`} Paket gratis Firebase (Spark) tidak punya cadangan otomatis, jadi unduh cadangan berkala, terutama data kas.
        </p>
      )}

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-brand-800"><DatabaseBackup size={18} /> Unduh cadangan</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {daftar.map((k) => (
            <label key={k.id} className="flex items-center gap-2">
              <input type="checkbox" checked={!!pilih[k.id]} onChange={(e) => setPilih((p) => ({ ...p, [k.id]: e.target.checked }))} /> {k.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500">Setiap dokumen yang dibaca dihitung 1 pembacaan Firestore (batas gratis 50.000/hari), jadi aman dilakukan beberapa kali sebulan.</p>
        <button className="btn" onClick={unduh} disabled={busy || !daftar.some((k) => pilih[k.id])}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Unduh cadangan (.json)
        </button>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-brand-800"><Upload size={18} /> Pulihkan dari cadangan</h2>
        <p className="text-sm text-slate-600">
          Dokumen di berkas <b>menimpa</b> dokumen ber-ID sama; dokumen lain yang tidak ada di berkas <b>tidak dihapus</b>. Riwayat kas dan daftar admin tidak dipulihkan. Pemulihan dicatat di Riwayat Kas.
        </p>
        <input ref={fileRef} type="file" accept="application/json,.json" className="text-sm" onChange={pilihBerkas} disabled={busy} />
        {berkas && (
          <div className="space-y-3 rounded-xl border p-3 text-sm">
            <p className="font-semibold">{berkas.nama} <span className="font-normal text-slate-500">· dibuat {new Date(berkas.data.dibuat).toLocaleString('id-ID')}{berkas.data.proyek ? ` · proyek ${berkas.data.proyek}` : ''}</span></p>
            {berkas.data.proyek && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && berkas.data.proyek !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && (
              <p className="rounded-md bg-amber-50 p-2 text-amber-900">⚠️ Cadangan ini berasal dari proyek Firebase lain ({berkas.data.proyek}).</p>
            )}
            <ul className="grid gap-1 sm:grid-cols-2">
              {berkas.hasil.ringkasan.map((r) => (
                <li key={r.id} className={r.pulihkan ? '' : 'text-slate-400 line-through'}>{r.label}: <b>{r.jumlah}</b>{!r.pulihkan && ' (dilewati)'}</li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <input className="inp !w-48" placeholder="Ketik PULIHKAN" value={konfirmasi} onChange={(e) => setKonfirmasi(e.target.value)} />
              <button className="btn !bg-red-700 hover:!bg-red-800" onClick={pulihkan} disabled={busy || konfirmasi !== 'PULIHKAN'}>
                {busy && <Loader2 size={14} className="animate-spin" />} Pulihkan sekarang
              </button>
            </div>
          </div>
        )}
      </section>
      {status && <p className="text-sm text-slate-700">{status}</p>}
    </div>
  );
}
