'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { CalendarDays, Clock, Image as ImageIcon, MapPin, Megaphone, Pin, X, ChevronLeft, ChevronRight, Loader2, Repeat } from 'lucide-react';
import { getDb } from '../lib/firebase';
import { optimizeUrl } from '../lib/cdn';
import { CACHE_TTL, cached, useInView } from '../lib/hemat';
import { BULAN, BULAN_SINGKAT } from '../lib/laporan';
import { KELOMPOK, berikutnya, berikutnyaTanpaLibur, pengecualianTeks, polaTeks, tglHijriTeks } from '../lib/rutin';

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const ANN_LIMIT = 12;
const GAL_LIMIT = 12;
const PAGE = 12; // jumlah tambahan per klik "Muat lebih lama"

const pad = (n) => String(n).padStart(2, '0');
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parts = (s) => { const [y, m, d] = String(s || '').split('-').map(Number); return y && m && d ? { y, m, d } : null; };
const tglPanjang = (s) => { const p = parts(s); return p ? `${p.d} ${BULAN[p.m - 1]} ${p.y}` : '-'; };
const hariTgl = (s) => { const p = parts(s); return p ? `${HARI[new Date(p.y, p.m - 1, p.d).getDay()]}, ${tglPanjang(s)}` : '-'; };
const jam = (e) => [e.jamMulai, e.jamSelesai].filter(Boolean).join(' – ');

function Modal({ onClose, children }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative max-h-full w-full max-w-2xl overflow-y-auto rounded-card bg-white" onClick={(e) => e.stopPropagation()}>
        <button className="absolute right-3 top-3 z-10 rounded-full bg-white p-1 shadow" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        {children}
      </div>
    </div>
  );
}

const Tag = ({ children }) => <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800">{children}</span>;

