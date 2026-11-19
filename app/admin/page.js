'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { Building2, Landmark, Users, Wallet, LogOut, Loader2, Pencil, Trash2, Plus, Upload, Home, Paperclip, Megaphone, CalendarDays, Image as ImageIcon, Palette, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { getAuthInstance, getDb } from '../../lib/firebase';
import { isAdminEmail } from '../../lib/admin';
import { uploadImage, deleteBukti } from '../../lib/upload';
import { BuktiField } from '../../components/Bukti';
import LaporanKas from '../../components/LaporanKas';
import { DEFAULT_TAMPILAN, TAMPILAN_GROUPS, applyTheme, mergeTampilan } from '../../lib/tampilan';
import { clearCache } from '../../lib/hemat';
import { simpanRingkasan } from '../../lib/ringkasan';
import { isCloudinaryOn } from '../../lib/cdn';

const KATEGORI = ['Masjid', 'Pendidikan', 'Sosial'];
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
  { name: 'namaLembaga', label: 'Nama Lembaga', required: true },
  { name: 'kategori', label: 'Kategori', type: 'select', options: KATEGORI },
  { name: 'deskripsi', label: 'Deskripsi', type: 'textarea' },
  { name: 'logoUrl', label: 'Logo Lembaga', type: 'image', folder: 'logos' },
  { name: 'kepalaUnit', label: 'Kepala Unit' },
  { name: 'programUnggulan', label: 'Program Unggulan', type: 'textarea' },
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
  { name: 'kategoriUnit', label: 'Unit (Kas)', type: 'select', options: KATEGORI },
  { name: 'unitId', label: 'Nama Lembaga (opsional)' },
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
const GAL_FIELDS = [
  { name: 'gambarUrl', label: 'Foto', type: 'image', folder: 'galeri', maxSize: 800, quality: 0.65, required: true },
  { name: 'keterangan', label: 'Keterangan' },
  { name: 'tanggal', label: 'Tanggal', type: 'date', required: true },
  { name: 'lembaga', label: LEMBAGA_LABEL, type: 'lembaga' },
];

const byUrutan = (a, b) => (a.urutan || 0) - (b.urutan || 0);
const byTanggalAsc = (a, b) => String(a.tanggal || '').localeCompare(String(b.tanggal || ''));
const byTanggal = (a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || ''));
const initOf = (fields) => Object.fromEntries(fields.map((f) => [f.name, f.type === 'select' ? f.options[0] : f.type === 'number' ? 0 : '']));

