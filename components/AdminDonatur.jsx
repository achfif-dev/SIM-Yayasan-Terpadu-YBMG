'use client';

import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Copy, Loader2, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { getAuthInstance, getDb } from '../lib/firebase';
import { bukaWA, salinTeks } from '../lib/bagikan';
import { JENIS_DONASI, rupiah, teksTerimaKasih, tglHariIni, tglPanjang } from '../lib/kegiatan';
import { muatProfil } from '../lib/profil';
import { pdfTerimaKasih } from '../lib/pdfdoc';
import PdfAksi from './PdfAksi';

const KOSONG = () => ({ nama: '', hp: '', jenis: 'Infaq', jumlah: '', tanggal: tglHariIni(), kegiatanId: '', samar: false, pesan: '' });
const JENIS_KAS = { Infaq: 'Infaq', Shodaqoh: 'Shodaqoh', 'Infaq & Shodaqoh': 'Infaq' };

function Ucapan({ d, profil, ttd, onKirim }) {
  const [gaya, setGaya] = useState('lengkap');
  const [teks, setTeks] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setTeks(teksTerimaKasih({ nama: d.nama, jenis: d.jenis, jumlah: d.jumlah, tanggal: d.tanggal, tujuan: d.tujuan, pesan: d.pesan, yayasan: profil.namaYayasan, telepon: profil.telepon, ttd, gaya }));
    setMsg('');
  }, [d.id, gaya, ttd, profil.namaYayasan, profil.telepon]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-3 rounded-2xl border-2 border-brand-600 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Ucapan untuk {d.nama}</h3>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {[['lengkap', 'Lengkap'], ['singkat', 'Singkat']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setGaya(v)} className={`rounded-lg px-3 py-1 text-sm ${gaya === v ? 'bg-brand-700 text-white' : ''}`}>{l}</button>
          ))}
        </div>
      </div>
      <textarea className="inp font-mono text-xs" rows={12} value={teks} onChange={(e) => setTeks(e.target.value)} />
      <p className="text-xs text-slate-500">Teks boleh diubah sebelum dikirim. Tanda *…* membuat tulisan tebal di WhatsApp.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={() => { bukaWA(teks, d.hp); onKirim(d); }}><MessageCircle size={14} /> {d.hp ? 'Kirim ke WhatsApp donatur' : 'Kirim lewat WhatsApp'}</button>
        <button type="button" className="btn-light" onClick={async () => setMsg((await salinTeks(teks)) ? 'Teks disalin ✓' : 'Gagal menyalin')}><Copy size={14} /> Salin teks</button>
        <span className="text-sm text-slate-500">{msg}</span>
      </div>
      <PdfAksi buat={() => pdfTerimaKasih({ profil, d, ttd })} teks={teks} versi={`${d.id}|${ttd}|${d.pesan}`} label="Buat PDF ucapan terima kasih" />
    </div>
  );
}

