'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Repeat } from 'lucide-react';
import { bandingBulan, bulanDari, geserBulan, isiBulan } from '../lib/bulan';
import { BULAN_NAMA, HARI_NAMA, parseTgl, polaTeks, tglHijriTeks } from '../lib/rutin';

const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MAKS_BULAN_DEPAN = 12;
const jamTeks = (e) => [e.jamMulai, e.jamSelesai].filter(Boolean).join(' – ');
const hariTgl = (s) => { const d = parseTgl(s); return d ? `${HARI_NAMA[d.getDay()]}, ${d.getDate()} ${BULAN_NAMA[d.getMonth()]} ${d.getFullYear()}` : '-'; };

// Kalender bulanan: kegiatan sekali jalan + kegiatan rutin dalam satu grid.
// Props: tunggal (events), rutin (aturan routine_events yang aktif), hariIni ('YYYY-MM-DD'),
//        awalData (tanggal paling awal yang datanya dimuat), aksi(item) → node tombol kalender/WhatsApp
export default function KalenderBulanan({ tunggal = [], rutin = [], hariIni, awalData, aksi }) {
  const bulanIni = bulanDari(hariIni);
  const bulanMin = bulanDari(awalData) || bulanIni; // kegiatan sekali jalan lebih lama dari ini tidak dimuat
  const [bln, setBln] = useState(bulanIni);
  const [pilih, setPilih] = useState(hariIni);

  const { minggu, peta } = useMemo(() => isiBulan(bln.y, bln.m, tunggal, rutin), [bln, tunggal, rutin]);

  const pindah = (n) => {
    const baru = geserBulan(bln, n);
    if (bandingBulan(baru, bulanMin) < 0 || bandingBulan(baru, bulanIni) > MAKS_BULAN_DEPAN) return;
    setBln(baru);
    setPilih(bandingBulan(baru, bulanIni) === 0 ? hariIni : `${baru.y}-${String(baru.m).padStart(2, '0')}-01`);
  };
  const keHariIni = () => { setBln(bulanIni); setPilih(hariIni); };

  const daftar = peta[pilih] || [];
  const hijri = tglHijriTeks(pilih);
  const bisaMundur = bandingBulan(geserBulan(bln, -1), bulanMin) >= 0;
  const bisaMaju = bandingBulan(geserBulan(bln, 1), bulanIni) <= MAKS_BULAN_DEPAN;
  const nav = 'rounded-lg border border-slate-300 bg-white p-2 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-card border bg-white p-3 sm:p-5 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" className={nav} onClick={() => pindah(-1)} disabled={!bisaMundur} aria-label="Bulan sebelumnya"><ChevronLeft size={18} /></button>
          <div className="text-center">
            <p className="text-lg font-bold text-brand-800">{BULAN_NAMA[bln.m - 1]} {bln.y}</p>
            {bandingBulan(bln, bulanIni) !== 0 && <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={keHariIni}>Kembali ke hari ini</button>}
          </div>
          <button type="button" className={nav} onClick={() => pindah(1)} disabled={!bisaMaju} aria-label="Bulan berikutnya"><ChevronRight size={18} /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          {HARI_SINGKAT.map((h, i) => <div key={h} className={i === 0 ? 'text-red-600' : ''}>{h}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label={`Kalender ${BULAN_NAMA[bln.m - 1]} ${bln.y}`}>
          {minggu.flat().map((tgl, i) => {
            const d = parseTgl(tgl);
            const dalam = d.getMonth() + 1 === bln.m;
            const item = (peta[tgl] || []);
            const aktif = item.filter((x) => !x.libur);
            const dipilih = tgl === pilih;
            const hari = tgl === hariIni;
            return (
              <button key={tgl} type="button" role="gridcell" aria-selected={dipilih} aria-label={`${hariTgl(tgl)}${aktif.length ? `, ${aktif.length} kegiatan` : ''}`}
                onClick={() => setPilih(tgl)}
                className={`flex min-h-[3.4rem] flex-col items-stretch rounded-lg border p-1 text-left transition sm:min-h-[5.6rem] sm:p-1.5 ${dipilih ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700' : 'border-slate-200 hover:bg-slate-50'} ${dalam ? '' : 'opacity-40'}`}>
                <span className={`inline-flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-semibold sm:text-sm ${hari ? 'bg-brand-700 text-white' : i % 7 === 0 ? 'text-red-600' : 'text-slate-700'}`}>{d.getDate()}</span>
                {/* HP: titik penanda; layar lebar: judul singkat */}
                <span className="mt-auto flex flex-wrap gap-0.5 pt-1 sm:hidden">
                  {aktif.slice(0, 4).map((x) => <span key={x.kunci} className={`h-1.5 w-1.5 rounded-full ${x.tipe === 'rutin' ? 'bg-amber-500' : 'bg-brand-700'}`} />)}
                </span>
                <span className="mt-1 hidden space-y-0.5 sm:block">
                  {aktif.slice(0, 2).map((x) => (
                    <span key={x.kunci} className={`block truncate rounded px-1 text-[11px] leading-4 ${x.tipe === 'rutin' ? 'bg-amber-100 text-amber-900' : 'bg-brand-100 text-brand-900'}`}>{x.jamMulai ? `${x.jamMulai} ` : ''}{x.judul}</span>
                  ))}
                  {aktif.length > 2 && <span className="block px-1 text-[11px] font-semibold text-slate-500">+{aktif.length - 2} lagi</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-700" /> Kegiatan sekali jalan</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Kegiatan rutin</span>
        </div>
        {bandingBulan(bln, bulanMin) === 0 && <p className="mt-2 text-xs text-slate-400">Kegiatan sekali jalan yang lebih lama dari 30 hari lalu tidak ditampilkan; kegiatan rutin tetap dihitung.</p>}
      </div>

      <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div>
          <p className="flex items-center gap-2 font-bold text-brand-800"><CalendarDays size={16} /> {hariTgl(pilih)}</p>
          {hijri && <p className="pl-6 text-xs text-slate-400">{hijri}</p>}
        </div>
        {daftar.length === 0 && <p className="rounded-card border bg-white p-5 text-center text-sm text-slate-500">Tidak ada kegiatan pada tanggal ini.</p>}
        {daftar.map((x) => (
          <div key={x.kunci} className={`rounded-card border bg-white p-4 text-sm ${x.libur ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <p className={`font-bold ${x.libur ? 'line-through' : ''}`}>{x.judul}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${x.libur ? 'bg-slate-100 text-slate-600' : x.tipe === 'rutin' ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-800'}`}>
                {x.libur ? 'Ditiadakan' : x.tipe === 'rutin' ? 'Rutin' : 'Sekali jalan'}
              </span>
            </div>
            {x.tipe === 'rutin' && <p className="mt-0.5 flex items-center gap-1.5 font-medium text-brand-700"><Repeat size={13} /> {polaTeks(x.sumber)}</p>}
            {jamTeks(x) && <p className="mt-0.5 flex items-center gap-1.5 text-slate-500"><Clock size={13} /> {jamTeks(x)}</p>}
            {x.lokasi && <p className="flex items-center gap-1.5 text-slate-500"><MapPin size={13} /> {x.lokasi}</p>}
            <p className="mt-1.5 text-xs text-slate-500">{x.lembaga || 'Umum'}</p>
            {x.deskripsi && <p className="mt-2 whitespace-pre-line text-slate-600">{x.deskripsi}</p>}
            {!x.libur && pilih >= hariIni && aksi?.(x)}
          </div>
        ))}
      </div>
    </div>
  );
}
