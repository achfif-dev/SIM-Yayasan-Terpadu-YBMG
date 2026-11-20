'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { Building2, Landmark, Users, Wallet, LogOut, Loader2, Pencil, Trash2, Plus, Upload, Home, Paperclip, Megaphone, CalendarDays, Image as ImageIcon, Palette, RotateCcw, Repeat, ShieldCheck, DatabaseBackup } from 'lucide-react';
import Link from 'next/link';
import { getAuthInstance, getDb } from '../../lib/firebase';
import { cekAdmin, isOwnerEmail } from '../../lib/admin';
import AdminAkses from '../../components/AdminAkses';
import AdminCadangan from '../../components/AdminCadangan';
import { uploadImage, deleteBukti } from '../../lib/upload';
import { BuktiField } from '../../components/Bukti';
import LaporanKas from '../../components/LaporanKas';
import { DEFAULT_TAMPILAN, TAMPILAN_GROUPS, applyTheme, mergeTampilan } from '../../lib/tampilan';
import { clearCache } from '../../lib/hemat';
import { simpanRingkasan } from '../../lib/ringkasan';
import { isCloudinaryOn } from '../../lib/cdn';
import { BIDANG, normBidang } from '../../lib/bidang';
import { JENIS_SUB, USAHA_DI, blokirHapus, opsiLembaga, siapkanLembaga, susunLembaga, urutkanLembaga, validasiKas, validasiLembaga } from '../../lib/lembaga';
import { FREKUENSI, HARI_NAMA, BULAN_NAMA, BULAN_HIJRI, berikutnya, pengecualianTeks, polaTeks, toStr, validasiRutin } from '../../lib/rutin';

const KATEGORI = BIDANG; // keagamaan, sosial, kemanusiaan (sesuai AD/ART)
const DIVISI = ['Pembina', 'Pengawas', 'Pengurus Harian', 'Unit'];
const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

const PROFILE_FIELDS = [
  { name: 'namaYayasan', label: 'Nama Yayasan' },
  { name: 'tagline', label: 'Tagline' },
  { name: 'deskripsi', label: 'Deskripsi', type: 'textarea' },
  { name: 'logoUrl', label: 'Logo Yayasan', type: 'image', folder: 'logos' },
  { name: 'alamat', label: 'Alamat', type: 'textarea' },
  { name: 'telepon', label: 'Telepon' },
  { name: 'email', label: 'Email' },
  { name: 'rekeningDonasi', label: 'Rekening Donasi' },
];
const INST_FIELDS = [
  { name: 'namaLembaga', label: 'Nama Lembaga / Sub Unit', required: true },
  { name: 'indukId', label: 'Sub unit dari (kosongkan = lembaga utama)', type: 'induk', init: '' },
  { name: 'jenis', label: 'Jenis sub unit', type: 'select', options: JENIS_SUB, init: 'Unit', when: (f) => !!f.indukId },
  { name: 'kategori', label: 'Bidang (menentukan kas)', type: 'select', options: KATEGORI, norm: normBidang, when: (f) => !f.indukId },
  { name: 'deskripsi', label: 'Deskripsi', type: 'textarea' },
  { name: 'logoUrl', label: 'Logo Lembaga', type: 'image', folder: 'logos' },
  { name: 'kepalaUnit', label: 'Kepala Unit' },
  { name: 'programUnggulan', label: 'Program Unggulan', type: 'textarea' },
  { name: 'urutan', label: 'Nomor Urut Tampil', type: 'number' },
];
const BOARD_FIELDS = [
  { name: 'nama', label: 'Nama', required: true },
  { name: 'jabatan', label: 'Jabatan', required: true },
  { name: 'divisi', label: 'Divisi', type: 'select', options: DIVISI },
  { name: 'fotoUrl', label: 'Foto', type: 'image', folder: 'board' },
  { name: 'urutan', label: 'Nomor Urut Tampil', type: 'number' },
];
const TRX_FIELDS = [
  { name: 'tanggal', label: 'Tanggal', type: 'date', required: true },
  { name: 'tipe', label: 'Jenis', type: 'select', options: ['masuk', 'keluar'] },
  { name: 'kategoriUnit', label: 'Bidang (Kas)', type: 'select', options: KATEGORI, norm: normBidang },
  { name: 'unitId', label: 'Lembaga / Sub Unit (opsional, untuk rincian laporan)', type: 'lembaga', kosong: 'Tanpa rincian lembaga' },
  { name: 'jumlah', label: 'Jumlah (Rp)', type: 'number', required: true, min: 1 },
  { name: 'keterangan', label: 'Keterangan', type: 'textarea' },
  { name: 'bukti', label: 'Bukti Transaksi (foto nota/kwitansi)', type: 'bukti' },
];

