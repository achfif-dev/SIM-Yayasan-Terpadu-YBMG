'use client';

import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Loader2, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { getAuthInstance, getDb } from '../lib/firebase';
import { ownerEmails } from '../lib/admin';
import { isiLog, refLog } from '../lib/audit';

const EMAIL_RE = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
const waktu = (t) => (t?.seconds ? new Date(t.seconds * 1000).toLocaleDateString('id-ID') : '');

// Kelola admin tambahan (hanya pemilik). Disimpan di koleksi `admins`, ID dokumen = email huruf kecil.
export default function AdminAkses() {
  const [rows, setRows] = useState(null);
  const [email, setEmail] = useState('');
  const [catatan, setCatatan] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const s = await getDocs(collection(getDb(), 'admins'));
      setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id)));
    } catch (e) { setMsg('Gagal memuat: ' + e.message); setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const tambah = async (e) => {
    e.preventDefault();
    const id = email.trim().toLowerCase();
    if (!EMAIL_RE.test(id)) { setMsg('Format email tidak valid'); return; }
    if (ownerEmails().includes(id)) { setMsg('Email ini sudah pemilik (selalu punya akses).'); return; }
    setBusy(true); setMsg('');
    try {
      const b = writeBatch(getDb());
      b.set(doc(getDb(), 'admins', id), { email: id, catatan: catatan.trim(), ditambahOleh: getAuthInstance().currentUser?.email || '', dibuat: serverTimestamp() });
      b.set(refLog(), isiLog({ koleksi: 'admins', aksi: 'tambah', docId: id, sesudah: { catatan: catatan.trim() || null }, sumber: 'akses' }));
      await b.commit();
      setEmail(''); setCatatan(''); setMsg(`✅ ${id} ditambahkan sebagai admin.`);
      await load();
    } catch (err) { setMsg('Gagal menambah: ' + err.message); }
    setBusy(false);
  };

  const hapus = async (id) => {
    if (!window.confirm(`Cabut akses admin untuk ${id}?`)) return;
    try {
      const b = writeBatch(getDb());
      b.delete(doc(getDb(), 'admins', id));
      b.set(refLog(), isiLog({ koleksi: 'admins', aksi: 'hapus', docId: id, sumber: 'akses' }));
      await b.commit();
      setMsg(`Akses ${id} dicabut.`); await load(); } catch (err) { setMsg('Gagal mencabut: ' + err.message); }
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
        Admin tambahan bisa mengelola semua isi situs, tetapi <b>tidak</b> bisa menambah/mencabut admin lain dan tidak melihat tab ini. Tidak perlu mengubah <code>.env</code>, <code>firestore.rules</code>, atau deploy ulang.
        Orang yang ditambahkan harus punya akun di Firebase Authentication (email+password yang dibuat di Console, atau masuk dengan Google) dan <b>email-nya terverifikasi</b>.
      </p>

      <form onSubmit={tambah} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto]">
        <input type="email" required className="inp" placeholder="Email admin baru" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="inp" placeholder="Catatan (mis. Bendahara)" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        <button className="btn" disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Tambah</button>
      </form>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}

      <ul className="divide-y rounded-2xl bg-white p-2 text-sm shadow-sm">
        {ownerEmails().map((m) => (
          <li key={m} className="flex items-center gap-2 p-3"><ShieldCheck size={16} className="text-brand-700" /><span className="font-semibold">{m}</span><span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">Pemilik</span></li>
        ))}
        {rows === null && <li className="p-3"><Loader2 size={16} className="animate-spin text-brand-700" /></li>}
        {rows?.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{r.id}</p>
              <p className="truncate text-xs text-slate-500">{[r.catatan, r.ditambahOleh && `oleh ${r.ditambahOleh}`, waktu(r.dibuat)].filter(Boolean).join(' · ')}</p>
            </div>
            <button className="btn-light !px-2 text-red-600" onClick={() => hapus(r.id)} aria-label={`Cabut ${r.id}`}><Trash2 size={14} /></button>
          </li>
        ))}
        {rows?.length === 0 && <li className="p-3 text-slate-500">Belum ada admin tambahan.</li>}
      </ul>
    </div>
  );
}