export default function AdminDonatur() {
  const [f, setF] = useState(KOSONG());
  const [list, setList] = useState(null);
  const [kegiatan, setKegiatan] = useState([]);
  const [pengurus, setPengurus] = useState([]);
  const [profil, setProfil] = useState({ namaYayasan: 'Yayasan' });
  const [ttd, setTtd] = useState('');
  const [aktif, setAktif] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { try { setTtd(localStorage.getItem('ybmg_ttd') || ''); } catch (e) { /* abaikan */ } }, []);
  const ubahTtd = (v) => { setTtd(v); try { localStorage.setItem('ybmg_ttd', v); } catch (e) { /* abaikan */ } };

  const muat = useCallback(async () => {
    try {
      const s = await getDocs(query(collection(getDb(), 'donations'), orderBy('tanggal', 'desc'), limit(100)));
      setList(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { setMsg(e?.code === 'permission-denied' ? 'Akses ditolak. Aturan Firestore terbaru belum dipublikasikan di Firebase Console.' : `Gagal memuat: ${e.message}`); setList([]); }
  }, []);
  useEffect(() => {
    muat();
    muatProfil().then(setProfil);
    getDocs(collection(getDb(), 'panitia')).then((s) => setKegiatan(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => x.status !== 'Selesai').sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || ''))))).catch(() => {});
    getDocs(collection(getDb(), 'board_members')).then((s) => setPengurus(s.docs.map((d) => d.data()).filter((x) => x.nama).map((x) => `${x.nama}${x.jabatan ? `, ${x.jabatan}` : ''}`))).catch(() => {});
  }, [muat]);

  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  const simpan = async (e) => {
    e.preventDefault();
    const jumlah = Math.round(Number(f.jumlah) || 0);
    if (!f.nama.trim()) { setMsg('Nama donatur wajib diisi'); return; }
    if (jumlah <= 0) { setMsg('Jumlah harus lebih dari 0'); return; }
    setBusy(true);
    setMsg('');
    const kg = kegiatan.find((x) => x.id === f.kegiatanId);
    const me = getAuthInstance().currentUser?.email || '';
    const ref = doc(collection(getDb(), 'donations'));
    const data = {
      nama: f.nama.trim(), hp: f.hp.trim(), jenis: f.jenis, jumlah, tanggal: f.tanggal, tujuan: kg ? kg.nama : '',
      kegiatanId: kg ? kg.id : '', pesan: f.pesan.trim(), dikirim: false, createdAt: serverTimestamp(), createdBy: me,
    };
    try {
      await setDoc(ref, data);
      let catatan = 'Tersimpan ✓';
      if (kg) {
        try {
          await setDoc(doc(getDb(), 'panitia', kg.id, 'kas', `d_${ref.id}`), {
            tipe: 'masuk', tanggal: f.tanggal, jenis: JENIS_KAS[f.jenis] || 'Lain-lain', sumber: f.samar ? 'Hamba Allah' : data.nama, jumlah,
            keterangan: '', kegiatanId: kg.id, donasiId: ref.id, createdAt: serverTimestamp(), createdBy: me,
          });
          catatan = `Tersimpan ✓ dan dicatat sebagai pemasukan kas ${kg.nama}`;
        } catch (er) { catatan = `Donasi tersimpan, tetapi gagal dicatat ke kas kegiatan: ${er.message}`; }
      }
      setMsg(catatan);
      setAktif({ id: ref.id, ...data, tanggal: f.tanggal });
      setF({ ...KOSONG(), kegiatanId: f.kegiatanId, tanggal: f.tanggal });
      await muat();
    } catch (er) { setMsg(`Gagal: ${er.message}`); }
    setBusy(false);
  };

  const tandaiTerkirim = async (d) => {
    try { await updateDoc(doc(getDb(), 'donations', d.id), { dikirim: true }); await muat(); } catch (e) { /* abaikan */ }
  };
  const hapus = async (d) => {
    if (!confirm(`Hapus catatan donasi ${d.nama}?${d.kegiatanId ? ' Pemasukan di kas kegiatan terkait ikut dihapus.' : ''}`)) return;
    try {
      if (d.kegiatanId) await deleteDoc(doc(getDb(), 'panitia', d.kegiatanId, 'kas', `d_${d.id}`)).catch(() => {});
      await deleteDoc(doc(getDb(), 'donations', d.id));
      if (aktif?.id === d.id) setAktif(null);
      await muat();
    } catch (e) { setMsg(`Gagal: ${e.message}`); }
  };

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">Catat sumbangan infaq / shodaqoh, lalu langsung buat <b>ucapan terima kasih</b> (teks WhatsApp atau PDF). Bila dipilih untuk sebuah kegiatan, sumbangan otomatis masuk ke kas kegiatan itu. Untuk sumbangan umum yayasan, catat juga di tab <b>Kas</b>. Nomor WhatsApp donatur hanya tersimpan di sini (tidak tampil di laporan publik).</p>

      <form onSubmit={simpan} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-bold">Sumbangan baru</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm font-medium">Nama donatur</label><input className="inp" value={f.nama} onChange={(e) => set({ nama: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm font-medium">Nomor WhatsApp (opsional)</label><input className="inp" inputMode="tel" placeholder="08123456789" value={f.hp} onChange={(e) => set({ hp: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm font-medium">Jenis</label>
            <select className="inp" value={f.jenis} onChange={(e) => set({ jenis: e.target.value })}>{JENIS_DONASI.map((j) => <option key={j}>{j}</option>)}</select></div>
          <div><label className="mb-1 block text-sm font-medium">Jumlah (Rp)</label><input className="inp" type="number" inputMode="numeric" min="1" value={f.jumlah} onChange={(e) => set({ jumlah: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm font-medium">Tanggal diterima</label><input type="date" className="inp" value={f.tanggal} onChange={(e) => set({ tanggal: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm font-medium">Untuk</label>
            <select className="inp" value={f.kegiatanId} onChange={(e) => set({ kegiatanId: e.target.value })}><option value="">Umum (yayasan)</option>{kegiatan.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}</select></div>
          {f.kegiatanId && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.samar} onChange={(e) => set({ samar: e.target.checked })} /> Tampilkan sebagai “Hamba Allah” di laporan kegiatan</label>
          )}
          <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Pesan tambahan di ucapan (opsional)</label><input className="inp" value={f.pesan} onChange={(e) => set({ pesan: e.target.value })} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn" disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Simpan & buat ucapan</button>
          <span className="text-sm text-slate-500">{msg}</span>
        </div>
      </form>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <label className="mb-1 block text-sm font-medium">Ditandatangani oleh (nama & jabatan) — diingat untuk ucapan berikutnya</label>
        <input className="inp" list="daftar-pengurus" placeholder="mis. H. Ahmad, Ketua Yayasan" value={ttd} onChange={(e) => ubahTtd(e.target.value)} />
        <datalist id="daftar-pengurus">{pengurus.map((x) => <option key={x} value={x} />)}</datalist>
      </div>

      {aktif && <Ucapan d={aktif} profil={profil} ttd={ttd} onKirim={tandaiTerkirim} />}

      <div className="divide-y rounded-2xl bg-white shadow-sm">
        <p className="p-4 text-sm font-semibold">Riwayat sumbangan (100 terakhir)</p>
        {list === null && <div className="flex justify-center p-6"><Loader2 className="animate-spin text-brand-700" /></div>}
        {list && !list.length && <p className="p-6 text-center text-sm text-slate-500">Belum ada catatan.</p>}
        {list?.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{d.nama} · {rupiah(d.jumlah)} {d.dikirim && <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-normal text-emerald-800">Ucapan terkirim</span>}</p>
              <p className="truncate text-slate-500">{tglPanjang(d.tanggal)} · {d.jenis}{d.tujuan ? ` · ${d.tujuan}` : ''}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button className="btn-light" onClick={() => { setAktif(d); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Ucapan</button>
              <button className="btn-light !text-red-600" onClick={() => hapus(d)} aria-label="Hapus"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