function LembagaSelect({ value, onChange }) {
  const [opts, setOpts] = useState([]);
  useEffect(() => {
    getDocs(collection(getDb(), 'institutions'))
      .then((snap) => setOpts(snap.docs.map((d) => d.data().namaLembaga).filter(Boolean).sort()))
      .catch(() => {});
  }, []);
  const list = value && !opts.includes(value) ? [...opts, value] : opts;
  return (
    <select className="inp" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">Umum (seluruh yayasan)</option>
      {list.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

function Field({ f, value, onChange }) {
  const [up, setUp] = useState(false);
  const base = { value: value ?? '', required: f.required };
  if (f.type === 'lembaga') return <LembagaSelect value={value} onChange={onChange} />;
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

function FormFields({ fields, form, setForm }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.name} className={f.type === 'textarea' || f.type === 'image' || f.type === 'bukti' ? 'sm:col-span-2' : ''}>
          <label className="mb-1 block text-sm font-medium">{f.label}</label>
          <Field f={f} value={form[f.name]} onChange={(v) => setForm((p) => ({ ...p, [f.name]: v }))} />
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

function CrudTab({ col, fields, sort, renderItem, numberFields = [], onItems, onSaved }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initOf(fields));
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const onItemsRef = useRef(onItems);
  onItemsRef.current = onItems;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const load = useCallback(async () => {
    try {
      const s = await getDocs(collection(getDb(), col));
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sort);
      setItems(list);
      onItemsRef.current?.(list);
      return list;
    } catch (err) { setMsg('Gagal memuat: ' + err.message); return null; }
  }, [col, sort]);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setForm(initOf(fields)); setEditId(null); };

  const save = async (e) => {
    e.preventDefault();
    const missing = fields.find((f) => f.required && f.type === 'image' && !form[f.name]);
    if (missing) { setMsg(`${missing.label} wajib diisi`); return; }
    const kecil = fields.find((f) => f.min !== undefined && !(Number(form[f.name]) >= f.min));
    if (kecil) { setMsg(`${kecil.label} minimal ${kecil.min}`); return; }
    setBusy(true);
    const data = { ...form };
    numberFields.forEach((n) => { data[n] = Number(data[n]) || 0; });
    try {
      if (editId) {
        const old = items.find((x) => x.id === editId);
        await updateDoc(doc(getDb(), col, editId), data);
        // hapus file bukti lama yang sudah diganti/dihapus
        for (const f of fields.filter((x) => x.type === 'bukti')) {
          if (old?.[f.name] && old[f.name] !== data[f.name]) await deleteBukti(old[f.name]);
        }
      } else await addDoc(collection(getDb(), col), { ...data, createdAt: serverTimestamp() });
      clearCache();
      setMsg('Tersimpan ✓');
      reset();
      const list = await load();
      if (list && onSavedRef.current) await onSavedRef.current(list);
    } catch (err) { setMsg('Gagal: ' + err.message); }
    setBusy(false);
  };

  const remove = async (id) => {
    if (!confirm('Hapus data ini?')) return;
    try {
      const old = items.find((x) => x.id === id);
      await deleteDoc(doc(getDb(), col, id));
      for (const f of fields.filter((x) => x.type === 'bukti')) await deleteBukti(old?.[f.name]);
      clearCache();
      const list = await load();
      if (list && onSavedRef.current) await onSavedRef.current(list);
    } catch (err) { setMsg('Gagal: ' + err.message); }
  };

  const edit = (it) => {
    setEditId(it.id);
    setForm({ ...initOf(fields), ...Object.fromEntries(fields.map((f) => [f.name, it[f.name] ?? initOf(fields)[f.name]])) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="font-bold">{editId ? 'Edit Data' : 'Tambah Data'}</h3>
        <FormFields fields={fields} form={form} setForm={setForm} />
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn" disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {editId ? 'Update' : 'Tambah'}</button>
          {editId && <button type="button" className="btn-light" onClick={reset}>Batal</button>}
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

function KasTab() {
  const [trx, setTrx] = useState([]);
  const [listed, setListed] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [nama, setNama] = useState('Yayasan');
  // Perbarui dokumen ringkasan yang dibaca beranda (1 baca, bukan seluruh transaksi)
  const sync = async (list) => {
    setSyncMsg('Memperbarui ringkasan beranda…');
    try { await simpanRingkasan(list); clearCache(); setSyncMsg('Ringkasan beranda diperbarui ✓'); }
    catch (err) { setSyncMsg('Gagal memperbarui ringkasan beranda: ' + err.message); }
  };
  useEffect(() => {
    getDoc(doc(getDb(), 'settings', 'profile')).then((s) => { if (s.exists() && s.data().namaYayasan) setNama(s.data().namaYayasan); }).catch(() => {});
  }, []);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <button type="button" className="btn-light" disabled={!listed} onClick={() => sync(trx)}>Bangun ulang ringkasan</button>
        <span className="text-slate-500">{syncMsg || 'Ringkasan beranda diperbarui otomatis tiap transaksi disimpan/dihapus. Klik tombol ini sekali setelah pembaruan pertama.'}</span>
      </div>
      <CrudTab col="transactions" fields={TRX_FIELDS} sort={byTanggal} numberFields={['jumlah']} onItems={(l) => { setTrx(l); setListed(true); }} onSaved={sync}
        renderItem={(t) => (<><p className={`font-semibold ${t.tipe === 'masuk' ? 'text-emerald-700' : 'text-red-600'}`}>{t.tipe === 'masuk' ? '+' : '-'} {rupiah(t.jumlah)} · Kas {t.kategoriUnit} {t.bukti && <Paperclip size={12} className="ml-1 inline text-slate-400" />}</p><p className="truncate text-slate-500">{t.tanggal} · {t.keterangan}</p></>)} />
      <div className="rounded-2xl bg-white p-6 shadow-sm"><LaporanKas trx={trx} namaYayasan={nama} /></div>
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
  { id: 'galeri', label: 'Galeri', icon: ImageIcon },
];

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('profil');

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuthInstance(), (u) => {
      if (!u) router.replace('/login');
      else if (!isAdminEmail(u.email) || !u.emailVerified) { signOut(getAuthInstance()).finally(() => router.replace('/login')); }
      else { setUser(u); setReady(true); }
    });
    return () => unsub();
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
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${tab === t.id ? 'bg-brand-700 text-white' : 'bg-white hover:bg-slate-100'}`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
        {tab === 'profil' && <ProfileTab />}
        {tab === 'tampilan' && <TampilanTab />}
        {tab === 'lembaga' && (
          <CrudTab col="institutions" fields={INST_FIELDS} sort={byUrutan}
            renderItem={(i) => (<><p className="font-semibold">{i.namaLembaga} <span className="text-xs text-brand-700">({i.kategori})</span></p><p className="truncate text-slate-500">{i.programUnggulan}</p></>)} />
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
        {tab === 'galeri' && (
          <CrudTab col="gallery" fields={GAL_FIELDS} sort={byTanggal}
            renderItem={(g) => (<div className="flex items-center gap-3">{g.gambarUrl && <img src={g.gambarUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />}<div className="min-w-0"><p className="truncate font-semibold">{g.keterangan || 'Tanpa keterangan'}</p><p className="truncate text-slate-500">{g.tanggal} · {g.lembaga || 'Umum'}</p></div></div>)} />
        )}
      </main>
    </div>
  );
}