export default function Konten({ institutions = [], showBerita = true, showGaleri = true }) {
  const [ann, setAnn] = useState([]);
  const [evt, setEvt] = useState([]);
  const [gal, setGal] = useState([]);
  const [rtn, setRtn] = useState([]);
  const [rtnAll, setRtnAll] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lembaga, setLembaga] = useState('Semua');
  const [annShow, setAnnShow] = useState(6);
  const [galShow, setGalShow] = useState(12);
  const [annMore, setAnnMore] = useState(false);
  const [galMore, setGalMore] = useState(false);
  const [moreBusy, setMoreBusy] = useState('');
  const [moreErr, setMoreErr] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [detail, setDetail] = useState(null);
  const [light, setLight] = useState(null);

  // Muat konten hanya saat bagian ini mendekati layar, dan cache 10 menit di browser
  const sentinel = useRef(null);
  const near = useInView(sentinel, showBerita || showGaleri);

  useEffect(() => {
    if (!near) return undefined;
    let alive = true;
    (async () => {
      const key = `konten-v3-${showBerita ? 1 : 0}${showGaleri ? 1 : 0}`;
      const data = await cached(key, CACHE_TTL, async () => {
        const db = getDb();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const none = Promise.resolve({ docs: [] });
        const rs = await Promise.allSettled([
          showBerita ? getDocs(query(collection(db, 'announcements'), orderBy('tanggal', 'desc'), limit(ANN_LIMIT))) : none,
          showBerita ? getDocs(query(collection(db, 'events'), where('tanggal', '>=', toStr(cutoff)), orderBy('tanggal', 'asc'))) : none,
          showGaleri ? getDocs(query(collection(db, 'gallery'), orderBy('tanggal', 'desc'), limit(GAL_LIMIT))) : none,
          // aturan kegiatan rutin: jumlahnya kecil (1 dokumen per aturan), tanpa indeks tambahan
          showBerita ? getDocs(collection(db, 'routine_events')) : none,
        ]);
        const rows = (r) => (r.status === 'fulfilled' ? r.value.docs.map((d) => ({ id: d.id, ...d.data() })) : []);
        rs.forEach((r) => { if (r.status === 'rejected') console.error('Gagal memuat konten:', r.reason); });
        const a = rows(rs[0]);
        const g = rows(rs[2]);
        return { ann: a, evt: rows(rs[1]), gal: g, rtn: rows(rs[3]), annMore: a.length >= ANN_LIMIT, galMore: g.length >= GAL_LIMIT, ok: rs.every((r) => r.status === 'fulfilled') };
      }, (v) => v.ok);
      if (!alive) return;
      setAnn(data.ann);
      setEvt(data.evt);
      setGal(data.gal);
      setRtn(data.rtn || []);
      setAnnMore(!!data.annMore);
      setGalMore(!!data.galMore);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [near, showBerita, showGaleri]);

  // Filter lembaga bekerja pada data yang sudah dimuat; item lama dimuat per halaman (tanpa indeks tambahan)
  const fetchMore = async (kind) => {
    const isAnn = kind === 'ann';
    const col = isAnn ? 'announcements' : 'gallery';
    const list = isAnn ? ann : gal;
    const last = list[list.length - 1];
    if (!last || moreBusy) return;
    setMoreBusy(kind);
    setMoreErr('');
    try {
      const db = getDb();
      const lastSnap = await getDoc(doc(db, col, last.id));
      const cursor = lastSnap.exists() ? lastSnap : last.tanggal;
      const snap = await getDocs(query(collection(db, col), orderBy('tanggal', 'desc'), startAfter(cursor), limit(PAGE)));
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (isAnn) { setAnn((p) => [...p, ...rows]); setAnnMore(rows.length === PAGE); setAnnShow((n) => n + PAGE); }
      else { setGal((p) => [...p, ...rows]); setGalMore(rows.length === PAGE); setGalShow((n) => n + PAGE); }
    } catch (err) {
      console.error('Gagal memuat data lama:', err);
      setMoreErr('Gagal memuat data yang lebih lama. Coba lagi.');
    }
    setMoreBusy('');
  };
  const moreBtn = (kind, label) => (
    <div className="text-center">
      <button className="btn-light" disabled={!!moreBusy} onClick={() => fetchMore(kind)}>{moreBusy === kind ? 'Memuat…' : label}</button>
      {moreErr && <p className="mt-2 text-sm text-red-600">{moreErr}</p>}
    </div>
  );

  const match = (x) => lembaga === 'Semua' || (lembaga === 'Umum' ? !x.lembaga : x.lembaga === lembaga);
  const today = toStr(new Date());

  const annList = ann.filter(match).sort((a, b) =>
    (b.sematkan === 'Ya') - (a.sematkan === 'Ya') || String(b.tanggal).localeCompare(String(a.tanggal)));
  const upcoming = evt.filter(match).filter((e) => e.tanggal >= today).sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || String(a.jamMulai || '').localeCompare(String(b.jamMulai || '')));
  const past = evt.filter(match).filter((e) => e.tanggal < today).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  const galList = gal.filter(match);
  // Kegiatan rutin: hitung kemunculan berikutnya di browser, urut dari yang paling dekat
  const rutin = rtn.filter((r) => r.aktif !== 'Tidak').filter(match)
    .map((r) => ({ ...r, next: berikutnya(r, today) })).filter((r) => r.next)
    .sort((a, b) => a.next.localeCompare(b.next) || String(a.jamMulai || '').localeCompare(String(b.jamMulai || '')));

  const names = institutions.map((i) => i.namaLembaga).filter(Boolean).sort();
  const Filter = (
    <select aria-label="Filter lembaga" className="inp !w-auto" value={lembaga} onChange={(e) => { setLembaga(e.target.value); setAnnShow(6); setGalShow(12); }}>
      <option value="Semua">Semua lembaga</option>
      <option value="Umum">Umum (yayasan)</option>
      {names.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );

  const loading = <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Memuat…</p>;

  return (
    <>
      <div ref={sentinel} aria-hidden />
      {showBerita && (
<section id="berita" className="mx-auto max-w-content px-4 py-16">
        <h2 className="flex items-center justify-center gap-2 text-2xl font-bold"><Megaphone /> Berita &amp; Kegiatan</h2>
        <div className="mt-6 flex justify-center">{Filter}</div>

        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <h3 className="font-bold text-brand-800">Pengumuman</h3>
            {!loaded ? loading : annList.length === 0 && <p className="rounded-card border bg-white p-6 text-center text-sm text-slate-500">{annMore ? 'Belum ada pengumuman di data terbaru.' : 'Belum ada pengumuman.'}</p>}
            {annList.slice(0, annShow).map((a) => (
              <article key={a.id} className="flex flex-col overflow-hidden rounded-card border bg-white sm:flex-row">
                {a.gambarUrl && <img src={optimizeUrl(a.gambarUrl, 500)} alt="" loading="lazy" className="h-44 w-full object-cover sm:h-auto sm:w-48" />}
                <div className="flex-1 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {a.sematkan === 'Ya' && <span className="flex items-center gap-1 font-semibold text-amber-600"><Pin size={12} /> Penting</span>}
                    <Tag>{a.lembaga || 'Umum'}</Tag>
                    <span>{tglPanjang(a.tanggal)}</span>
                  </div>
                  <h4 className="mt-2 font-bold">{a.judul}</h4>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-slate-600">{a.isi}</p>
                  <button className="mt-3 text-sm font-semibold text-brand-700 hover:underline" onClick={() => setDetail(a)}>Baca selengkapnya</button>
                </div>
              </article>
            ))}
            {annList.length > annShow
              ? <div className="text-center"><button className="btn-light" onClick={() => setAnnShow((n) => n + 6)}>Tampilkan lebih banyak</button></div>
              : annMore && moreBtn('ann', 'Muat pengumuman lebih lama')}
          </div>

          <aside className="space-y-4">
            <h3 className="font-bold text-brand-800">Jadwal Kegiatan</h3>
            {!loaded ? loading : upcoming.length === 0 && <p className="rounded-card border bg-white p-6 text-center text-sm text-slate-500">Belum ada kegiatan mendatang.</p>}
            {upcoming.map((e) => <EventCard key={e.id} e={e} />)}
            {past.length > 0 && (
              <div>
                <button className="text-sm font-semibold text-brand-700 hover:underline" onClick={() => setShowPast(!showPast)}>
                  {showPast ? 'Sembunyikan' : 'Lihat'} kegiatan yang sudah lewat ({past.length})
                </button>
                {showPast && <div className="mt-3 space-y-4 opacity-70">{past.map((e) => <EventCard key={e.id} e={e} />)}</div>}
              </div>
            )}
            {loaded && rutin.length > 0 && (
              <div className="space-y-4 pt-4">
                <h3 className="flex items-center gap-2 font-bold text-brand-800"><Repeat size={16} /> Kegiatan Rutin</h3>
                {KELOMPOK.map((k) => {
                  const list = rutin.filter((r) => k.anggota.includes(r.frekuensi));
                  if (!list.length) return null;
                  const batas = rtnAll ? list.length : 4;
                  return (
                    <div key={k.id} className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{k.label}</p>
                      {list.slice(0, batas).map((r) => <RutinCard key={r.id} r={r} today={today} />)}
                      {list.length > batas && <button className="text-sm font-semibold text-brand-700 hover:underline" onClick={() => setRtnAll(true)}>Tampilkan semua {k.label.toLowerCase()} ({list.length})</button>}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </section>
)}

      {showGaleri && (
<section id="galeri" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-content">
          <h2 className="flex items-center justify-center gap-2 text-2xl font-bold"><ImageIcon /> Galeri Kegiatan</h2>
          <div className="mt-6 flex justify-center">{Filter}</div>
          {!loaded ? loading : galList.length === 0 && <p className="mt-10 text-center text-slate-500">{galMore ? 'Belum ada foto di data terbaru.' : 'Belum ada foto.'}</p>}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {galList.slice(0, galShow).map((g, i) => (
              <button key={g.id} onClick={() => setLight(i)} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                <img src={optimizeUrl(g.gambarUrl, 600)} alt={g.keterangan || 'Foto kegiatan'} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                {g.keterangan && <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/70 to-transparent p-2 text-left text-xs text-white">{g.keterangan}</span>}
              </button>
            ))}
          </div>
          {galList.length > galShow
            ? <div className="mt-6 text-center"><button className="btn-light" onClick={() => setGalShow((n) => n + 12)}>Tampilkan lebih banyak</button></div>
            : galMore && <div className="mt-6">{moreBtn('gal', 'Muat foto lebih lama')}</div>}
        </div>
      </section>
)}

      {detail && (
        <Modal onClose={() => setDetail(null)}>
          {detail.gambarUrl && <img src={optimizeUrl(detail.gambarUrl, 1200)} alt="" className="max-h-80 w-full object-cover" />}
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><Tag>{detail.lembaga || 'Umum'}</Tag><span>{tglPanjang(detail.tanggal)}</span></div>
            <h3 className="mt-2 text-xl font-bold">{detail.judul}</h3>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-700">{detail.isi}</p>
          </div>
        </Modal>
      )}

      {light !== null && galList[light] && (
        <Lightbox list={galList.slice(0, galShow)} index={light} setIndex={setLight} />
      )}
    </>
  );
}

function EventCard({ e }) {
  const p = parts(e.tanggal);
  return (
    <div className="flex gap-4 rounded-card border bg-white p-4">
      <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-700 text-white">
        <span className="text-xl font-extrabold leading-none">{p ? p.d : '-'}</span>
        <span className="text-xs uppercase">{p ? BULAN_SINGKAT[p.m - 1] : ''}</span>
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">{e.judul}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-slate-500"><CalendarDays size={13} /> {hariTgl(e.tanggal)}</p>
        {jam(e) && <p className="flex items-center gap-1.5 text-slate-500"><Clock size={13} /> {jam(e)}</p>}
        {e.lokasi && <p className="flex items-center gap-1.5 text-slate-500"><MapPin size={13} /> {e.lokasi}</p>}
        <div className="mt-1.5"><Tag>{e.lembaga || 'Umum'}</Tag></div>
        {e.deskripsi && <p className="mt-2 whitespace-pre-line text-slate-600">{e.deskripsi}</p>}
      </div>
    </div>
  );
}

function RutinCard({ r, today }) {
  const hariIni = r.next === today;
  const hijriah = String(r.frekuensi).startsWith('hijriah');
  // Jadwal normal yang jatuh pada tanggal pengecualian (libur) → beri tahu pengunjung
  const normal = berikutnyaTanpaLibur(r, today);
  const libur = normal && normal !== r.next ? normal : '';
  return (
    <div className="rounded-card border bg-white p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold">{r.judul}</p>
        {hariIni && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Hari ini</span>}
      </div>
      <p className="mt-0.5 flex items-center gap-1.5 font-medium text-brand-700"><Repeat size={13} /> {polaTeks(r)}</p>
      {jam(r) && <p className="mt-0.5 flex items-center gap-1.5 text-slate-500"><Clock size={13} /> {jam(r)}</p>}
      {r.lokasi && <p className="flex items-center gap-1.5 text-slate-500"><MapPin size={13} /> {r.lokasi}</p>}
      {!hariIni && <p className="flex items-center gap-1.5 text-slate-500"><CalendarDays size={13} /> Berikutnya: {hariTgl(r.next)}</p>}
      {hijriah && tglHijriTeks(r.next, r.geserHijri) && <p className="pl-5 text-xs text-slate-400">{tglHijriTeks(r.next, r.geserHijri)}</p>}
      {libur && <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">Ditiadakan pada {hariTgl(libur)}</p>}
      {!libur && r.liburRamadan === 'Ya' && pengecualianTeks(r) && <p className="mt-1 text-xs text-slate-400">{pengecualianTeks(r)}</p>}
      <div className="mt-1.5"><Tag>{r.lembaga || 'Umum'}</Tag></div>
      {r.deskripsi && <p className="mt-2 whitespace-pre-line text-slate-600">{r.deskripsi}</p>}
    </div>
  );
}

function Lightbox({ list, index, setIndex }) {
  const g = list[index];
  const go = (d) => setIndex((i) => (i + d + list.length) % list.length);
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') setIndex(null);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  if (!g) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4" onClick={() => setIndex(null)}>
      <button className="absolute right-4 top-4 rounded-full bg-white/90 p-1.5" onClick={() => setIndex(null)} aria-label="Tutup"><X size={20} /></button>
      <div className="flex w-full items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button className="rounded-full bg-white/90 p-2" onClick={() => go(-1)} aria-label="Sebelumnya"><ChevronLeft size={20} /></button>
        <img src={optimizeUrl(g.gambarUrl, 1600)} alt={g.keterangan || ''} className="max-h-[75vh] min-w-0 max-w-full rounded-lg object-contain" />
        <button className="rounded-full bg-white/90 p-2" onClick={() => go(1)} aria-label="Berikutnya"><ChevronRight size={20} /></button>
      </div>
      <p className="mt-3 max-w-xl text-center text-sm text-white" onClick={(e) => e.stopPropagation()}>
        {g.keterangan} <span className="text-white/60">· {tglPanjang(g.tanggal)}{g.lembaga ? ` · ${g.lembaga}` : ''}</span>
      </p>
    </div>
  );
}
