'use client';

import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Loader2, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import { getAuthInstance, getDb } from '../lib/firebase';
import { deleteBukti } from '../lib/upload';
import { JENIS_MASUK, KATEGORI_KELUAR, kelompokSeksi, num, rupiah, tglHariIni, tglPanjang } from '../lib/kegiatan';
import { BuktiField, BuktiModal } from './Bukti';

const awal = (tipe) => (tipe === 'masuk'
  ? { tipe, tanggal: tglHariIni(), jenis: 'Infaq', sumber: '', jumlah: '', keterangan: '' }
  : { tipe, tanggal: tglHariIni(), kategori: 'Konsumsi', uraian: '', qty: 1, satuan: '', harga: '', jumlah: '', seksi: '', bukti: '', keterangan: '' });

export default function KegiatanKas({ k, kas, h, onReload }) {
  const [f, setF] = useState(awal('keluar'));
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [saring, setSaring] = useState('semua');
  const [lihat, setLihat] = useState(null);
  const pend = useRef(new Set());
  useEffect(() => () => { pend.current.forEach((v) => deleteBukti(v)); }, []);

  const koleksi = () => collection(getDb(), 'panitia', k.id, 'kas');
  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const hitungJumlah = (qty, harga) => (num(qty) > 0 && num(harga) > 0 ? String(Math.round(num(qty) * num(harga))) : null);
  const ubahBukti = (v) => {
    if (f.bukti && pend.current.has(f.bukti)) { pend.current.delete(f.bukti); deleteBukti(f.bukti); }
    if (v) pend.current.add(v);
    set({ bukti: v });
  };
  const batal = () => { pend.current.forEach((v) => deleteBukti(v)); pend.current.clear(); setEditId(null); setF(awal(f.tipe)); };
  const ganti = (tipe) => { batal(); setF(awal(tipe)); };

  const simpan = async (e) => {
    e.preventDefault();
    const jumlah = Math.round(num(f.jumlah));
    if (!(jumlah > 0)) { setMsg('Jumlah harus lebih dari 0'); return; }
    if (!f.tanggal) { setMsg('Tanggal wajib diisi'); return; }
    if (f.tipe === 'masuk' && !String(f.sumber).trim()) { setMsg('Sumber / nama penyumbang wajib diisi'); return; }
    if (f.tipe === 'keluar' && !String(f.uraian).trim()) { setMsg('Uraian belanja wajib diisi'); return; }
    setBusy(true);
    setMsg('');
    const data = f.tipe === 'masuk'
      ? { tipe: 'masuk', tanggal: f.tanggal, jenis: f.jenis, sumber: String(f.sumber).trim(), jumlah, keterangan: String(f.keterangan || '').trim() }
      : { tipe: 'keluar', tanggal: f.tanggal, kategori: f.kategori, uraian: String(f.uraian).trim(), qty: num(f.qty), satuan: String(f.satuan || '').trim(), harga: num(f.harga), jumlah, seksi: f.seksi || '', bukti: f.bukti || '', keterangan: String(f.keterangan || '').trim() };
    data.kegiatanId = k.id;
    try {
      const me = getAuthInstance().currentUser?.email || '';
      if (f.bukti) pend.current.delete(f.bukti);
      if (editId) {
        const lama = kas.find((x) => x.id === editId);
        await updateDoc(doc(getDb(), 'panitia', k.id, 'kas', editId), { ...data, updatedAt: serverTimestamp(), updatedBy: me });
        if (lama?.bukti && lama.bukti !== data.bukti) await deleteBukti(lama.bukti);
      } else {
        await addDoc(koleksi(), { ...data, createdAt: serverTimestamp(), createdBy: me });
      }
      setMsg('Tersimpan ✓');
      setEditId(null);
      setF(awal(f.tipe));
      await onReload();
    } catch (err) { setMsg(`Gagal: ${err.message}`); }
    setBusy(false);
  };

  const hapus = async (x) => {
    if (!confirm('Hapus catatan ini?')) return;
    try {
      await deleteDoc(doc(getDb(), 'panitia', k.id, 'kas', x.id));
      if (x.bukti) await deleteBukti(x.bukti);
      await onReload();
    } catch (err) { setMsg(`Gagal: ${err.message}`); }
  };
  const ubah = (x) => {
    pend.current.forEach((v) => deleteBukti(v));
    pend.current.clear();
    setEditId(x.id);
    setF({ ...awal(x.tipe), ...x, jumlah: String(x.jumlah ?? ''), harga: x.harga ?? '', qty: x.qty ?? 1 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const seksi = kelompokSeksi(k.struktur).map((g) => g.seksi);
  const daftar = [...kas].sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')) || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .filter((x) => saring === 'semua' || x.tipe === saring);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">Pemasukan</p><p className="font-bold text-emerald-700">{rupiah(h.masuk)}</p></div>
        <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">Pengeluaran</p><p className="font-bold text-red-600">{rupiah(h.keluar)}</p></div>
        <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">Sisa dana</p><p className={`font-bold ${h.saldo < 0 ? 'text-red-600' : 'text-brand-800'}`}>{rupiah(h.saldo)}</p></div>
      </div>

      <form onSubmit={simpan} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">{editId ? 'Edit catatan' : 'Catat kas kegiatan'}</h3>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {[['keluar', 'Pengeluaran'], ['masuk', 'Pemasukan']].map(([v, l]) => (
              <button key={v} type="button" disabled={!!editId} onClick={() => ganti(v)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${f.tipe === v ? 'bg-brand-700 text-white' : ''}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm font-medium">Tanggal</label><input type="date" className="inp" value={f.tanggal} onChange={(e) => set({ tanggal: e.target.value })} /></div>
          {f.tipe === 'masuk' ? (
            <>
              <div><label className="mb-1 block text-sm font-medium">Jenis</label>
                <select className="inp" value={f.jenis} onChange={(e) => set({ jenis: e.target.value })}>{JENIS_MASUK.map((j) => <option key={j}>{j}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Sumber / nama penyumbang (tampil di laporan)</label>
                <input className="inp" placeholder="mis. Bpk. Ahmad / Hamba Allah / Kas Yayasan" value={f.sumber} onChange={(e) => set({ sumber: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium">Jumlah (Rp)</label><input type="number" inputMode="numeric" min="1" className="inp" value={f.jumlah} onChange={(e) => set({ jumlah: e.target.value })} /></div>
            </>
          ) : (
            <>
              <div><label className="mb-1 block text-sm font-medium">Kategori</label>
                <select className="inp" value={f.kategori} onChange={(e) => set({ kategori: e.target.value })}>
                  {[...new Set([...KATEGORI_KELUAR, f.kategori])].map((j) => <option key={j}>{j}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Uraian belanja</label>
                <input className="inp" placeholder="mis. Nasi kotak untuk jamaah" value={f.uraian} onChange={(e) => set({ uraian: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                <div><label className="mb-1 block text-sm font-medium">Jumlah barang</label><input type="number" inputMode="decimal" min="0" step="any" className="inp" value={f.qty} onChange={(e) => set({ qty: e.target.value, jumlah: hitungJumlah(e.target.value, f.harga) ?? f.jumlah })} /></div>
                <div><label className="mb-1 block text-sm font-medium">Satuan</label><input className="inp" placeholder="porsi" value={f.satuan} onChange={(e) => set({ satuan: e.target.value })} /></div>
                <div><label className="mb-1 block text-sm font-medium">Harga satuan</label><input type="number" inputMode="numeric" min="0" className="inp" value={f.harga} onChange={(e) => set({ harga: e.target.value, jumlah: hitungJumlah(f.qty, e.target.value) ?? f.jumlah })} /></div>
              </div>
              <div><label className="mb-1 block text-sm font-medium">Total (Rp) — otomatis dari barang × harga, bisa diubah</label><input type="number" inputMode="numeric" min="1" className="inp" value={f.jumlah} onChange={(e) => set({ jumlah: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium">Seksi pembeli (opsional)</label>
                <select className="inp" value={f.seksi} onChange={(e) => set({ seksi: e.target.value })}><option value="">—</option>{seksi.map((s) => <option key={s}>{s}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Foto nota / kwitansi</label><BuktiField value={f.bukti} onChange={ubahBukti} /></div>
            </>
          )}
          <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Catatan (opsional)</label><input className="inp" value={f.keterangan} onChange={(e) => set({ keterangan: e.target.value })} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn" disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {editId ? 'Update' : 'Simpan'}</button>
          {editId && <button type="button" className="btn-light" onClick={batal}>Batal</button>}
          <span className="text-sm text-slate-500">{msg}</span>
        </div>
      </form>

      <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
        {[['semua', 'Semua'], ['keluar', 'Pengeluaran'], ['masuk', 'Pemasukan']].map(([v, l]) => (
          <button key={v} onClick={() => setSaring(v)} className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${saring === v ? 'bg-brand-700 text-white' : 'hover:bg-slate-100'}`}>{l}</button>
        ))}
      </div>
      <div className="divide-y rounded-2xl bg-white shadow-sm">
        {!daftar.length && <p className="p-6 text-center text-sm text-slate-500">Belum ada catatan.</p>}
        {daftar.map((x) => (
          <div key={x.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1 text-sm">
              <p className={`font-semibold ${x.tipe === 'masuk' ? 'text-emerald-700' : 'text-red-600'}`}>
                {x.tipe === 'masuk' ? '+' : '-'} {rupiah(x.jumlah)} · {x.tipe === 'masuk' ? x.sumber : x.uraian}
                {x.bukti && <button type="button" onClick={() => setLihat(x.bukti)} aria-label="Lihat nota"><Paperclip size={12} className="ml-1 inline text-slate-500" /></button>}
              </p>
              <p className="truncate text-slate-500">{tglPanjang(x.tanggal)} · {x.tipe === 'masuk' ? x.jenis : x.kategori}{x.tipe === 'keluar' && num(x.harga) > 0 ? ` · ${x.qty} ${x.satuan || ''} × ${rupiah(x.harga)}` : ''}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button className="btn-light" onClick={() => ubah(x)} aria-label="Edit"><Pencil size={14} /></button>
              <button className="btn-light !text-red-600" onClick={() => hapus(x)} aria-label="Hapus"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {lihat && <BuktiModal value={lihat} onClose={() => setLihat(null)} />}
    </div>
  );
}
