'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Repeat } from 'lucide-react';
import {
  akhirBulanHijriah, awalBulanHijriah, bandingBulan, bulanDari, bulanHijriahBerikut, bulanHijriahSebelum, geserBulan, hijriBulan, isiBulan, isiBulanHijriah,
} from '../lib/bulan';
import { BULAN_HIJRI, BULAN_NAMA, HARI_NAMA, hijri, parseTgl, polaTeks, tglHijriTeks } from '../lib/rutin';

const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HIJRI_SINGKAT = ['Muharram', 'Safar', 'Rab. Awal', 'Rab. Akhir', 'Jum. Awal', 'Jum. Akhir', 'Rajab', "Sya'ban", 'Ramadan', 'Syawal', "Dzul-Qa'dah", 'Dzul-Hijjah'];
// Label sengaja pendek: lebar <select> mengikuti opsi terpanjang, dan label panjang pernah membuat kalender terpotong di HP.
const GESER = [
  { v: '0', label: 'Umm al-Qura (bawaan)' },
  { v: '-1', label: 'Sehari lebih lambat' },
  { v: '1', label: 'Sehari lebih cepat' },
];
const KUNCI_GESER = 'kalender_geser_hijriah';
const MAKS_BULAN_DEPAN = 12;

const jamTeks = (e) => [e.jamMulai, e.jamSelesai].filter(Boolean).join(' – ');
const hariTgl = (s) => { const d = parseTgl(s); return d ? `${HARI_NAMA[d.getDay()]}, ${d.getDate()} ${BULAN_NAMA[d.getMonth()]} ${d.getFullYear()}` : '-'; };
const pad = (n) => String(n).padStart(2, '0');
const hijriRentang = (a, b, geser) => { // "Jumadil Akhir – Rajab 1448 H"
  const x = hijriBulan(a, geser); const y = hijriBulan(b, geser);
  if (!x || !y) return '';
  if (x.m === y.m && x.y === y.y) return `${BULAN_HIJRI[x.m - 1]} ${x.y} H`;
  return x.y === y.y ? `${BULAN_HIJRI[x.m - 1]} – ${BULAN_HIJRI[y.m - 1]} ${x.y} H` : `${BULAN_HIJRI[x.m - 1]} ${x.y} – ${BULAN_HIJRI[y.m - 1]} ${y.y} H`;
};
const rentangMasehi = (a, b) => {
  const x = parseTgl(a); const y = parseTgl(b);
  return x.getFullYear() === y.getFullYear()
    ? `${x.getDate()} ${BULAN_SINGKAT[x.getMonth()]} – ${y.getDate()} ${BULAN_SINGKAT[y.getMonth()]} ${y.getFullYear()}`
    : `${x.getDate()} ${BULAN_SINGKAT[x.getMonth()]} ${x.getFullYear()} – ${y.getDate()} ${BULAN_SINGKAT[y.getMonth()]} ${y.getFullYear()}`;
};

