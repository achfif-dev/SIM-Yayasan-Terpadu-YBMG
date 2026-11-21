'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { CheckCircle2, Copy, Loader2, MessageCircle, Paperclip, Plus, Trash2, Upload } from 'lucide-react';
import { getDb } from '../lib/firebase';
import { bukaWA, salinTeks } from '../lib/bagikan';
import { JENIS_DONASI, rupiah, teksTerimaKasih, tglHariIni, tglPanjang } from '../lib/kegiatan';
import { muatProfil } from '../lib/profil';
import { BIDANG } from '../lib/bidang';
import { idLembaga, kategoriEfektif, urutkanLembaga, validasiKas } from '../lib/lembaga';
import { emailSaya, isiLog, refLog } from '../lib/audit';
import { catatDonasiUmum, cabutDonasiUmum } from '../lib/donasiKas';
import { pdfTerimaKasih } from '../lib/pdfdoc';
import PdfAksi from './PdfAksi';
import { BuktiField, BuktiModal } from './Bukti';
import { deleteBukti, uploadBukti } from '../lib/upload';

// catatKas/bidang/unitId/tampilNama hanya berlaku untuk sumbangan UMUM (tanpa kegiatan); bidang sengaja kosong = admin wajib memilih.
const KOSONG = () => ({ nama: '', hp: '', jenis: 'Infaq', jumlah: '', tanggal: tglHariIni(), kegiatanId: '', samar: true, pesan: '', catatKas: true, bidang: '', unitId: '', tampilNama: false, bukti: '' });
const JENIS_KAS = { Infaq: 'Infaq', Shodaqoh: 'Shodaqoh', 'Infaq & Shodaqoh': 'Infaq' };

