'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { getAuthInstance, getDb } from '../lib/firebase';
import { deleteBukti } from '../lib/upload';
import { JENIS_KEGIATAN, KATEGORI_KELUAR, STATUS_KEGIATAN, hitung, newId, num, rentangTanggal, rupiah, strukturBaru, tglHariIni } from '../lib/kegiatan';
import { muatProfil } from '../lib/profil';
import KegiatanPanitia from './KegiatanPanitia';
import KegiatanKas from './KegiatanKas';
import KegiatanLaporan from './KegiatanLaporan';

const WARNA = { Persiapan: 'bg-amber-100 text-amber-800', Berlangsung: 'bg-sky-100 text-sky-800', Selesai: 'bg-emerald-100 text-emerald-800' };
const TABS = [['info', 'Info & RAB'], ['panitia', 'Panitia'], ['kas', 'Kas'], ['laporan', 'Laporan']];

function InfoRab({ k, onSaved }) {
  const ambil = (x) => ({ nama: x.nama || '', jenis: x.jenis || 'Lainnya', tanggal: x.tanggal || '', tanggalSelesai: x.tanggalSelesai || '', lokasi: x.lokasi || '', status: x.status || 'Persiapan' });
  const [f, setF] = useState(ambil(k));
  const [rab, setRab] = useState(k.rab || []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { setF(ambil(k)); setRab(k.rab || []); }, [k.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const simpan = async (e) => {
    e.preventDefault();
    if (!f.nama.trim()) { setMsg('Nama kegiatan wajib diisi'); return; }
    setBusy(true);
    setMsg('');
    try {
      const bersih = rab.map((r) => ({ id: r.id || newId(), kategori: String(r.kategori || '').trim(), jumlah: Math.round(num(r.jumlah)) })).filter((r) => r.kategori && r.jumlah > 0);
      await updateDoc(doc(getDb(), 'panitia', k.id), { ...f, nama: f.nama.trim(), rab: bersih });
      setRab(bersih);
      setMsg('Tersimpan ✓');
      await onSaved();
    } catch (err) { setMsg(`Gagal: ${err.message}`); }
    setBusy(false);
  };
  return (
    <form onSubmit={simpan} className="space-y-5 rounded-2xl bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Nama kegiatan</label><input className="inp" value={f.nama} onChange={(e) => set({ nama: e.target.value })} /></div>
        <div><label className="mb-1 block text-sm font-medium">Jenis</label>
          <select className="inp" value={f.jenis} onChange={(e) => set({ jenis: e.target.value })}>{[...new Set([...JENIS_KEGIATAN, f.jenis])].map((j) => <option key={j}>{j}</option>)}</select></div>
        <div><label className="mb-1 block text-sm font-medium">Status</label>
          <select className="inp" value={f.status} onChange={(e) => set({ status: e.target.value })}>{STATUS_KEGIATAN.map((j) => <option key={j}>{j}</option>)}</select></div>
        <div><label className="mb-1 block text-sm font-medium">Tanggal</label><input type="date" className="inp" value={f.tanggal} onChange={(e) => set({ tanggal: e.target.value })} /></div>
        <div><label className="mb-1 block text-sm font-medium">Sampai tanggal (bila lebih dari sehari)</label><input type="date" className="inp" value={f.tanggalSelesai} onChange={(e) => set({ tanggalSelesai: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Lokasi</label><input className="inp" value={f.lokasi} onChange={(e) => set({ lokasi: e.target.value })} /></div>
      </div>
      <div className="space-y-2">
        <h3 className="font-bold">Rencana anggaran biaya (RAB) per kategori</h3>
        <p className="text-sm text-slate-500">Opsional. Bila diisi, laporan menampilkan perbandingan anggaran dan realisasi.</p>
        {rab.map((r, i) => (
          <div key={r.id || i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1.5fr_1fr_auto]">
            <input className="inp" list="kat-rab" placeholder="Kategori" value={r.kategori} onChange={(e) => setRab((p) => p.map((x, j) => (j === i ? { ...x, kategori: e.target.value } : x)))} />
            <input className="inp order-last col-span-2 sm:order-none sm:col-span-1" type="number" inputMode="numeric" min="0" placeholder="Anggaran (Rp)" value={r.jumlah} onChange={(e) => setRab((p) => p.map((x, j) => (j === i ? { ...x, jumlah: e.target.value } : x)))} />
            <button type="button" className="btn-light" onClick={() => setRab((p) => p.filter((_, j) => j !== i))} aria-label="Hapus baris"><Trash2 size={14} /></button>
          </div>
        ))}
        <datalist id="kat-rab">{KATEGORI_KELUAR.map((x) => <option key={x} value={x} />)}</datalist>
        <button type="button" className="btn-light" onClick={() => setRab((p) => [...p, { id: newId(), kategori: '', jumlah: '' }])}><Plus size={14} /> Tambah kategori</button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan</button>
        <span className="text-sm text-slate-500">{msg}</span>
      </div>
    </form>
  );
}

function Detail({ k, profil, onBack, onChanged }) {
  const [tab, setTab] = useState('kas');
  const [kas, setKas] = useState([]);
  const [muat, setMuat] = useState(true);
  const [err, setErr] = useState('');
  const memuat = useCallback(async () => {
    try {
      const s = await getDocs(collection(getDb(), 'panitia', k.id, 'kas'));
      setKas(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      setErr('');
    } catch (e) { setErr(`Gagal memuat kas: ${e.message}`); }
    setMuat(false);
  }, [k.id]);
  useEffect(() => { setMuat(true); memuat(); }, [memuat]);
  const h = useMemo(() => hitung(kas, k.rab), [kas, k.rab]);

  const hapus = async () => {
    if (!confirm(`Hapus kegiatan "${k.nama}" beserta seluruh catatan kas dan foto notanya? Tidak bisa dibatalkan.`)) return;
    try {
      for (const x of kas) { await deleteDoc(doc(getDb(), 'panitia', k.id, 'kas', x.id)); if (x.bukti) await deleteBukti(x.bukti); }
      await deleteDoc(doc(getDb(), 'panitia', k.id));
      await onChanged();
      onBack();
    } catch (e) { alert(`Gagal menghapus: ${e.message}`); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-light" onClick={onBack}><ArrowLeft size={14} /> Daftar kegiatan</button>
        <button className="btn-light ml-auto !text-red-600" onClick={hapus}><Trash2 size={14} /> Hapus kegiatan</button>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="font-bold">{k.nama}</p>
        <p className="text-sm text-slate-500">{[rentangTanggal(k.tanggal, k.tanggalSelesai), k.lokasi].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${tab === v ? 'bg-brand-700 text-white' : 'hover:bg-slate-100'}`}>{l}</button>
        ))}
      </div>
      {err && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{err}</p>}
      {muat ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-brand-700" /></div> : (
        <>
          {tab === 'info' && <InfoRab k={k} onSaved={onChanged} />}
          {tab === 'panitia' && <KegiatanPanitia k={k} profil={profil} onSaved={onChanged} />}
          {tab === 'kas' && <KegiatanKas k={k} kas={kas} h={h} onReload={memuat} />}
          {tab === 'laporan' && <KegiatanLaporan k={k} h={h} profil={profil} onSaved={onChanged} />}
        </>
      )}
    </div>
  );
}

export default function AdminKepanitiaan() {
  const [list, setList] = useState(null);
  const [sel, setSel] = useState(null);
  const [profil, setProfil] = useState({ namaYayasan: 'Yayasan' });
  const [baru, setBaru] = useState({ jenis: JENIS_KEGIATAN[0], nama: `${JENIS_KEGIATAN[0]} ${new Date().getFullYear()}`, tanggal: tglHariIni(), lokasi: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const muat = useCallback(async () => {
    try {
      const s = await getDocs(collection(getDb(), 'panitia'));
      setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || ''))));
      setErr('');
    } catch (e) { setErr(e?.code === 'permission-denied' ? 'Akses ditolak. Aturan Firestore terbaru (firestore.rules) belum dipublikasikan di Firebase Console.' : `Gagal memuat: ${e.message}`); setList([]); }
  }, []);
  useEffect(() => { muat(); muatProfil().then(setProfil); }, [muat]);

  const buat = async (e) => {
    e.preventDefault();
    if (!baru.nama.trim()) return;
    setBusy(true);
    try {
      const ref = await addDoc(collection(getDb(), 'panitia'), {
        nama: baru.nama.trim(), jenis: baru.jenis, tanggal: baru.tanggal, tanggalSelesai: '', lokasi: baru.lokasi.trim(), status: 'Persiapan',
        publik: false, struktur: strukturBaru(), rab: [], penutup: '', sisaDisposisi: '', mengetahuiNama: '', mengetahuiJabatan: 'Ketua Yayasan',
        createdAt: serverTimestamp(), createdBy: getAuthInstance().currentUser?.email || '',
      });
      await muat();
      setSel(ref.id);
    } catch (er) { setErr(`Gagal membuat kegiatan: ${er.message}`); }
    setBusy(false);
  };

  const k = list?.find((x) => x.id === sel);
  if (k) return <Detail k={k} profil={profil} onBack={() => setSel(null)} onChanged={muat} />;

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">Setiap kegiatan (Maulid, Isra' Mi'raj, dll.) punya <b>susunan panitia</b> dan <b>kas tersendiri</b> yang terpisah dari kas yayasan, lengkap dengan rincian belanja, foto nota, dan laporan pertanggungjawaban yang bisa dibagikan.</p>
      {err && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{err}</p>}
      <form onSubmit={buat} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-bold">Kegiatan baru</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm font-medium">Jenis</label>
            <select className="inp" value={baru.jenis} onChange={(e) => setBaru((p) => ({ ...p, jenis: e.target.value, nama: e.target.value === 'Lainnya' ? p.nama : `${e.target.value} ${new Date().getFullYear()}` }))}>
              {JENIS_KEGIATAN.map((j) => <option key={j}>{j}</option>)}</select></div>
          <div><label className="mb-1 block text-sm font-medium">Tanggal</label><input type="date" className="inp" value={baru.tanggal} onChange={(e) => setBaru((p) => ({ ...p, tanggal: e.target.value }))} /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Nama kegiatan</label><input className="inp" value={baru.nama} onChange={(e) => setBaru((p) => ({ ...p, nama: e.target.value }))} /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Lokasi (opsional)</label><input className="inp" value={baru.lokasi} onChange={(e) => setBaru((p) => ({ ...p, lokasi: e.target.value }))} /></div>
        </div>
        <button className="btn" disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Buat kegiatan</button>
      </form>
      {list === null && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-brand-700" /></div>}
      {list && list.length === 0 && !err && <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">Belum ada kegiatan.</p>}
      <div className="space-y-3">
        {list?.map((x) => (
          <button key={x.id} onClick={() => setSel(x.id)} className="block w-full rounded-2xl bg-white p-4 text-left shadow-sm hover:bg-slate-50">
            <p className="flex items-center gap-2 font-semibold">{x.nama}<span className={`rounded-full px-2 py-0.5 text-xs ${WARNA[x.status] || WARNA.Persiapan}`}>{x.status || 'Persiapan'}</span>{x.publik && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">Tautan aktif</span>}</p>
            <p className="text-sm text-slate-500">{[rentangTanggal(x.tanggal, x.tanggalSelesai), x.lokasi].filter(Boolean).join(' · ') || '—'}{x.rab?.length ? ` · RAB ${rupiah(x.rab.reduce((s, r) => s + num(r.jumlah), 0))}` : ''}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
