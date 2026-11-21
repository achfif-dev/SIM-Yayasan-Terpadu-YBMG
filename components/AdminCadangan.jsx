'use client';

import { useEffect, useRef, useState } from 'react';
import { Timestamp, collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { AlertTriangle, DatabaseBackup, Download, Loader2, Upload } from 'lucide-react';
import { getDb } from '../lib/firebase';
import { isiLog, refLog } from '../lib/audit';
import { simpanRingkasan } from '../lib/ringkasan';
import { clearCache } from '../lib/hemat';
import { KOLEKSI, buatBerkas, hariSejak, namaBerkas, periksaBerkas, serial, susunOperasi } from '../lib/cadangan';

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
          const arr = [];
          for (const d of s.docs) {
            const item = { id: d.id, data: serial(d.data()) };
            if (k.sub) { // mis. kas kegiatan: panitia/<id>/kas
              const ss = await getDocs(collection(getDb(), k.id, d.id, k.sub));
              item[k.sub] = ss.docs.map((x) => ({ id: x.id, data: serial(x.data()) }));
            }
            arr.push(item);
          }
          hasil[k.id] = arr;
        } catch (e) { gagal.push(`${k.label} (${e.code || e.message})`); }
      }
      const total = Object.entries(hasil).reduce((n, [kid, a]) => { const sub = KOLEKSI.find((x) => x.id === kid)?.sub; return n + a.length + (sub ? a.reduce((m, d) => m + (d[sub]?.length || 0), 0) : 0); }, 0);
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
      const ops = susunOperasi(berkas.data, Timestamp.fromMillis);
      for (let i = 0; i < ops.length; i += BATCH) {
        setStatus(`Memulihkan… ${i}/${ops.length}`);
        const b = writeBatch(db);
        ops.slice(i, i + BATCH).forEach((o) => b.set(doc(db, ...o.path), o.data));
        await b.commit();
        tulis += Math.min(BATCH, ops.length - i);
      }
      // jejak audit (tidak bisa diubah): rincian jumlah per koleksi, supaya terlihat apa saja yang ditimpa
      const perKoleksi = {};
      ops.forEach((o) => { perKoleksi[o.path[0]] = (perKoleksi[o.path[0]] || 0) + 1; });
      try { await writeBatch(db).set(refLog(), isiLog({ koleksi: '(pemulihan)', aksi: `pulihkan ${ops.length} dokumen dari ${berkas.nama}`, docId: '-', sesudah: perKoleksi })).commit(); } catch (e) { /* abaikan */ }
      // Saldo beranda dibaca dari settings/ringkasanKas: bangun ulang dari transaksi hasil pemulihan agar tidak selisih
      let infoRingkasan = '';
      if (perKoleksi.transactions || perKoleksi.settings) {
        try {
          const t = await getDocs(collection(db, 'transactions'));
          await simpanRingkasan(t.docs.map((x) => ({ id: x.id, ...x.data() })));
          clearCache();
          infoRingkasan = ' Ringkasan kas beranda sudah dibangun ulang.';
        } catch (e) { infoRingkasan = ' ⚠️ Ringkasan kas gagal dibangun ulang: buka Admin → Kas → Bangun ulang ringkasan.'; }
      }
      setStatus(`✅ Selesai: ${ops.length} dokumen dipulihkan.${infoRingkasan} Muat ulang halaman admin untuk melihat hasilnya.`);
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
        <p className="text-xs text-slate-500">Setiap dokumen yang dibaca (termasuk catatan kas kegiatan) dihitung 1 pembacaan Firestore (batas gratis 50.000/hari), jadi aman dilakukan beberapa kali sebulan. Foto nota yang tersimpan di Cloudinary tidak ikut terunduh; yang ikut hanya tautannya. <b>Berkas cadangan memuat nomor WhatsApp donatur dan tidak terenkripsi</b>: simpan hanya di tempat pribadi yang aman dan jangan dikirim lewat chat.</p>
        <button className="btn" onClick={unduh} disabled={busy || !daftar.some((k) => pilih[k.id])}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Unduh cadangan (.json)
        </button>
      </section>

      {isOwner ? (
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
                <li key={r.id} className={r.pulihkan ? '' : 'text-slate-400 line-through'}>{r.label}: <b>{r.jumlah}</b>{r.sub > 0 && ` + ${r.sub} catatan ${r.subNama}`}{!r.pulihkan && ' (dilewati)'}</li>
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
      ) : (
        <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">Pemulihan dari cadangan hanya tersedia untuk pemilik, karena menimpa data kas dan dokumen lain tanpa jejak per dokumen.</p>
      )}
      {status && <p className="text-sm text-slate-700">{status}</p>}
    </div>
  );
}
