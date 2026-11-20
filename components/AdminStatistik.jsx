'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { Loader2, RefreshCw, Eye, Users, Smartphone, Monitor } from 'lucide-react';
import { getDb } from '../lib/firebase';
import { toStr } from '../lib/rutin';
import { SUMBER } from '../lib/statistik';

const RENTANG = [7, 14, 30, 90];
const num = (v) => Number(v) || 0;
const fmt = (n) => new Intl.NumberFormat('id-ID').format(n);
const jumlah = (list, k) => list.reduce((a, x) => a + x[k], 0);
const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function Kartu({ judul, nilai, sub, ikon: Ikon }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs text-slate-500"><Ikon size={14} /> {judul}</p>
      <p className="mt-1 text-2xl font-extrabold text-brand-800">{fmt(nilai)}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Baris({ label, nilai, total }) {
  const persen = total ? Math.round((nilai / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><span className="tabular-nums text-slate-600">{fmt(nilai)} · {persen}%</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-700" style={{ width: `${persen}%` }} /></div>
    </div>
  );
}

export default function AdminStatistik() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [rentang, setRentang] = useState(14);
  const [busy, setBusy] = useState(false);

  const muat = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      const s = await getDocs(query(collection(getDb(), 'stats_harian'), orderBy('tanggal', 'desc'), limit(90)));
      setRows(Object.fromEntries(s.docs.map((d) => [d.id, d.data()])));
    } catch (e) {
      setErr(e?.code === 'permission-denied'
        ? 'Akses ditolak. Aturan Firestore terbaru (firestore.rules) belum dipublikasikan di Firebase Console.'
        : `Gagal memuat statistik: ${e.message}`);
    }
    setBusy(false);
  }, []);
  useEffect(() => { muat(); }, [muat]);

  // 90 hari terakhir, hari tanpa data diisi 0
  const hari = useMemo(() => {
    if (!rows) return [];
    const now = new Date();
    const out = [];
    for (let i = 89; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const tgl = toStr(d);
      const r = rows[tgl] || {};
      const x = { tgl, d, kunjungan: num(r.kunjungan), unik: num(r.unik), hp: num(r.hp), desktop: num(r.desktop) };
      SUMBER.forEach(([id]) => { x[`src_${id}`] = num(r[`src_${id}`]); });
      out.push(x);
    }
    return out;
  }, [rows]);

  const daftar = hari.slice(-rentang);
  const hariIni = hari[hari.length - 1];
  const maks = Math.max(1, ...daftar.map((x) => x.kunjungan));
  const totalPerangkat = jumlah(daftar, 'hp') + jumlah(daftar, 'desktop');
  const totalSumber = SUMBER.reduce((a, [id]) => a + jumlah(daftar, `src_${id}`), 0);
  const kosong = rows && hari.every((x) => x.kunjungan === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
          {RENTANG.map((n) => (
            <button key={n} onClick={() => setRentang(n)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${rentang === n ? 'bg-brand-700 text-white' : 'hover:bg-slate-100'}`}>{n} hari</button>
          ))}
        </div>
        <button className="btn-light" onClick={muat} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Muat ulang</button>
      </div>

      {err && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{err}</p>}
      {!rows && !err && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand-700" /></div>}
      {kosong && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Belum ada data. Penghitungan dimulai setelah versi terbaru situs aktif dan aturan Firestore dipublikasikan. Kunjungan dari browser admin tidak dihitung.</p>}

      {rows && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kartu ikon={Eye} judul="Kunjungan hari ini" nilai={hariIni.kunjungan} sub={`${fmt(hariIni.unik)} pengunjung unik`} />
            <Kartu ikon={Eye} judul={`Kunjungan ${rentang} hari`} nilai={jumlah(daftar, 'kunjungan')} />
            <Kartu ikon={Users} judul={`Unik harian ${rentang} hari`} nilai={jumlah(daftar, 'unik')} sub="Orang yang sama bisa terhitung lagi di hari lain" />
            <Kartu ikon={Eye} judul="Rata-rata per hari" nilai={Math.round(jumlah(daftar, 'kunjungan') / daftar.length)} />
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="font-bold">Kunjungan per hari</h3>
            <p className="mb-3 text-xs text-slate-500"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-100 align-middle" />kunjungan <span className="ml-3 mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-700 align-middle" />bagian yang unik hari itu</p>
            <div className="overflow-x-auto pb-1">
              <div style={{ minWidth: daftar.length * 14 }}>
                <div className="flex h-40 items-end gap-1">
                  {daftar.map((x) => (
                    <div key={x.tgl} className="flex h-full flex-1 items-end" title={`${x.d.getDate()} ${NAMA_BLN[x.d.getMonth()]}: ${x.kunjungan} kunjungan, ${x.unik} unik`}>
                      <div className="relative w-full rounded-t bg-brand-100" style={{ height: `${(x.kunjungan / maks) * 100}%`, minHeight: x.kunjungan ? 2 : 0 }}>
                        <div className="absolute inset-x-0 bottom-0 rounded-t bg-brand-700" style={{ height: `${x.kunjungan ? Math.min(100, (x.unik / x.kunjungan) * 100) : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex gap-1">
                  {daftar.map((x, i) => (
                    <span key={x.tgl} className="flex-1 text-center text-[10px] text-slate-500">{rentang <= 14 || i % 5 === 0 || i === daftar.length - 1 ? x.d.getDate() : ''}</span>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Puncak: {fmt(maks)} kunjungan dalam sehari. Sentuh/arahkan kursor ke batang untuk rincian.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-bold">Perangkat ({rentang} hari)</h3>
              <Baris label="HP / tablet" nilai={jumlah(daftar, 'hp')} total={totalPerangkat} />
              <Baris label="Komputer" nilai={jumlah(daftar, 'desktop')} total={totalPerangkat} />
            </div>
            <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-bold">Asal pengunjung ({rentang} hari)</h3>
              {SUMBER.map(([id, label]) => <Baris key={id} label={label} nilai={jumlah(daftar, `src_${id}`)} total={totalSumber} />)}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-500">
            Cara hitung: 1 kunjungan = 1 sesi browser; “unik” = 1 per browser per hari. Tidak ada data pribadi yang disimpan. Browser yang pernah dipakai masuk admin tidak dihitung. Angka bersifat perkiraan (pengunjung yang memblokir skrip atau menolak penyimpanan browser tidak terhitung). Tautan dari WhatsApp biasanya tercatat sebagai “Langsung”; tambahkan <b>?src=wa</b> di akhir tautan yang Anda bagikan agar tercatat sebagai WhatsApp (fb, ig, tg untuk Facebook, Instagram, Telegram).
          </p>
        </>
      )}
    </div>
  );
}