const LEMBAGA_LABEL = 'Lembaga (kosongkan = umum / seluruh yayasan)';
const ANN_FIELDS = [
  { name: 'judul', label: 'Judul', required: true },
  { name: 'tanggal', label: 'Tanggal', type: 'date', required: true },
  { name: 'lembaga', label: LEMBAGA_LABEL, type: 'lembaga' },
  { name: 'sematkan', label: 'Sematkan di atas (penting)', type: 'select', options: ['Tidak', 'Ya'] },
  { name: 'isi', label: 'Isi pengumuman / berita', type: 'textarea', rows: 6, required: true },
  { name: 'gambarUrl', label: 'Gambar (opsional)', type: 'image', folder: 'berita', maxSize: 900, quality: 0.7 },
];
const EVT_FIELDS = [
  { name: 'judul', label: 'Nama Kegiatan', required: true },
  { name: 'tanggal', label: 'Tanggal', type: 'date', required: true },
  { name: 'jamMulai', label: 'Jam Mulai', type: 'time' },
  { name: 'jamSelesai', label: 'Jam Selesai', type: 'time' },
  { name: 'lokasi', label: 'Lokasi' },
  { name: 'lembaga', label: LEMBAGA_LABEL, type: 'lembaga' },
  { name: 'deskripsi', label: 'Deskripsi', type: 'textarea' },
];
const ADA = (...k) => (f) => k.includes(f.frekuensi);
const PEKAN_OPS = [{ value: '1', label: 'Pekan ke-1' }, { value: '2', label: 'Pekan ke-2' }, { value: '3', label: 'Pekan ke-3' }, { value: '4', label: 'Pekan ke-4' }, { value: '5', label: 'Pekan terakhir' }];
const HARI_OPS = HARI_NAMA.map((label, i) => ({ value: String(i), label }));
const BULAN_OPS = BULAN_NAMA.map((label, i) => ({ value: String(i + 1), label }));
const BULAN_H_OPS = BULAN_HIJRI.map((label, i) => ({ value: String(i + 1), label }));
const GESER_OPS = [
  { value: '0', label: 'Ikuti kalender Umm al-Qura (bawaan)' },
  { value: '-1', label: 'Sehari lebih lambat (sering cocok dgn penetapan Kemenag RI)' },
  { value: '1', label: 'Sehari lebih cepat' },
];
const HIJRI = ADA('hijriah_bulanan', 'hijriah_tahunan');
// `when` = field hanya tampil bila fungsi mengembalikan true (lihat FormFields)
const RTN_FIELDS = [
  { name: 'judul', label: 'Nama Kegiatan Rutin', required: true },
  { name: 'frekuensi', label: 'Pengulangan', type: 'select', options: FREKUENSI },
  { name: 'hari', label: 'Hari pelaksanaan', type: 'checks', options: HARI_OPS, init: [], when: ADA('mingguan') },
  { name: 'pekanKe', label: 'Pekan ke-', type: 'select', options: PEKAN_OPS, when: ADA('bulanan_pekan') },
  { name: 'hariPekan', label: 'Hari', type: 'select', options: HARI_OPS, init: '5', when: ADA('bulanan_pekan') },
  { name: 'tanggal', label: 'Tanggal (angka terakhir bulan dipakai bila bulannya lebih pendek)', type: 'number', min: 1, init: 1, when: ADA('bulanan_tanggal', 'tahunan', 'hijriah_tahunan') },
  { name: 'bulan', label: 'Bulan', type: 'select', options: BULAN_OPS, when: ADA('tahunan') },
  { name: 'bulanH', label: 'Bulan Hijriah', type: 'select', options: BULAN_H_OPS, when: ADA('hijriah_tahunan') },
  { name: 'tanggalDaftar', label: 'Tanggal Hijriah (1–30, pisahkan koma, mis. 13,14,15)', when: ADA('hijriah_bulanan') },
  { name: 'geserHijri', label: 'Koreksi kalender Hijriah', type: 'select', options: GESER_OPS, when: HIJRI },
  { name: 'mulai', label: 'Mulai berlaku (untuk "2 pekan sekali" = tanggal pelaksanaan pertama)', type: 'date', required: true },
  { name: 'sampai', label: 'Berakhir pada (kosongkan = tanpa batas)', type: 'date' },
  { name: 'jamMulai', label: 'Jam Mulai', type: 'time' },
  { name: 'jamSelesai', label: 'Jam Selesai', type: 'time' },
  { name: 'lokasi', label: 'Lokasi' },
  { name: 'lembaga', label: LEMBAGA_LABEL, type: 'lembaga' },
  { name: 'deskripsi', label: 'Deskripsi', type: 'textarea' },
  { name: 'liburRamadan', label: 'Ditiadakan selama bulan Ramadan?', type: 'select', options: ['Tidak', 'Ya'] },
  { name: 'pengecualian', label: 'Tanggal ditiadakan / libur (opsional). Contoh: 2026-12-25, 2026-12-28..2027-01-02', type: 'textarea', rows: 2 },
  { name: 'aktif', label: 'Tampilkan di beranda', type: 'select', options: ['Ya', 'Tidak'] },
];
const GAL_FIELDS = [
  { name: 'gambarUrl', label: 'Foto', type: 'image', folder: 'galeri', maxSize: 800, quality: 0.65, required: true },
  { name: 'keterangan', label: 'Keterangan' },
  { name: 'tanggal', label: 'Tanggal', type: 'date', required: true },
  { name: 'lembaga', label: LEMBAGA_LABEL, type: 'lembaga' },
];

const byUrutan = (a, b) => (a.urutan || 0) - (b.urutan || 0)
  || String(a.namaLembaga || a.nama || '').localeCompare(String(b.namaLembaga || b.nama || ''));
const byTanggalAsc = (a, b) => String(a.tanggal || '').localeCompare(String(b.tanggal || ''));
const byJudul = (a, b) => String(a.judul || '').localeCompare(String(b.judul || ''));
const byTanggal = (a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || ''));
const initOf = (fields) => Object.fromEntries(fields.map((f) => [f.name,
  f.init !== undefined ? f.init
    : f.type === 'select' ? (typeof f.options[0] === 'object' ? f.options[0].value : f.options[0])
      : f.type === 'checks' ? [] : f.type === 'number' ? 0 : '']));