// Kalender bulanan: kegiatan sekali jalan + kegiatan rutin dalam satu grid, dengan tanggal Hijriah di tiap sel
// dan mode tampilan Masehi / Hijriah (grid per bulan Hijriah).
// Props: tunggal (events), rutin (aturan routine_events yang aktif), hariIni ('YYYY-MM-DD'),
//        awalData (tanggal paling awal yang datanya dimuat), aksi(item) → node tombol kalender/WhatsApp
export default function KalenderBulanan({ tunggal = [], rutin = [], hariIni, awalData, aksi, modeAwal = 'masehi' }) {
  const bulanIni = bulanDari(hariIni);
  const bulanMin = bulanDari(awalData) || bulanIni; // kegiatan sekali jalan lebih lama dari ini tidak dimuat
  const batasMaju = (() => { const b = geserBulan(bulanIni, MAKS_BULAN_DEPAN + 1); return `${b.y}-${pad(b.m)}-01`; })(); // eksklusif

  const [mode, setMode] = useState(modeAwal);
  const [geser, setGeser] = useState('0');
  const [bln, setBln] = useState(bulanIni);
  const [awalH, setAwalH] = useState(() => (modeAwal === 'hijriah' ? awalBulanHijriah(hariIni, 0) : null)); // tanggal Masehi untuk tanggal 1 bulan Hijriah yang ditampilkan
  const [pilih, setPilih] = useState(hariIni);

  const dukungHijri = useMemo(() => !!hijri(parseTgl(hariIni), 0), [hariIni]);
  useEffect(() => { try { const g = window.localStorage.getItem(KUNCI_GESER); if (['0', '-1', '1'].includes(g)) setGeser(g); } catch (e) { /* abaikan */ } }, []);

  const hijriMode = mode === 'hijriah' && dukungHijri && awalH;
  const dataM = useMemo(() => isiBulan(bln.y, bln.m, tunggal, rutin), [bln, tunggal, rutin]);
  const dataH = useMemo(() => (hijriMode ? isiBulanHijriah(awalH, geser, tunggal, rutin) : null), [hijriMode, awalH, geser, tunggal, rutin]);
  const { minggu, peta } = hijriMode ? dataH : dataM;

  const ubahMode = (m) => {
    if (m === 'hijriah') { const a = awalBulanHijriah(pilih, geser); if (!a) return; setAwalH(a); } else setBln(bulanDari(pilih));
    setMode(m);
  };
  const ubahGeser = (g) => {
    setGeser(g);
    try { window.localStorage.setItem(KUNCI_GESER, g); } catch (e) { /* abaikan */ }
    if (mode === 'hijriah') setAwalH(awalBulanHijriah(pilih, g));
  };

  // ---- navigasi ----
  const bisaMundur = hijriMode
    ? (() => { const s = bulanHijriahSebelum(awalH, geser); return !!s && akhirBulanHijriah(s, geser) >= awalData; })()
    : bandingBulan(geserBulan(bln, -1), bulanMin) >= 0;
  const bisaMaju = hijriMode ? bulanHijriahBerikut(awalH, geser) < batasMaju : bandingBulan(geserBulan(bln, 1), bulanIni) <= MAKS_BULAN_DEPAN;
  const pindah = (n) => {
    if (n < 0 ? !bisaMundur : !bisaMaju) return;
    if (hijriMode) {
      const a = n < 0 ? bulanHijriahSebelum(awalH, geser) : bulanHijriahBerikut(awalH, geser);
      setAwalH(a);
      setPilih(hariIni >= a && hariIni <= akhirBulanHijriah(a, geser) ? hariIni : a);
    } else {
      const b = geserBulan(bln, n);
      setBln(b);
      setPilih(bandingBulan(b, bulanIni) === 0 ? hariIni : `${b.y}-${pad(b.m)}-01`);
    }
  };
  const keHariIni = () => { setPilih(hariIni); if (hijriMode) setAwalH(awalBulanHijriah(hariIni, geser)); else setBln(bulanIni); };
  const diBulanIni = hijriMode ? hariIni >= awalH && hariIni <= dataH.akhirH : bandingBulan(bln, bulanIni) === 0;

  // ---- judul ----
  const judulUtama = hijriMode ? hijriRentang(awalH, dataH.akhirH, geser) : `${BULAN_NAMA[bln.m - 1]} ${bln.y}`;
  const judulKecil = hijriMode ? rentangMasehi(awalH, dataH.akhirH)
    : dukungHijri ? hijriRentang(`${bln.y}-${pad(bln.m)}-01`, `${bln.y}-${pad(bln.m)}-${pad(new Date(bln.y, bln.m, 0).getDate())}`, geser) : '';

  const daftar = peta[pilih] || [];
  const hijriPilih = dukungHijri ? tglHijriTeks(pilih, geser) : '';
  const nav = 'shrink-0 rounded-lg border border-slate-300 bg-white p-2 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40';
  const seg = (aktif) => `px-3 py-1.5 text-xs font-semibold sm:text-sm ${aktif ? 'bg-brand-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="min-w-0 rounded-card border bg-white p-2 sm:p-5 lg:col-span-2">
        {dukungHijri && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-slate-300" role="group" aria-label="Jenis kalender">
              <button type="button" className={seg(mode === 'masehi')} onClick={() => ubahMode('masehi')} aria-pressed={mode === 'masehi'}>Masehi</button>
              <button type="button" className={`border-l border-slate-300 ${seg(mode === 'hijriah')}`} onClick={() => ubahMode('hijriah')} aria-pressed={mode === 'hijriah'}>Hijriah</button>
            </div>
            <select aria-label="Koreksi kalender Hijriah" className="inp min-w-0 !w-full !py-1.5 text-xs sm:!w-auto sm:max-w-full" value={geser} onChange={(e) => ubahGeser(e.target.value)}>
              {GESER.map((g) => <option key={g.v} value={g.v}>Hijriah: {g.label}</option>)}
            </select>
          </div>
        )}

        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" className={nav} onClick={() => pindah(-1)} disabled={!bisaMundur} aria-label={hijriMode ? 'Bulan Hijriah sebelumnya' : 'Bulan sebelumnya'}><ChevronLeft size={18} /></button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-base font-bold leading-snug text-brand-800 sm:text-lg">{judulUtama}</p>
            {judulKecil && <p className="text-xs text-slate-500">{judulKecil}</p>}
            {!diBulanIni && <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={keHariIni}>Kembali ke hari ini</button>}
          </div>
          <button type="button" className={nav} onClick={() => pindah(1)} disabled={!bisaMaju} aria-label={hijriMode ? 'Bulan Hijriah berikutnya' : 'Bulan berikutnya'}><ChevronRight size={18} /></button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase text-slate-500 sm:gap-1 sm:text-xs sm:tracking-wide">
          {HARI_SINGKAT.map((h, i) => <div key={h} className={`min-w-0 ${i === 0 ? 'text-red-600' : ''}`}>{h}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-0.5 sm:gap-1" role="grid" aria-label={`Kalender ${judulUtama}`}>
          {minggu.flat().map((tgl, i) => {
            const d = parseTgl(tgl);
            const h = dukungHijri ? hijri(d, geser) : null;
            const dalam = hijriMode ? tgl >= awalH && tgl <= dataH.akhirH : d.getMonth() + 1 === bln.m;
            const aktif = (peta[tgl] || []).filter((x) => !x.libur);
            const dipilih = tgl === pilih;
            const hari = tgl === hariIni;
            // angka utama & angka kecil menyesuaikan mode; label bulan muncul di tanggal 1
            const utama = hijriMode ? (h ? h.d : d.getDate()) : d.getDate();
            const kecil = hijriMode ? (d.getDate() === 1 ? `1 ${BULAN_SINGKAT[d.getMonth()]}` : d.getDate()) : (h ? (h.d === 1 ? `1 ${HIJRI_SINGKAT[h.m - 1]}` : h.d) : null);
            const awalBulanBaru = hijriMode ? false : h?.d === 1;
            const kecilPendek = hijriMode ? d.getDate() : (h ? h.d : null); // HP: sel sempit, cukup angka
            const tebal = awalBulanBaru || (hijriMode && d.getDate() === 1);
            return (
              <button key={tgl} type="button" role="gridcell" aria-selected={dipilih}
                aria-label={`${hariTgl(tgl)}${h ? `, ${h.d} ${BULAN_HIJRI[h.m - 1]} ${h.y} H` : ''}${aktif.length ? `, ${aktif.length} kegiatan` : ''}`}
                onClick={() => setPilih(tgl)}
                className={`flex min-h-[3.6rem] min-w-0 flex-col items-stretch overflow-hidden rounded-lg border p-0.5 text-left transition sm:min-h-[5.8rem] sm:p-1.5 ${dipilih ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700' : 'border-slate-200 hover:bg-slate-50'} ${dalam ? '' : 'opacity-40'}`}>
                <span className="flex flex-col items-center sm:flex-row sm:items-start sm:justify-between sm:gap-1">
                  <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:text-sm ${hari ? 'bg-brand-700 text-white' : i % 7 === 0 ? 'text-red-600' : 'text-slate-700'}`}>{utama}</span>
                  {kecil !== null && (
                    <span className={`min-w-0 text-[10px] leading-3 sm:truncate sm:pt-0.5 sm:leading-4 ${tebal ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
                      <span className="sm:hidden">{kecilPendek}</span>
                      <span className="hidden sm:inline">{kecil}</span>
                    </span>
                  )}
                </span>
                {/* HP: titik penanda; layar lebar: judul singkat */}
                <span className="mt-auto flex flex-wrap justify-center gap-0.5 pt-1 sm:hidden">
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
          {dukungHijri && <span>{hijriMode ? 'Angka kecil = tanggal Masehi' : 'Angka kecil = tanggal Hijriah'}</span>}
        </div>
        {dukungHijri && <p className="mt-1 text-xs text-slate-400">Tanggal Hijriah dihitung dari tabel kalender (bukan hasil rukyat/sidang isbat) dan bisa berbeda sehari; penetapan Kemenag RI sering sehari lebih lambat, sesuaikan lewat pilihan koreksi di atas.</p>}
        {(hijriMode ? awalH <= awalData : bandingBulan(bln, bulanMin) === 0) && <p className="mt-1 text-xs text-slate-400">Kegiatan sekali jalan yang lebih lama dari 30 hari lalu tidak ditampilkan; kegiatan rutin tetap dihitung.</p>}
      </div>

      <div className="min-w-0 space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div>
          <p className="flex items-center gap-2 font-bold text-brand-800"><CalendarDays size={16} /> {hariTgl(pilih)}</p>
          {hijriPilih && <p className="pl-6 text-xs text-slate-500">{hijriPilih}</p>}
        </div>
        {daftar.length === 0 && <p className="rounded-card border bg-white p-5 text-center text-sm text-slate-500">Tidak ada kegiatan pada tanggal ini.</p>}
        {daftar.map((x) => (
          <div key={x.kunci} className={`rounded-card border bg-white p-4 text-sm ${x.libur ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <p className={`min-w-0 break-words font-bold ${x.libur ? 'line-through' : ''}`}>{x.judul}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${x.libur ? 'bg-slate-100 text-slate-600' : x.tipe === 'rutin' ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-800'}`}>
                {x.libur ? 'Ditiadakan' : x.tipe === 'rutin' ? 'Rutin' : 'Sekali jalan'}
              </span>
            </div>
            {x.tipe === 'rutin' && <p className="mt-0.5 flex items-center gap-1.5 font-medium text-brand-700"><Repeat size={13} /> {polaTeks(x.sumber)}</p>}
            {jamTeks(x) && <p className="mt-0.5 flex items-center gap-1.5 text-slate-500"><Clock size={13} /> {jamTeks(x)}</p>}
            {x.lokasi && <p className="flex items-center gap-1.5 text-slate-500"><MapPin size={13} /> {x.lokasi}</p>}
            <p className="mt-1.5 text-xs text-slate-500">{x.lembaga || 'Umum'}</p>
            {x.deskripsi && <p className="mt-2 whitespace-pre-line break-words text-slate-600">{x.deskripsi}</p>}
            {!x.libur && pilih >= hariIni && aksi?.(x)}
          </div>
        ))}
      </div>
    </div>
  );
}
