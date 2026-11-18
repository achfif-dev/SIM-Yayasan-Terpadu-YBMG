'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { Building2, Landmark, Users, Wallet, LogOut, Loader2, Pencil, Trash2, Plus, Upload, Home } from 'lucide-react';
import Link from 'next/link';
import { getAuthInstance, getDb } from '../../lib/firebase';
import { uploadImage } from '../../lib/upload';

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
  { name: 'jumlah', label: 'Jumlah (Rp)', type: 'number', required: true },
  { name: 'keterangan', label: 'Keterangan', type: 'textarea' },
];

const byUrutan = (a, b) => (a.urutan || 0) - (b.urutan || 0);
const byTanggal = (a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || ''));
const initOf = (fields) => Object.fromEntries(fields.map((f) => [f.name, f.type === 'select' ? f.options[0] : f.type === 'number' ? 0 : '']));

function Field({ f, value, onChange }) {
  const [up, setUp] = useState(false);
  const base = { value: value ?? '', required: f.required };
  if (f.type === 'textarea') return <textarea rows={3} className="inp" {...base} onChange={(e) => onChange(e.target.value)} />;
  if (f.type === 'select') {
    return (
      <select className="inp" {...base} onChange={(e) => onChange(e.target.value)}>
        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (f.type === 'image') {
    const handle = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUp(true);
      try { onChange(await uploadImage(file, f.folder)); } catch (err) { alert('Upload gagal: ' + err.message); }
      setUp(false);
    };
    return (
      <div className="flex items-center gap-3">
        {value ? <img src={value} alt="" className="h-14 w-14 rounded-full border object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100"><Upload size={18} /></div>}
        <label className="btn-light cursor-pointer">
          {up ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {value ? 'Ganti' : 'Upload'}
          <input type="file" accept="image/*" className="hidden" onChange={handle} />
        </label>
      </div>
    );
  }
  return <input type={f.type || 'text'} className="inp" {...base} onChange={(e) => onChange(f.type === 'number' ? e.target.value : e.target.value)} />;
}

function FormFields({ fields, form, setForm }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.name} className={f.type === 'textarea' || f.type === 'image' ? 'sm:col-span-2' : ''}>
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

function CrudTab({ col, fields, sort, renderItem, numberFields = [] }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initOf(fields));
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const s = await getDocs(collection(getDb(), col));
      setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sort));
    } catch (err) { setMsg('Gagal memuat: ' + err.message); }
  }, [col, sort]);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setForm(initOf(fields)); setEditId(null); };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const data = { ...form };
    numberFields.forEach((n) => { data[n] = Number(data[n]) || 0; });
    try {
      if (editId) await updateDoc(doc(getDb(), col, editId), data);
      else await addDoc(collection(getDb(), col), { ...data, createdAt: serverTimestamp() });
      setMsg('Tersimpan ✓');
      reset();
      await load();
    } catch (err) { setMsg('Gagal: ' + err.message); }
    setBusy(false);
  };

  const remove = async (id) => {
    if (!confirm('Hapus data ini?')) return;
    try { await deleteDoc(doc(getDb(), col, id)); await load(); } catch (err) { setMsg('Gagal: ' + err.message); }
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

const TABS = [
  { id: 'profil', label: 'Identitas', icon: Building2 },
  { id: 'lembaga', label: 'Lembaga', icon: Landmark },
  { id: 'pengurus', label: 'Pengurus', icon: Users },
  { id: 'kas', label: 'Kas', icon: Wallet },
];

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('profil');

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuthInstance(), (u) => {
      if (!u) router.replace('/login');
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
        {tab === 'lembaga' && (
          <CrudTab col="institutions" fields={INST_FIELDS} sort={byUrutan}
            renderItem={(i) => (<><p className="font-semibold">{i.namaLembaga} <span className="text-xs text-brand-700">({i.kategori})</span></p><p className="truncate text-slate-500">{i.programUnggulan}</p></>)} />
        )}
        {tab === 'pengurus' && (
          <CrudTab col="board_members" fields={BOARD_FIELDS} sort={byUrutan} numberFields={['urutan']}
            renderItem={(m) => (<><p className="font-semibold">#{m.urutan} {m.nama}</p><p className="text-slate-500">{m.jabatan} · {m.divisi}</p></>)} />
        )}
        {tab === 'kas' && (
          <CrudTab col="transactions" fields={TRX_FIELDS} sort={byTanggal} numberFields={['jumlah']}
            renderItem={(t) => (<><p className={`font-semibold ${t.tipe === 'masuk' ? 'text-emerald-700' : 'text-red-600'}`}>{t.tipe === 'masuk' ? '+' : '-'} {rupiah(t.jumlah)} · Kas {t.kategoriUnit}</p><p className="truncate text-slate-500">{t.tanggal} · {t.keterangan}</p></>)} />
        )}
      </main>
    </div>
  );
}