// Pilihan lembaga (nilai tersimpan = nama). Sub unit tampil menjorok di bawah induknya.
function LembagaSelect({ value, onChange, kosong = 'Umum (seluruh yayasan)' }) {
  const [opts, setOpts] = useState([]);
  useEffect(() => {
    getDocs(collection(getDb(), 'institutions'))
      .then((snap) => setOpts(opsiLembaga(snap.docs.map((d) => ({ id: d.id, ...d.data() })))))
      .catch(() => {});
  }, []);
  const ada = (n) => opts.some((o) => o.nama === n);
  return (
    <select className="inp" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{kosong}</option>
      {opts.map((o) => <option key={o.nama} value={o.nama}>{o.label}</option>)}
      {value && !ada(value) && <option value={value}>{value}</option>}
    </select>
  );
}

// Pilih lembaga induk (hanya lembaga utama) untuk sub unit; nilai tersimpan = ID dokumen
function IndukSelect({ value, onChange }) {
  const [opts, setOpts] = useState([]);
  useEffect(() => {
    getDocs(collection(getDb(), 'institutions'))
      .then((snap) => setOpts(susunLembaga(snap.docs.map((d) => ({ id: d.id, ...d.data() }))).map((u) => ({ id: u.id, nama: u.namaLembaga, kategori: u.kategori }))))
      .catch(() => {});
  }, []);
  return (
    <select className="inp" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Lembaga utama (bukan sub unit) —</option>
      {opts.map((o) => <option key={o.id} value={o.id}>{o.nama} ({o.kategori})</option>)}
      {value && !opts.some((o) => o.id === value) && <option value={value}>(induk tidak ditemukan)</option>}
    </select>
  );
}

