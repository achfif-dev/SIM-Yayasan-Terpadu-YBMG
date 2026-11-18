'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import {
  Landmark, GraduationCap, HeartHandshake, Building2, Phone, Mail, MapPin,
  Wallet, Users, Menu, X, Star, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react';
import { getDb } from '../lib/firebase';
import LaporanKas from '../components/LaporanKas';
import Konten from '../components/Konten';

const DEFAULT_PROFILE = {
  namaYayasan: 'Yayasan Kita Bersama',
  tagline: 'Melayani umat melalui ibadah, pendidikan, dan kepedulian sosial',
  deskripsi: 'Yayasan yang menaungi Masjid, Lembaga Pendidikan, dan Lembaga Sosial untuk kemaslahatan umat. Data yayasan dapat diubah melalui panel admin.',
  logoUrl: '',
  alamat: 'Alamat yayasan belum diisi',
  telepon: '-',
  email: '-',
  rekeningDonasi: '-',
};

const UNITS = ['Masjid', 'Pendidikan', 'Sosial'];
const DIVISI = ['Pembina', 'Pengawas', 'Pengurus Harian', 'Unit'];
const ICONS = { Masjid: Landmark, Pendidikan: GraduationCap, Sosial: HeartHandshake };
const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

function Logo({ url, size = 40 }) {
  if (url) {
    // Logo tampil apa adanya: tanpa bingkai, tanpa latar, mengikuti bentuk aslinya
    return <img src={url} alt="Logo" className="object-contain" style={{ height: size, width: 'auto', maxWidth: size * 2.5 }} />;
  }
  return (
    <div className="flex items-center justify-center rounded-full bg-brand-100 text-brand-700" style={{ width: size, height: size }}>
      <Building2 size={size * 0.55} />
    </div>
  );
}