function Ucapan({ d, profil, ttd, onKirim }) {
  const [gaya, setGaya] = useState('lengkap');
  const [teks, setTeks] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setTeks(teksTerimaKasih({ nama: d.nama, jenis: d.jenis, jumlah: d.jumlah, tanggal: d.tanggal, tujuan: d.tujuan, pesan: d.pesan, yayasan: profil.namaYayasan, statusHukum: profil.statusHukum, telepon: profil.telepon, ttd, gaya }));
    setMsg('');
  }, [d.id, gaya, ttd, profil.namaYayasan, profil.statusHukum, profil.telepon]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const [inst, setInst] = useState([]);
  const [lihat, setLihat] = useState(null); // bukti yang sedang dibuka
  const pend = useRef(new Set()); // bukti terunggah yang belum disimpan → dibersihkan bila batal / pindah tab
  useEffect(() => () => { pend.current.forEach((v) => deleteBukti(v)); }, []);
  const ubahBukti = (v) => {
    if (f.bukti && pend.current.has(f.bukti)) { pend.current.delete(f.bukti); deleteBukti(f.bukti); }
    if (v) pend.current.add(v);
    set({ bukti: v });
  };
  const [profil, setProfil] = useState({ namaYayasan: 'Yayasan' });
  const [ttd, setTtd] = useState('');
  const [aktif, setAktif] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [batas, setBatas] = useState(100); // jumlah donasi yang dimuat (naik 100 tiap "Muat lebih banyak")
  const [cari, setCari] = useState('');

  useEffect(() => {
    try {
      setTtd(localStorage.getItem('ybmg_ttd') || '');
      const b = localStorage.getItem('ybmg_bidang_umum');
      if (BIDANG.includes(b)) setF((p) => (p.bidang ? p : { ...p, bidang: b }));
    } catch (e) { /* abaikan */ }
  }, []);
  const ubahTtd = (v) => { setTtd(v); try { localStorage.setItem('ybmg_ttd', v); } catch (e) { /* abaikan */ } };

  const muat = useCallback(async () => {
    try {
      const s = await getDocs(query(collection(getDb(), 'donations'), orderBy('tanggal', 'desc'), limit(batas)));
      setList(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { setMsg(e?.code === 'permission-denied' ? 'Akses ditolak. Aturan Firestore terbaru belum dipublikasikan di Firebase Console.' : `Gagal memuat: ${e.message}`); setList([]); }
  }, [batas]);
  useEffect(() => {
    muat();
    muatProfil().then(setProfil);
    getDocs(collection(getDb(), 'panitia')).then((s) => setKegiatan(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => x.status !== 'Selesai').sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || ''))))).catch(() => {});
    getDocs(collection(getDb(), 'institutions')).then((s) => setInst(s.docs.map((d) => ({ id: d.id, ...d.data() })))).catch(() => {});
    getDocs(collection(getDb(), 'board_members')).then((s) => setPengurus(s.docs.map((d) => d.data()).filter((x) => x.nama).map((x) => `${x.nama}${x.jabatan ? `, ${x.jabatan}` : ''}`))).catch(() => {});
  }, [muat]);

  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  const simpan = async (e) => {
    e.preventDefault();
    const jumlah = Math.round(Number(f.jumlah) || 0);
    if (!f.nama.trim()) { setMsg('Nama donatur wajib diisi'); return; }
    if (jumlah <= 0) { setMsg('Jumlah harus lebih dari 0'); return; }
    const umumKas = !f.kegiatanId && f.catatKas;
    if (umumKas) {
      if (!BIDANG.includes(f.bidang)) { setMsg('Pilih Kas bidang mana yang menerima sumbangan umum ini (atau matikan “Catat otomatis ke Kas yayasan”).'); return; }
      const salah = validasiKas({ unitId: f.unitId, kategoriUnit: f.bidang }, inst);
      if (salah) { setMsg(salah); return; }
    }
    setBusy(true);
    setMsg('');
    const kg = kegiatan.find((x) => x.id === f.kegiatanId);
    const me = emailSaya();
    const ref = doc(collection(getDb(), 'donations'));
    const data = {
      nama: f.nama.trim(), hp: f.hp.trim(), jenis: f.jenis, jumlah, tanggal: f.tanggal, tujuan: kg ? kg.nama : '',
      kegiatanId: kg ? kg.id : '', pesan: f.pesan.trim(), bukti: f.bukti || '', dikirim: false, createdAt: serverTimestamp(), createdBy: me,
    };
    try {
      await setDoc(ref, data);
      if (f.bukti) pend.current.delete(f.bukti);
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
      let kasInfo = {};
      if (umumKas) {
        try {
          // Satu batch atomik: transaksi + jejak audit + ringkasan + penanda kasId pada donasi (lihat lib/donasiKas.js)
          const r = await catatDonasiUmum({ donasiId: ref.id, nama: data.nama, jenis: data.jenis, jumlah, tanggal: f.tanggal, bidang: f.bidang, unitId: f.unitId, lembagaId: idLembaga(f.unitId, inst), tampilNama: f.tampilNama });
          kasInfo = { kasId: r.kasId, bidang: f.bidang };
          try { localStorage.setItem('ybmg_bidang_umum', f.bidang); } catch (er) { /* abaikan */ }
          catatan = `Tersimpan ✓ dan otomatis dicatat sebagai pemasukan Kas ${f.bidang}`;
        } catch (er) { catatan = `Donasi tersimpan, tetapi pencatatan ke Kas yayasan gagal dan tidak ada yang tertulis di kas (${er.message}). Jangan catat manual di tab Kas: tekan tombol “Catat ke kas” pada donasi ini di riwayat di bawah.`; }
      }
      setMsg(catatan);
      setAktif({ id: ref.id, ...data, ...kasInfo, tanggal: f.tanggal });
      setF({ ...KOSONG(), kegiatanId: f.kegiatanId, tanggal: f.tanggal, catatKas: f.catatKas, bidang: f.bidang, unitId: f.unitId });
      await muat();
    } catch (er) { setMsg(`Gagal: ${er.message}`); }
    setBusy(false);
  };

  const tandaiTerkirim = async (d) => {
    try { await updateDoc(doc(getDb(), 'donations', d.id), { dikirim: true }); await muat(); } catch (e) { /* abaikan */ }
  };
  // Donasi umum lama (dicatat sebelum fitur ini) → catat ke kas. Peringatan dobel: admin mungkin sudah mengetiknya di tab Kas.
  const catatKeKas = async (d) => {
    if (!BIDANG.includes(f.bidang)) { setMsg('Pilih dulu “Kas bidang” pada formulir di atas, lalu klik lagi.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!confirm(`Catat ${d.nama} (${rupiah(d.jumlah)}) sebagai pemasukan Kas ${f.bidang}?\n\nPastikan sumbangan ini BELUM pernah diketik manual di tab Kas, agar saldo tidak terhitung dua kali.`)) return;
    try {
      const r = await catatDonasiUmum({ donasiId: d.id, nama: d.nama, jenis: d.jenis, jumlah: d.jumlah, tanggal: d.tanggal, bidang: f.bidang, unitId: f.unitId, lembagaId: idLembaga(f.unitId, inst), tampilNama: false });
      setMsg(r.sudahAda ? `Donasi ini ternyata sudah tercatat di kas; hanya disambungkan kembali ✓` : `Dicatat ke Kas ${f.bidang} ✓`);
      await muat();
    } catch (er) { setMsg(`Gagal mencatat ke kas: ${er.message}`); }
  };
  // Tambah / ganti bukti pada donasi yang sudah tercatat.
  const unggahBukti = async (d, file) => {
    if (!file) return;
    setMsg('Mengunggah bukti…');
    let baru = '';
    let tersimpan = false;
    try {
      baru = await uploadBukti(file, { privat: true });
      await updateDoc(doc(getDb(), 'donations', d.id), { bukti: baru });
      tersimpan = true;
      if (d.bukti) await deleteBukti(d.bukti);
      setMsg('Bukti tersimpan ✓');
      await muat();
    } catch (er) {
      if (baru && !tersimpan) await deleteBukti(baru);
      setMsg(`Gagal menyimpan bukti: ${er.message}`);
    }
  };
  const hapus = async (d) => {
    if (!confirm(`Hapus catatan donasi ${d.nama}?${d.kegiatanId ? ' Pemasukan di kas kegiatan terkait ikut dihapus.' : ''}${d.kasId ? ` Pemasukan di Kas ${d.bidang || 'yayasan'} terkait ikut dihapus.` : ''}`)) return;
    try {
      if (d.kasId) {
        // kas yayasan + ringkasan + jejak audit + donasi itu sendiri: satu batch atomik
        await cabutDonasiUmum({ donasiId: d.id, hapusDonasi: true, donasi: d });
      } else {
        const db = getDb();
        const b = writeBatch(db);
        if (d.kegiatanId) b.delete(doc(db, 'panitia', d.kegiatanId, 'kas', `d_${d.id}`));
        b.delete(doc(db, 'donations', d.id));
        b.set(refLog(), isiLog({ koleksi: 'donations', aksi: 'hapus', docId: d.id, sebelum: { tanggal: d.tanggal ?? null, jenis: d.jenis ?? null, jumlah: d.jumlah ?? null, tujuan: d.tujuan ?? null }, sumber: 'donatur' }));
        await b.commit();
      }
      if (d.bukti) await deleteBukti(d.bukti);
      if (aktif?.id === d.id) setAktif(null);
      await muat();
    } catch (e) { setMsg(`Gagal: ${e.message}`); }
  };

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">Catat sumbangan infaq / shodaqoh, lalu langsung buat <b>ucapan terima kasih</b> (teks WhatsApp atau PDF). Bila dipilih untuk sebuah kegiatan, sumbangan otomatis masuk ke kas kegiatan itu. Untuk sumbangan <b>umum yayasan</b>, sumbangan otomatis masuk ke <b>Kas</b> bidang yang dipilih (tidak perlu mengetik lagi di tab Kas) dan ringkasan beranda ikut diperbarui. Nomor WhatsApp donatur hanya tersimpan di sini (tidak tampil di laporan publik).</p>

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
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.samar} onChange={(e) => set({ samar: e.target.checked })} /> Tampilkan sebagai “Hamba Allah” di laporan kegiatan (disarankan: laporan ini bisa dilihat siapa saja)</label>
          )}
          {!f.kegiatanId && (
            <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/50 p-3 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={f.catatKas} onChange={(e) => set({ catatKas: e.target.checked })} /> Catat otomatis ke Kas yayasan (pemasukan)</label>
              {f.catatKas && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="mb-1 block text-sm font-medium">Kas bidang</label>
                    <select className="inp" value={f.bidang} onChange={(e) => set({ bidang: e.target.value, unitId: '' })}><option value="">— pilih bidang —</option>{BIDANG.map((b) => <option key={b}>{b}</option>)}</select></div>
                  <div><label className="mb-1 block text-sm font-medium">Lembaga / sub unit (opsional)</label>
                    <select className="inp" value={f.unitId} onChange={(e) => set({ unitId: e.target.value })} disabled={!f.bidang}>
                      <option value="">Tanpa rincian lembaga</option>
                      {urutkanLembaga(inst).filter((x) => x.namaLembaga && kategoriEfektif(x, inst) === f.bidang).map((x) => <option key={x.id} value={x.namaLembaga}>{x._anak ? `↳ ${x.namaLembaga}` : x.namaLembaga}</option>)}
                    </select></div>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.tampilNama} onChange={(e) => set({ tampilNama: e.target.checked })} /> Tampilkan nama donatur di laporan kas publik <span className="text-slate-500">(bawaan: “Hamba Allah”, karena laporan kas dapat dilihat siapa saja)</span></label>
                </div>
              )}
            </div>
          )}
          <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Pesan tambahan di ucapan (opsional)</label><input className="inp" value={f.pesan} onChange={(e) => set({ pesan: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Foto bukti transfer / lainnya (opsional)</label>
            <BuktiField value={f.bukti} onChange={ubahBukti} label="Upload bukti transfer" privat />
            <p className="mt-1 text-xs text-slate-500">Hanya tersimpan di catatan donasi ini (khusus admin); tidak ikut tampil di laporan kas publik.</p></div>
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

      {lihat && <BuktiModal value={lihat} onClose={() => setLihat(null)} />}
      {aktif && <Ucapan d={aktif} profil={profil} ttd={ttd} onKirim={tandaiTerkirim} />}

      <div className="divide-y rounded-2xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <p className="text-sm font-semibold">Riwayat sumbangan ({list?.length ?? 0} terbaru dimuat)</p>
          <input className="inp !w-48" placeholder="Cari nama / jenis / tujuan" value={cari} onChange={(e) => setCari(e.target.value)} />
        </div>
        {list === null && <div className="flex justify-center p-6"><Loader2 className="animate-spin text-brand-700" /></div>}
        {list && !list.length && <p className="p-6 text-center text-sm text-slate-500">Belum ada catatan.</p>}
        {list?.filter((d) => !cari.trim() || [d.nama, d.jenis, d.tujuan].some((x) => String(x || '').toLowerCase().includes(cari.trim().toLowerCase()))).map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{d.nama} · {rupiah(d.jumlah)} {d.dikirim && <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-normal text-emerald-800">Ucapan terkirim</span>}</p>
              <p className="truncate text-slate-500">{tglPanjang(d.tanggal)} · {d.jenis}{d.tujuan ? ` · ${d.tujuan}` : ' · Umum'}</p>
              {d.kasId && <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={12} /> Tercatat di Kas {d.bidang || 'yayasan'}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {d.bukti && <button className="btn-light" onClick={() => setLihat(d.bukti)} aria-label="Lihat bukti"><Paperclip size={14} /></button>}
              <label className="btn-light cursor-pointer" title={d.bukti ? 'Ganti bukti' : 'Tambah bukti'}>
                <Upload size={14} />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const fl = e.target.files?.[0]; e.target.value = ''; unggahBukti(d, fl); }} />
              </label>
              {!d.kegiatanId && !d.kasId && <button className="btn-light" onClick={() => catatKeKas(d)}>Catat ke kas</button>}
              <button className="btn-light" onClick={() => { setAktif(d); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Ucapan</button>
              <button className="btn-light !text-red-600" onClick={() => hapus(d)} aria-label="Hapus"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {list && list.length >= batas && (
          <div className="p-4 text-center"><button type="button" className="btn-light" onClick={() => setBatas((n) => n + 100)}>Muat 100 lebih lama</button></div>
        )}
      </div>
    </div>
  );
}