function Field({ f, value, onChange }) {
  const [up, setUp] = useState(false);
  const base = { value: value ?? '', required: f.required };
  if (f.type === 'lembaga') return <LembagaSelect value={value} onChange={onChange} kosong={f.kosong} />;
  if (f.type === 'induk') return <IndukSelect value={value} onChange={onChange} />;
  if (f.type === 'textarea') return <textarea rows={f.rows || 3} className="inp" {...base} onChange={(e) => onChange(e.target.value)} />;
  if (f.type === 'select') {
    return (
      <select className="inp" {...base} onChange={(e) => onChange(e.target.value)}>
        {f.options.map((o) => (typeof o === 'object'
          ? <option key={o.value} value={o.value}>{o.label}</option>
          : <option key={o} value={o}>{o}</option>))}
      </select>
    );
  }
  if (f.type === 'color') {
    const v = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000';
    return (
      <div className="flex items-center gap-3">
        <input type="color" value={v} onChange={(e) => onChange(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1" />
        <input className="inp !w-32 font-mono" value={value ?? ''} maxLength={7} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  if (f.type === 'range') {
    return (
      <div className="flex items-center gap-3">
        <input type="range" min={f.min} max={f.max} step={f.step || 1} value={Number(value) || 0} onChange={(e) => onChange(e.target.value)} className="w-full accent-brand-700" />
        <span className="w-12 text-right text-sm tabular-nums">{Number(value) || 0}%</span>
      </div>
    );
  }
  if (f.type === 'checks') {
    const cur = Array.isArray(value) ? value.map(String) : [];
    const toggle = (v) => onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
    return (
      <div className="flex flex-wrap gap-2">
        {f.options.map((o) => (
          <label key={o.value} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${cur.includes(o.value) ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white hover:bg-slate-100'}`}>
            <input type="checkbox" className="sr-only" checked={cur.includes(o.value)} onChange={() => toggle(o.value)} />{o.label}
          </label>
        ))}
      </div>
    );
  }
  if (f.type === 'bukti') return <BuktiField value={value} onChange={onChange} />;
  if (f.type === 'image') {
    const handle = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUp(true);
      try { onChange(await uploadImage(file, f.folder, f.maxSize ? { maxSize: f.maxSize, quality: f.quality } : undefined)); } catch (err) { alert('Upload gagal: ' + err.message); }
      setUp(false);
    };
    return (
      <div className="flex items-center gap-3">
        {value ? <img src={value} alt="" className={f.folder === 'logos' ? 'h-14 max-w-[8rem] object-contain' : `border object-cover ${f.maxSize ? 'h-16 w-24 rounded-lg' : 'h-14 w-14 rounded-full'}`} /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100"><Upload size={18} /></div>}
        <label className="btn-light cursor-pointer">
          {up ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {value ? 'Ganti' : 'Upload'}
          <input type="file" accept="image/*" className="hidden" onChange={handle} />
        </label>
        {f.clearable && value && <button type="button" className="btn-light !text-red-600" onClick={() => onChange('')}><Trash2 size={14} /> Hapus</button>}
      </div>
    );
  }
  return <input type={f.type || 'text'} className="inp" {...base} min={f.min} onChange={(e) => onChange(f.type === 'number' ? e.target.value : e.target.value)} />;
}

function FormFields({ fields, form, setForm, onFieldChange }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.filter((f) => !f.when || f.when(form)).map((f) => (
        <div key={f.name} className={['textarea', 'image', 'bukti', 'checks'].includes(f.type) ? 'sm:col-span-2' : ''}>
          <label className="mb-1 block text-sm font-medium">{f.label}</label>
          <Field f={f} value={form[f.name]} onChange={(v) => { onFieldChange?.(f, form[f.name], v); setForm((p) => ({ ...p, [f.name]: v })); }} />
        </div>
      ))}
    </div>
  );
}

function ProfileTab() {
  const [form, setForm] = useState(initOf(PROFILE_FIELDS));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getDoc(doc(getDb(), 'settings', 'profile')).then((s) => { if (s.exists()) setForm((p) => ({ ...p, ...s.data() })); }).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await setDoc(doc(getDb(), 'settings', 'profile'), form, { merge: true });
      clearCache();
      setMsg('Tersimpan ✓');
    } catch (err) { setMsg('Gagal: ' + err.message); }
    setBusy(false);
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <FormFields fields={PROFILE_FIELDS} form={form} setForm={setForm} />
      <div className="flex items-center gap-3">
        <button className="btn" disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />} Simpan Perubahan</button>
        <span className="text-sm text-slate-500">{msg}</span>
      </div>
    </form>
  );
}

function TampilanTab() {
  const [form, setForm] = useState(DEFAULT_TAMPILAN);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getDoc(doc(getDb(), 'settings', 'tampilan'))
      .then((s) => { if (s.exists()) setForm(mergeTampilan(s.data())); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Pratinjau langsung: warna/font berubah saat diedit (cache baru ditulis setelah Simpan)
  useEffect(() => { if (loaded) applyTheme(form, { cache: false }); }, [form, loaded]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await setDoc(doc(getDb(), 'settings', 'tampilan'), form, { merge: true });
      applyTheme(form);
      clearCache();
      setMsg('Tersimpan ✓ — buka beranda untuk melihat hasilnya');
    } catch (err) { setMsg('Gagal: ' + err.message); }
    setBusy(false);
  };

  const reset = () => {
    if (!confirm('Kembalikan semua pengaturan tampilan ke bawaan? (Foto latar ikut dihapus dari form; klik Simpan untuk menerapkan.)')) return;
    setForm(DEFAULT_TAMPILAN);
  };

  if (!loaded) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-brand-700" /></div>;

  return (
    <form onSubmit={save} className="space-y-6">
      <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
        Warna dan font langsung berubah di halaman ini sebagai pratinjau. Tekan <b>Simpan Tampilan</b> agar berlaku di beranda.
        Pengunjung melihat perubahan paling lambat 10 menit kemudian (cache).
      </p>
      {isCloudinaryOn()
        ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">✓ Cloudinary aktif: foto yang diunggah disimpan di Cloudinary dan tidak memakai kuota Firestore.</p>
        : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">⚠ Cloudinary belum aktif: foto yang diunggah akan disimpan di Firestore dan memakan kuota Spark. Isi <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> dan <code>NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> di Vercel lalu Redeploy, atau tempel URL foto di kolom “URL foto”.</p>}
      {TAMPILAN_GROUPS.map((g) => (
        <section key={g.id} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="font-bold text-brand-800">{g.title}</h3>
          <FormFields fields={g.fields} form={form} setForm={setForm} />
        </section>
      ))}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4 shadow-lg">
        <button className="btn" disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />} Simpan Tampilan</button>
        <button type="button" className="btn-light" onClick={reset}><RotateCcw size={14} /> Kembalikan bawaan</button>
        <span className="text-sm text-slate-500">{msg}</span>
      </div>
    </form>
  );
}

// susun(list) = urutan khusus seluruh daftar; siapkan(data, daftar) = ubah data sebelum disimpan; cegahHapus(item, daftar) = pesan bila tak boleh dihapus
// Unggah banyak foto galeri sekaligus. Tiap foto punya tanggal & keterangan sendiri,
// jadi satu kali unggah bisa berisi foto dari satu tanggal maupun beberapa tanggal berbeda.
// Di HP Android, File dari pemilih foto bisa menjadi tidak terbaca ("Gagal membaca file") bila baru dibaca
// beberapa saat kemudian. Jadi isi foto langsung disalin ke memori saat dipilih, sekaligus diperkecil
// (maks 1600 px) agar 40 foto tidak memenuhi memori HP.
async function salinFoto(file, maks = 1600, kualitas = 0.92) {
  const mentah = new Blob([await file.arrayBuffer()], { type: file.type || 'image/jpeg' });
  return new Promise((resolve) => {
    const url = URL.createObjectURL(mentah);
    const img = new window.Image();
    img.onload = () => {
      try {
        const sk = Math.min(1, maks / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sk);
        c.height = Math.round(img.height * sk);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => resolve(b || mentah), 'image/jpeg', kualitas);
      } catch (err) { URL.revokeObjectURL(url); resolve(mentah); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(mentah); };
    img.src = url;
  });
}

const MAKS_FOTO = 40;
const TGL_OK = /^\d{4}-\d{2}-\d{2}$/;
function GaleriMassal({ onDone }) {
  const [items, setItems] = useState([]); // { key, file, url, tanggal, keterangan, status: ''|'proses'|'ok'|'gagal', err }
  const [tglUmum, setTglUmum] = useState(toStr(new Date()));
  const [lembaga, setLembaga] = useState('');
  const [busy, setBusy] = useState(false);
  const [menyiapkan, setMenyiapkan] = useState(false);
  const [msg, setMsg] = useState('');
  const itemsRef = useRef([]);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const ubah = (key, patch) => setItems((p) => p.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const tambah = async (e) => {
    const input = e.target;
    const files = [...(input.files || [])].filter((f) => f.type.startsWith('image/'));
    if (!files.length) { input.value = ''; return; }
    const sisa = Math.max(0, MAKS_FOTO - itemsRef.current.length);
    const dipilih = files.slice(0, sisa);
    setMenyiapkan(true);
    setMsg('');
    let gagalBaca = 0;
    for (const file of dipilih) { // satu per satu, hemat memori
      try {
        const blob = await salinFoto(file);
        setItems((p) => [...p, {
          key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: blob, url: URL.createObjectURL(blob), tanggal: tglUmum, keterangan: '', status: '', err: '',
        }]);
      } catch (err) { gagalBaca += 1; }
    }
    input.value = ''; // reset setelah semua foto tersalin; foto yang sama bisa dipilih lagi
    setMenyiapkan(false);
    const info = [];
    if (files.length > sisa) info.push(`Maksimal ${MAKS_FOTO} foto per unggahan; ${files.length - sisa} foto tidak dimasukkan.`);
    if (gagalBaca) info.push(`${gagalBaca} foto tidak bisa dibaca — pilih ulang dari galeri HP.`);
    setMsg(info.join(' '));
  };

  const hapus = (key) => {
    const it = itemsRef.current.find((i) => i.key === key);
    if (it) URL.revokeObjectURL(it.url);
    setItems((p) => p.filter((i) => i.key !== key));
  };

  const samakanTanggal = () => setItems((p) => p.map((i) => (i.status === 'ok' ? i : { ...i, tanggal: tglUmum })));

  const unggah = async () => {
    const antre = itemsRef.current.filter((i) => i.status !== 'ok');
    if (!antre.length) return;
    if (antre.some((i) => !TGL_OK.test(i.tanggal))) { setMsg('Tanggal setiap foto wajib diisi.'); return; }
    setBusy(true);
    setMsg('');
    const me = getAuthInstance().currentUser?.email || '';
    let ok = 0;
    let gagal = 0;
    let next = 0;
    const worker = async () => {
      while (next < antre.length) {
        const it = antre[next]; next += 1;
        ubah(it.key, { status: 'proses', err: '' });
        try {
          const gambarUrl = await uploadImage(it.file, 'galeri', { maxSize: 800, quality: 0.65 });
          await addDoc(collection(getDb(), 'gallery'), {
            gambarUrl, keterangan: it.keterangan.trim(), tanggal: it.tanggal, lembaga,
            createdAt: serverTimestamp(), createdBy: me, updatedAt: serverTimestamp(), updatedBy: me,
          });
          ok += 1;
          ubah(it.key, { status: 'ok' });
        } catch (err) {
          gagal += 1;
          ubah(it.key, { status: 'gagal', err: err.message });
        }
      }
    };
    await Promise.all([worker(), worker()]); // 2 foto diproses bersamaan (hemat memori HP)
    if (ok) clearCache();
    itemsRef.current.filter((i) => i.status === 'ok').forEach((i) => URL.revokeObjectURL(i.url));
    setItems((p) => p.filter((i) => i.status !== 'ok'));
    setMsg(gagal ? `${ok} foto tersimpan, ${gagal} gagal — periksa pesan di foto yang gagal lalu tekan Unggah lagi.` : `${ok} foto tersimpan ✓`);
    setBusy(false);
    if (ok) onDone?.();
  };

  const jumlah = items.filter((i) => i.status !== 'ok').length;
  return (
    <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="font-bold">Unggah Banyak Foto Sekaligus</h3>
      <p className="text-sm text-slate-500">Pilih beberapa foto (bisa berkali-kali, maks {MAKS_FOTO}). Tanggal tiap foto bisa disamakan atau diatur sendiri-sendiri.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Tanggal untuk foto yang dipilih</label>
          <div className="flex gap-2">
            <input type="date" className="inp" value={tglUmum} onChange={(e) => setTglUmum(e.target.value)} />
            <button type="button" className="btn-light whitespace-nowrap" disabled={busy || !items.length || !TGL_OK.test(tglUmum)} onClick={samakanTanggal}>Terapkan ke semua</button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{LEMBAGA_LABEL} (berlaku untuk semua foto)</label>
          <LembagaSelect value={lembaga} onChange={setLembaga} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className={`btn-light cursor-pointer ${busy || menyiapkan || items.length >= MAKS_FOTO ? 'pointer-events-none opacity-50' : ''}`}>
          {menyiapkan ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {menyiapkan ? 'Menyiapkan…' : 'Pilih foto'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={tambah} disabled={busy || menyiapkan} />
        </label>
        <button type="button" className="btn" disabled={busy || menyiapkan || !jumlah} onClick={unggah}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Unggah {jumlah ? `${jumlah} foto` : ''}
        </button>
        <span className="text-sm text-slate-500">{msg}</span>
      </div>
      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.key} className="flex items-start gap-3 rounded-xl border p-3">
              <img src={i.url} alt="" className="h-16 w-16 flex-none rounded-lg object-cover" />
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <input type="date" className="inp" value={i.tanggal} disabled={busy} onChange={(e) => ubah(i.key, { tanggal: e.target.value })} />
                <input className="inp" placeholder="Keterangan (opsional)" value={i.keterangan} disabled={busy} onChange={(e) => ubah(i.key, { keterangan: e.target.value })} />
                {i.status === 'proses' && <p className="text-xs text-slate-500 sm:col-span-2">Mengunggah…</p>}
                {i.status === 'gagal' && <p className="text-xs text-red-600 sm:col-span-2">Gagal: {i.err}</p>}
              </div>
              <button type="button" className="btn-light !px-2 !text-red-600" disabled={busy} onClick={() => hapus(i.key)} aria-label="Buang foto"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GaleriTab() {
  const [k, setK] = useState(0); // naikkan = muat ulang daftar galeri setelah unggahan massal
  return (
    <div className="space-y-6">
      <GaleriMassal onDone={() => setK((x) => x + 1)} />
      <CrudTab key={k} col="gallery" fields={GAL_FIELDS} sort={byTanggal}
        renderItem={(g) => (<div className="flex items-center gap-3">{g.gambarUrl && <img src={g.gambarUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />}<div className="min-w-0"><p className="truncate font-semibold">{g.keterangan || 'Tanpa keterangan'}</p><p className="truncate text-slate-500">{g.tanggal} · {g.lembaga || 'Umum'}</p></div></div>)} />
    </div>
  );
}

function CrudTab({ col, fields, sort, renderItem, numberFields = [], onItems, onSaved, audit = false, validate, susun, siapkan, cegahHapus }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initOf(fields));
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const onItemsRef = useRef(onItems);
  onItemsRef.current = onItems;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  // Bukti yang sudah terunggah tetapi belum tersimpan di transaksi: hapus bila diganti/dibatalkan agar tidak jadi dokumen yatim
  const pendingRef = useRef(new Set());
  const trackBukti = (f, prev, next) => {
    if (f.type !== 'bukti' || prev === next) return;
    if (prev && pendingRef.current.has(prev)) { pendingRef.current.delete(prev); deleteBukti(prev); }
    if (next) pendingRef.current.add(next);
  };
  const discardPending = () => {
    const list = [...pendingRef.current];
    pendingRef.current.clear();
    list.forEach((v) => { deleteBukti(v); });
  };
  useEffect(() => () => discardPending(), []); // tinggalkan tab = batalkan unggahan yang belum disimpan

  // Jejak audit (hanya bila audit=true): jejak tambah/ubah/hapus, tidak bisa diubah (lihat firestore.rules)
  const me = () => getAuthInstance().currentUser?.email || '';
  const pick = (o) => (o ? Object.fromEntries(fields.map((f) => [f.name, o[f.name] ?? null])) : null);
  const tulisLog = async (aksi, docId, sebelum, sesudah) => {
    if (!audit) return true;
    try {
      await addDoc(collection(getDb(), 'audit_log'), { koleksi: col, aksi, docId, sebelum: pick(sebelum), sesudah: pick(sesudah), oleh: me(), waktu: serverTimestamp() });
      return true;
    } catch (err) { console.error('Gagal mencatat riwayat:', err); return false; }
  };

  const load = useCallback(async () => {
    try {
      const s = await getDocs(collection(getDb(), col));
      const mentah = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      const list = susun ? susun(mentah) : mentah.sort(sort);
      setItems(list);
      onItemsRef.current?.(list);
      return list;
    } catch (err) { setMsg('Gagal memuat: ' + err.message); return null; }
  }, [col, sort, susun]);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setForm(initOf(fields)); setEditId(null); };

  const save = async (e) => {
    e.preventDefault();
    const visible = fields.filter((f) => !f.when || f.when(form));
    const missing = visible.find((f) => f.required && f.type === 'image' && !form[f.name]);
    if (missing) { setMsg(`${missing.label} wajib diisi`); return; }
    const kecil = visible.find((f) => f.min !== undefined && !(Number(form[f.name]) >= f.min));
    if (kecil) { setMsg(`${kecil.label} minimal ${kecil.min}`); return; }
    const salah = validate?.(form, editId, items);
    if (salah) { setMsg(salah); return; }
    setBusy(true);
    const data = { ...form };
    // buang isian milik field yang sedang tersembunyi (mis. hari saat pengulangan = bulanan)
    fields.filter((f) => f.when && !f.when(form)).forEach((f) => { data[f.name] = initOf([f])[f.name]; });
    numberFields.forEach((n) => { data[n] = Number(data[n]) || 0; });
    if (siapkan) Object.assign(data, siapkan(data, items));
    // bukti yang sedang disimpan tidak boleh ikut dihapus oleh pembersihan unggahan tertunda
    fields.filter((x) => x.type === 'bukti').forEach((f) => pendingRef.current.delete(data[f.name]));
    try {
      const stamp = { updatedAt: serverTimestamp(), updatedBy: me() };
      let logOk;
      if (editId) {
        const old = items.find((x) => x.id === editId);
        await updateDoc(doc(getDb(), col, editId), { ...data, ...stamp });
        // hapus file bukti lama yang sudah diganti/dihapus
        for (const f of fields.filter((x) => x.type === 'bukti')) {
          if (old?.[f.name] && old[f.name] !== data[f.name]) await deleteBukti(old[f.name]);
        }
        logOk = await tulisLog('ubah', editId, old, data);
      } else {
        const ref = await addDoc(collection(getDb(), col), { ...data, createdAt: serverTimestamp(), createdBy: me(), ...stamp });
        logOk = await tulisLog('tambah', ref.id, null, data);
      }
      clearCache();
      setMsg(logOk ? 'Tersimpan ✓' : 'Tersimpan ✓ (riwayat perubahan gagal dicatat)');
      reset();
      const list = await load();
      if (list && onSavedRef.current) await onSavedRef.current(list);
    } catch (err) { setMsg('Gagal: ' + err.message); }
    setBusy(false);
  };

  const remove = async (id) => {
    const blok = cegahHapus?.(items.find((x) => x.id === id) || {}, items);
    if (blok) { setMsg(blok); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!confirm('Hapus data ini?')) return;
    try {
      const old = items.find((x) => x.id === id);
      await deleteDoc(doc(getDb(), col, id));
      for (const f of fields.filter((x) => x.type === 'bukti')) await deleteBukti(old?.[f.name]);
      await tulisLog('hapus', id, old, null);
      clearCache();
      const list = await load();
      if (list && onSavedRef.current) await onSavedRef.current(list);
    } catch (err) { setMsg('Gagal: ' + err.message); }
  };

  const cancel = () => { discardPending(); reset(); };

  const edit = (it) => {
    discardPending();
    setEditId(it.id);
    // `norm` mengubah nilai lama (mis. kategori "Masjid") menjadi nilai sekarang saat form dibuka
    setForm({ ...initOf(fields), ...Object.fromEntries(fields.map((f) => { const v = it[f.name] ?? initOf(fields)[f.name]; return [f.name, f.norm ? f.norm(v) : v]; })) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="font-bold">{editId ? 'Edit Data' : 'Tambah Data'}</h3>
        <FormFields fields={fields} form={form} setForm={setForm} onFieldChange={trackBukti} />
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn" disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {editId ? 'Update' : 'Tambah'}</button>
          {editId && <button type="button" className="btn-light" onClick={cancel}>Batal</button>}
          <span className="text-sm text-slate-500">{msg}</span>
        </div>
      </form>
      <div className="divide-y rounded-2xl bg-white shadow-sm">
        {items.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Belum ada data.</p>}
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1 text-sm">{renderItem(it)}</div>
            <div className="flex shrink-0 gap-2">
              <button className="btn-light" onClick={() => edit(it)} aria-label="Edit"><Pencil size={14} /></button>
              <button className="btn-light !text-red-600" onClick={() => remove(it.id)} aria-label="Hapus"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Riwayat perubahan transaksi kas (koleksi audit_log, tidak bisa diubah/dihapus)
function AuditList() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = async () => {
    setBusy(true);
    setErr('');
    try {
      const s = await getDocs(query(collection(getDb(), 'audit_log'), orderBy('waktu', 'desc'), limit(30)));
      setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { setErr('Gagal memuat riwayat: ' + e.message); }
    setBusy(false);
  };
  const ringkas = (x) => `${x.tipe === 'masuk' ? '+' : '-'}${rupiah(x.jumlah)} · Kas ${x.kategoriUnit} · ${x.tanggal}${x.keterangan ? ` · ${x.keterangan}` : ''}`;
  const waktu = (t) => (t?.seconds ? new Date(t.seconds * 1000).toLocaleString('id-ID') : '');
  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-light" onClick={load} disabled={busy}>
          {busy && <Loader2 size={14} className="animate-spin" />} {rows ? 'Muat ulang riwayat' : 'Lihat riwayat perubahan kas'}
        </button>
        {err && <span className="text-red-600">{err}</span>}
      </div>
      {rows && (rows.length === 0
        ? <p className="text-slate-500">Belum ada riwayat.</p>
        : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="py-2">
                <p className="font-semibold capitalize">{r.aksi} <span className="font-normal normal-case text-slate-500">· {r.oleh} · {waktu(r.waktu)}</span></p>
                {r.sebelum && <p className="text-slate-500">Sebelum: {ringkas(r.sebelum)}</p>}
                {r.sesudah && <p>Sesudah: {ringkas(r.sesudah)}</p>}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

function KasTab() {
  const [trx, setTrx] = useState([]);
  const [listed, setListed] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [nama, setNama] = useState('Yayasan');
  const [inst, setInst] = useState([]); // lembaga & sub unit: untuk validasi penanda dan rincian laporan
  // Perbarui dokumen ringkasan yang dibaca beranda (1 baca, bukan seluruh transaksi)
  const sync = async (list) => {
    setSyncMsg('Memperbarui ringkasan beranda…');
    try { await simpanRingkasan(list); clearCache(); setSyncMsg('Ringkasan beranda diperbarui ✓'); }
    catch (err) { setSyncMsg('Gagal memperbarui ringkasan beranda: ' + err.message); }
  };
  useEffect(() => {
    getDoc(doc(getDb(), 'settings', 'profile')).then((s) => { if (s.exists() && s.data().namaYayasan) setNama(s.data().namaYayasan); }).catch(() => {});
    getDocs(collection(getDb(), 'institutions')).then((s) => setInst(s.docs.map((d) => ({ id: d.id, ...d.data() })))).catch(() => {});
  }, []);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <button type="button" className="btn-light" disabled={!listed} onClick={() => sync(trx)}>Bangun ulang ringkasan</button>
        <span className="text-slate-500">{syncMsg || 'Ringkasan beranda diperbarui otomatis tiap transaksi disimpan/dihapus. Klik tombol ini sekali setelah pembaruan pertama.'}</span>
      </div>
      <CrudTab col="transactions" fields={TRX_FIELDS} sort={byTanggal} numberFields={['jumlah']} onItems={(l) => { setTrx(l); setListed(true); }} onSaved={sync} audit
        validate={(f) => validasiKas(f, inst)}
        renderItem={(t) => (<><p className={`font-semibold ${t.tipe === 'masuk' ? 'text-emerald-700' : 'text-red-600'}`}>{t.tipe === 'masuk' ? '+' : '-'} {rupiah(t.jumlah)} · Kas {normBidang(t.kategoriUnit)}{t.unitId ? ` · ${t.unitId}` : ''} {t.bukti && <Paperclip size={12} className="ml-1 inline text-slate-400" />}</p><p className="truncate text-slate-500">{t.tanggal} · {t.keterangan}</p></>)} />
      <AuditList />
      <div className="rounded-2xl bg-white p-6 shadow-sm"><LaporanKas trx={trx} namaYayasan={nama} lembaga={inst} /></div>
    </div>
  );
}

const TABS = [
  { id: 'profil', label: 'Identitas', icon: Building2 },
  { id: 'tampilan', label: 'Tampilan', icon: Palette },
  { id: 'lembaga', label: 'Lembaga', icon: Landmark },
  { id: 'pengurus', label: 'Pengurus', icon: Users },
  { id: 'kas', label: 'Kas', icon: Wallet },
  { id: 'berita', label: 'Berita', icon: Megaphone },
  { id: 'kegiatan', label: 'Kegiatan', icon: CalendarDays },
  { id: 'rutin', label: 'Rutin', icon: Repeat },
  { id: 'galeri', label: 'Galeri', icon: ImageIcon },
  { id: 'cadangan', label: 'Cadangan', icon: DatabaseBackup },
  { id: 'admin', label: 'Admin', icon: ShieldCheck, pemilik: true }, // hanya pemilik
];

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('profil');

  useEffect(() => {
    let batal = false;
    const unsub = onAuthStateChanged(getAuthInstance(), async (u) => {
      if (!u) { router.replace('/login'); return; }
      const ok = u.emailVerified && await cekAdmin(u);
      if (batal) return;
      if (!ok) { signOut(getAuthInstance()).finally(() => router.replace('/login')); }
      else { setUser(u); setReady(true); }
    });
    return () => { batal = true; unsub(); };
  }, [router]);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-brand-700" /></div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="font-bold text-brand-800">Dashboard Admin</h1>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:block">{user?.email}</span>
            <Link href="/" className="btn-light"><Home size={14} /></Link>
            <button className="btn-light" onClick={async () => { await signOut(getAuthInstance()); router.replace('/login'); }}><LogOut size={14} /> Keluar</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.filter((t) => !t.pemilik || isOwnerEmail(user?.email)).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${tab === t.id ? 'bg-brand-700 text-white' : 'bg-white hover:bg-slate-100'}`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
        {tab === 'profil' && <ProfileTab />}
        {tab === 'tampilan' && <TampilanTab />}
        {tab === 'lembaga' && (
          <>
            <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
              Yayasan bergerak di bidang <b>keagamaan, sosial, dan kemanusiaan</b>; tiap lembaga masuk ke salah satu bidang itu (kolom “Bidang”), dan bidang inilah yang menentukan kas. Lembaga utama dapat memiliki <b>sub unit</b>: pilih lembaga induknya di kolom “Sub unit dari”; sub unit memakai kas induknya. Jenis <b>Usaha</b> hanya untuk sub unit di bawah lembaga bidang <b>{USAHA_DI.join(' / ')}</b> (mis. Masjid), karena yayasan tidak untuk usaha. Nama harus unik karena dipakai sebagai penanda di berita, kegiatan, dan kas.
            </p>
            <CrudTab col="institutions" fields={INST_FIELDS} sort={byUrutan} susun={urutkanLembaga} numberFields={['urutan']}
              siapkan={siapkanLembaga} validate={(f, id, list) => validasiLembaga(f, list, id)} cegahHapus={blokirHapus}
              renderItem={(i) => (
                <div className={i._anak ? 'ml-5 border-l-2 border-brand-100 pl-3' : ''}>
                  <p className="font-semibold">
                    {i._anak && <span className="mr-1 text-slate-400">↳</span>}{i.namaLembaga}{' '}
                    <span className="text-xs text-brand-700">({i._anak ? 'Sub unit' : i.kategori})</span>
                    {i.jenis === 'Usaha' && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Usaha</span>}
                  </p>
                  <p className="truncate text-slate-500">{i.programUnggulan}</p>
                </div>
              )} />
          </>
        )}
        {tab === 'pengurus' && (
          <CrudTab col="board_members" fields={BOARD_FIELDS} sort={byUrutan} numberFields={['urutan']}
            renderItem={(m) => (<><p className="font-semibold">#{m.urutan} {m.nama}</p><p className="text-slate-500">{m.jabatan} · {m.divisi}</p></>)} />
        )}
        {tab === 'kas' && <KasTab />}
        {tab === 'berita' && (
          <CrudTab col="announcements" fields={ANN_FIELDS} sort={byTanggal}
            renderItem={(a) => (<><p className="font-semibold">{a.sematkan === 'Ya' && '📌 '}{a.judul}</p><p className="truncate text-slate-500">{a.tanggal} · {a.lembaga || 'Umum'}</p></>)} />
        )}
        {tab === 'kegiatan' && (
          <CrudTab col="events" fields={EVT_FIELDS} sort={byTanggalAsc}
            renderItem={(e) => (<><p className="font-semibold">{e.judul}</p><p className="truncate text-slate-500">{e.tanggal}{e.jamMulai ? ` · ${e.jamMulai}` : ''} · {e.lembaga || 'Umum'}{e.lokasi ? ` · ${e.lokasi}` : ''}</p></>)} />
        )}
        {tab === 'rutin' && (
          <>
            <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
              Isi aturan pengulangan <b>sekali saja</b> (mis. “Setiap Jumat”, “Setiap tanggal 1”, “Tiap 10 Muharram”). Libur sesekali atau selama Ramadan cukup dicatat di kolom pengecualian. Beranda menghitung tanggal berikutnya otomatis, jadi tidak perlu membuat kegiatan baru tiap pekan/bulan/tahun.
            </p>
            <CrudTab col="routine_events" fields={RTN_FIELDS} sort={byJudul} numberFields={['tanggal']} validate={validasiRutin}
              renderItem={(r) => {
                const nx = berikutnya(r, toStr(new Date()));
                return (<>
                  <p className="font-semibold">{r.aktif === 'Tidak' && '🚫 '}{r.judul} <span className="text-xs font-normal text-brand-700">({polaTeks(r)})</span></p>
                  <p className="truncate text-slate-500">{r.jamMulai ? `${r.jamMulai} · ` : ''}{r.lembaga || 'Umum'}{r.lokasi ? ` · ${r.lokasi}` : ''} · {nx ? `berikutnya ${nx}` : 'sudah berakhir / belum dimulai'}{pengecualianTeks(r) ? ` · ${pengecualianTeks(r)}` : ''}</p>
                </>);
              }} />
          </>
        )}
        {tab === 'cadangan' && <AdminCadangan isOwner={isOwnerEmail(user?.email)} />}
        {tab === 'admin' && isOwnerEmail(user?.email) && <AdminAkses />}
        {tab === 'galeri' && <GaleriTab />}
      </main>
    </div>
  );
}