export default function HomePage() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [institutions, setInstitutions] = useState([]);
  const [members, setMembers] = useState([]);
  const [trx, setTrx] = useState([]);
  const [filter, setFilter] = useState('Semua');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const db = getDb();
        const [p, i, m, t] = await Promise.all([
          getDoc(doc(db, 'settings', 'profile')),
          getDocs(collection(db, 'institutions')),
          getDocs(collection(db, 'board_members')),
          getDocs(collection(db, 'transactions')),
        ]);
        if (!alive) return;
        if (p.exists()) setProfile({ ...DEFAULT_PROFILE, ...p.data() });
        setInstitutions(i.docs.map((d) => ({ id: d.id, ...d.data() })));
        setMembers(m.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.urutan || 0) - (b.urutan || 0)));
        setTrx(t.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Gagal memuat data:', err);
      }
    })();
    return () => { alive = false; };
  }, []);

  const saldo = useMemo(() => {
    const s = Object.fromEntries(UNITS.map((u) => [u, { masuk: 0, keluar: 0 }]));
    trx.forEach((t) => {
      const k = t.kategoriUnit;
      if (!s[k]) return;
      if (t.tipe === 'masuk') s[k].masuk += Number(t.jumlah) || 0;
      else s[k].keluar += Number(t.jumlah) || 0;
    });
    return s;
  }, [trx]);

  const shown = filter === 'Semua' ? institutions : institutions.filter((x) => x.kategori === filter);
  const nav = [['Profil', '#profil'], ['Lembaga', '#lembaga'], ['Berita', '#berita'], ['Galeri', '#galeri'], ['Pengurus', '#pengurus'], ['Keuangan', '#keuangan'], ['Kontak', '#kontak']];

  return (
    <div>
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <a href="#" className="flex items-center gap-3">
            <Logo url={profile.logoUrl} />
            <span className="font-bold text-brand-800">{profile.namaYayasan}</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            {nav.map(([l, h]) => <a key={h} href={h} className="hover:text-brand-700">{l}</a>)}
            <Link href="/login" className="btn !py-1.5">Admin</Link>
          </nav>
          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
        </div>
        {open && (
          <div className="space-y-2 border-t bg-white px-4 py-3 md:hidden">
            {nav.map(([l, h]) => <a key={h} href={h} onClick={() => setOpen(false)} className="block py-1">{l}</a>)}
            <Link href="/login" className="btn w-full">Admin</Link>
          </div>
        )}
      </header>

      <section className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-4 py-20 text-center text-white">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 flex justify-center"><Logo url={profile.logoUrl} size={96} /></div>
          <h1 className="text-3xl font-extrabold sm:text-5xl">{profile.namaYayasan}</h1>
          <p className="mt-4 text-lg text-brand-100">{profile.tagline}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#lembaga" className="rounded-lg bg-white px-5 py-2.5 font-semibold text-brand-800">Lihat Lembaga</a>
            <a href="#keuangan" className="rounded-lg border border-white/60 px-5 py-2.5 font-semibold">Transparansi Kas</a>
          </div>
        </div>
      </section>

      <section id="profil" className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="text-2xl font-bold">Profil Yayasan</h2>
        <p className="mt-4 whitespace-pre-line leading-relaxed text-slate-600">{profile.deskripsi}</p>
      </section>

      <section id="lembaga" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold">Lembaga di Bawah Naungan</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['Semua', ...UNITS].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${filter === f ? 'bg-brand-700 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>{f}</button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="mt-10 text-center text-slate-500">Belum ada data lembaga.</p>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((x) => {
                const Icon = ICONS[x.kategori] || Building2;
                return (
                  <article key={x.id} className="rounded-2xl border bg-slate-50 p-6 transition hover:-translate-y-1 hover:shadow-lg">
                    <div className="flex items-center gap-3">
                      {x.logoUrl ? <Logo url={x.logoUrl} size={48} /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Icon size={24} /></div>}
                      <div>
                        <h3 className="font-bold">{x.namaLembaga}</h3>
                        <span className="text-xs font-semibold text-brand-700">{x.kategori}</span>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-slate-600">{x.deskripsi}</p>
                    {x.kepalaUnit && <p className="mt-3 text-sm"><span className="text-slate-500">Kepala Unit:</span> <b>{x.kepalaUnit}</b></p>}
                    {x.programUnggulan && (
                      <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600"><Star size={14} className="mt-0.5 shrink-0 text-amber-500" />{x.programUnggulan}</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Konten institutions={institutions} />

      <section id="pengurus" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="flex items-center justify-center gap-2 text-center text-2xl font-bold"><Users /> Struktur Kepengurusan</h2>
        {members.length === 0 && <p className="mt-10 text-center text-slate-500">Belum ada data pengurus.</p>}
        {DIVISI.map((dv) => {
          const list = members.filter((m) => m.divisi === dv);
          if (!list.length) return null;
          return (
            <div key={dv} className="mt-10">
              <h3 className="mb-4 text-center text-sm font-bold uppercase tracking-widest text-brand-700">{dv}</h3>
              <div className="flex flex-wrap justify-center gap-6">
                {list.map((m) => (
                  <div key={m.id} className="w-40 text-center">
                    <div className="mx-auto mb-2 h-24 w-24 overflow-hidden rounded-full bg-slate-200">
                      {m.fotoUrl ? <Image src={m.fotoUrl} alt={m.nama || 'Pengurus'} width={96} height={96} unoptimized className="h-24 w-24 object-cover" /> : <Users className="m-6 text-slate-400" size={48} />}
                    </div>
                    <p className="font-semibold">{m.nama}</p>
                    <p className="text-xs text-slate-500">{m.jabatan}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section id="keuangan" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="flex items-center justify-center gap-2 text-2xl font-bold"><Wallet /> Transparansi Keuangan</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {UNITS.map((u) => {
              const Icon = ICONS[u];
              const s = saldo[u];
              return (
                <div key={u} className="rounded-2xl border bg-slate-50 p-6">
                  <div className="flex items-center gap-2 font-bold text-brand-800"><Icon size={20} /> Kas {u}</div>
                  <p className="mt-3 text-2xl font-extrabold">{rupiah(s.masuk - s.keluar)}</p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p className="flex items-center gap-2 text-emerald-700"><ArrowDownCircle size={16} /> Masuk: {rupiah(s.masuk)}</p>
                    <p className="flex items-center gap-2 text-red-600"><ArrowUpCircle size={16} /> Keluar: {rupiah(s.keluar)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <LaporanKas trx={trx} namaYayasan={profile.namaYayasan} />
          <p className="mt-10 text-center text-sm text-slate-500">Rekening donasi: <b>{profile.rekeningDonasi}</b></p>
        </div>
      </section>

      <footer id="kontak" className="bg-brand-900 px-4 py-12 text-brand-100">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2">
          <div className="flex items-start gap-3">
            <Logo url={profile.logoUrl} size={48} />
            <div>
              <p className="font-bold text-white">{profile.namaYayasan}</p>
              <p className="text-sm">{profile.tagline}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2"><MapPin size={16} /> {profile.alamat}</p>
            <p className="flex items-center gap-2"><Phone size={16} /> {profile.telepon}</p>
            <p className="flex items-center gap-2"><Mail size={16} /> {profile.email}</p>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-brand-100/70">© {new Date().getFullYear()} {profile.namaYayasan}</p>
      </footer>
    </div>
  );
}
