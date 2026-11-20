'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import {
  Landmark, Heart, HeartHandshake, Building2, Phone, Mail, MapPin,
  Wallet, Users, Menu, X, Star, ArrowDownCircle, ArrowUpCircle, Loader2,
} from 'lucide-react';
import { getDb } from '../lib/firebase';
import LaporanKas from '../components/LaporanKas';
import { susunLembaga } from '../lib/lembaga';
import { BIDANG, gabungBidang, normBidang } from '../lib/bidang';
import Konten from '../components/Konten';
import SocialIcons from '../components/SocialIcons';
import { DEFAULT_TAMPILAN, HERO_PAD, applyTheme, heroPhotoStyle, heroSrc, isYa, mergeTampilan, socialLinks } from '../lib/tampilan';
import { optimizeUrl } from '../lib/cdn';
import { CACHE_TTL, cached, useInView } from '../lib/hemat';
import { catatKunjungan } from '../lib/statistik';
import { EVENT_SIAP } from '../components/Splash';

const DEFAULT_PROFILE = {
  namaYayasan: 'Yayasan Kita Bersama',
  tagline: 'Melayani umat melalui ibadah, pendidikan, dan kepedulian sosial',
  deskripsi: 'Yayasan yang bergerak di bidang keagamaan, sosial, dan kemanusiaan untuk kemaslahatan umat. Data yayasan dapat diubah melalui panel admin.',
  logoUrl: '',
  alamat: 'Alamat yayasan belum diisi',
  telepon: '-',
  email: '-',
  rekeningDonasi: '-',
};

// Sebelum data Firestore selesai dimuat, jangan tampilkan nama bawaan (mencegah "kedip" nama yang salah saat refresh)
const EMPTY_PROFILE = { namaYayasan: '', tagline: '', deskripsi: '', logoUrl: '', alamat: '', telepon: '', email: '', rekeningDonasi: '' };

const UNITS = BIDANG; // keagamaan, sosial, kemanusiaan (sesuai AD/ART; lihat lib/bidang.js)
const DIVISI = ['Pembina', 'Pengawas', 'Pengurus Harian', 'Unit'];
const ICONS = { Keagamaan: Landmark, Sosial: HeartHandshake, Kemanusiaan: Heart };
const fetchTrx = async () => {
  const t = await getDocs(collection(getDb(), 'transactions'));
  return t.docs.map((x) => ({ id: x.id, ...x.data() }));
};
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
  const [profileRaw, setProfile] = useState(null); // null = belum dimuat
  const profile = profileRaw || EMPTY_PROFILE;
  const profileReady = profileRaw !== null;
  const [tpl, setTpl] = useState(DEFAULT_TAMPILAN);
  const [institutions, setInstitutions] = useState([]);
  const [members, setMembers] = useState([]);
  const [trx, setTrx] = useState(null); // null = rincian transaksi belum dimuat
  const [ringkasan, setRingkasan] = useState(null);
  const [kasReady, setKasReady] = useState(false);
  const [kasError, setKasError] = useState('');
  const [laporanError, setLaporanError] = useState('');
  const [trxLoading, setTrxLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const keuRef = useRef(null);
  const [filter, setFilter] = useState('Semua');
  const [open, setOpen] = useState(false);

  useEffect(() => { catatKunjungan(); }, []);

  // Beranda dianggap siap (layar pembuka dibuka) setelah profil + tema termuat DAN foto hero (bila ada) selesai diunduh,
  // supaya tidak ada tampilan bawaan / hero polos yang berganti beberapa detik setelah refresh.
  useEffect(() => {
    if (!profileReady) return undefined;
    let sudah = false;
    const siap = () => {
      if (sudah) return;
      sudah = true;
      window.__ybmgSiap = true;
      window.dispatchEvent(new Event(EVENT_SIAP));
    };
    const src = optimizeUrl(heroSrc(tpl), 1600);
    if (!src) { siap(); return undefined; }
    const img = new window.Image();
    img.onload = siap;
    img.onerror = siap;
    img.src = src;
    const t = setTimeout(siap, 2500); // jangan tunggu foto lebih dari 2,5 detik
    return () => clearTimeout(t);
  }, [profileReady, tpl]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Data beranda di-cache 10 menit di browser pengunjung (hemat baca Firestore)
        const d = await cached('home-v1', CACHE_TTL, async () => {
          const db = getDb();
          const [p, tp, i, m] = await Promise.all([
            getDoc(doc(db, 'settings', 'profile')),
            getDoc(doc(db, 'settings', 'tampilan')),
            getDocs(collection(db, 'institutions')),
            getDocs(collection(db, 'board_members')),
          ]);
          return {
            profile: p.exists() ? p.data() : null,
            tampilan: tp.exists() ? tp.data() : null,
            institutions: i.docs.map((x) => ({ id: x.id, ...x.data() }))
              .sort((x, y) => (x.urutan || 0) - (y.urutan || 0) || String(x.namaLembaga || '').localeCompare(String(y.namaLembaga || ''))),
            members: m.docs.map((x) => ({ id: x.id, ...x.data() })).sort((x, y) => (x.urutan || 0) - (y.urutan || 0)),
          };
        });
        if (!alive) return;
        setProfile(d.profile ? { ...DEFAULT_PROFILE, ...d.profile } : DEFAULT_PROFILE);
        const cfg = mergeTampilan(d.tampilan);
        setTpl(cfg);
        applyTheme(cfg);
        setInstitutions(d.institutions);
        setMembers(d.members);
      } catch (err) {
        console.error('Gagal memuat data:', err);
        if (alive) setProfile((cur) => cur || DEFAULT_PROFILE); // gagal memuat: tampilkan bawaan agar halaman tidak kosong
      }
    })();
    return () => { alive = false; };
  }, []);

  // Bagian Keuangan: baca 1 dokumen ringkasan saat mendekati layar (hemat kuota).
  // Rincian transaksi baru dimuat saat pengunjung menekan "Tampilkan laporan rinci".
  // Bila ringkasan belum pernah dibuat admin, jatuh kembali ke membaca seluruh transaksi.
  const keuNear = useInView(keuRef, isYa(tpl.tampilKeuangan));
  useEffect(() => {
    if (!keuNear) return undefined;
    let alive = true;
    (async () => {
      try {
        const r = await cached('ringkasan-v1', CACHE_TTL, async () => {
          const sn = await getDoc(doc(getDb(), 'settings', 'ringkasanKas'));
          return { ada: sn.exists(), data: sn.exists() ? sn.data() : null };
        }, (v) => v.ada);
        if (!alive) return;
        if (r.ada) { setRingkasan(r.data); setKasReady(true); return; }
        const rows = await cached('trx-v1', CACHE_TTL, fetchTrx);
        if (!alive) return;
        setTrx(rows);
        setKasReady(true);
      } catch (err) {
        console.error('Gagal memuat data keuangan:', err);
        if (alive) setKasError('Data keuangan gagal dimuat. Periksa koneksi Anda lalu coba lagi.');
      }
    })();
    return () => { alive = false; };
  }, [keuNear, retry]);

  const loadTrx = () => {
    setTrxLoading(true);
    setLaporanError('');
    cached('trx-v1', CACHE_TTL, fetchTrx)
      .then(setTrx)
      .catch((err) => { console.error('Gagal memuat transaksi:', err); setLaporanError('Laporan rinci gagal dimuat. Coba lagi.'); })
      .finally(() => setTrxLoading(false));
  };

  const saldo = useMemo(() => {
    const s = Object.fromEntries(UNITS.map((u) => [u, { masuk: 0, keluar: 0 }]));
    if (trx) {
      trx.forEach((t) => {
        const k = normBidang(t.kategoriUnit); // data lama: Masjid→Keagamaan, Pendidikan→Sosial
        if (!s[k]) return;
        if (t.tipe === 'masuk') s[k].masuk += Number(t.jumlah) || 0;
        else s[k].keluar += Number(t.jumlah) || 0;
      });
    } else if (ringkasan?.total) {
      Object.assign(s, gabungBidang(ringkasan.total)); // ringkasan lama (nama kategori lama) ikut digabung ke bidang sekarang
    }
    return s;
  }, [trx, ringkasan]);
  // '…' saat memuat, '—' saat gagal (jangan tampilkan Rp 0 yang menyesatkan)
  const kasText = (v) => (kasError ? '—' : kasReady ? rupiah(v) : '…');

  // lembaga utama beserta sub unitnya (sub unit tampil di dalam kartu induk)
  const tree = susunLembaga(institutions);
  const shown = filter === 'Semua' ? tree : tree.filter((x) => x.kategori === filter);
  const nav = [
    ['Profil', '#profil', 'tampilProfil'], ['Lembaga', '#lembaga', 'tampilLembaga'], ['Berita', '#berita', 'tampilBerita'],
    ['Galeri', '#galeri', 'tampilGaleri'], ['Pengurus', '#pengurus', 'tampilPengurus'], ['Keuangan', '#keuangan', 'tampilKeuangan'], ['Kontak', '#kontak'],
  ].filter(([, , flag]) => !flag || isYa(tpl[flag])).map(([l, h]) => [l, h]);
  const left = tpl.heroRata === 'kiri';
  const hasSocial = socialLinks(tpl).length > 0;

  return (
    <div>
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-content items-center justify-between px-4 py-3">
          <a href="#" className="flex items-center gap-3">
            <Logo url={profile.logoUrl} />
            <span className={`font-bold text-brand-800 transition-opacity ${profileReady ? 'opacity-100' : 'opacity-0'}`}>{profile.namaYayasan || '\u00a0'}</span>
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

      <section className={`relative isolate overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-4 text-white ${HERO_PAD[tpl.heroTinggi] || HERO_PAD.sedang} ${left ? 'text-left' : 'text-center'}`}>
        {heroSrc(tpl) && (
          <>
            {/* Foto latar: tepinya memudar ke warna utama di belakangnya */}
            <div aria-hidden className="absolute inset-0 -z-10" style={heroPhotoStyle(tpl)} />
            <div aria-hidden className="absolute inset-0 -z-10" style={{ backgroundColor: `rgb(var(--brand-900) / ${(Number(tpl.heroOverlay) || 0) / 100})` }} />
          </>
        )}
        <div className="mx-auto max-w-content"><div className={left ? 'max-w-3xl' : 'mx-auto max-w-3xl'}>
          {isYa(tpl.heroTampilLogo) && <div className={`mb-5 flex ${left ? 'justify-start' : 'justify-center'}`}><Logo url={profile.logoUrl} size={96} /></div>}
          <h1 className={`min-h-[1.2em] text-3xl font-extrabold transition-opacity sm:text-5xl ${profileReady ? 'opacity-100' : 'opacity-0'}`}>{profile.namaYayasan}</h1>
          <p className="mt-4 text-lg text-brand-100">{profile.tagline}</p>
          <div className={`mt-8 flex flex-wrap gap-3 ${left ? 'justify-start' : 'justify-center'}`}>
            {tpl.heroTombol1Teks && <a href="#lembaga" className="rounded-lg bg-white px-5 py-2.5 font-semibold text-brand-800">{tpl.heroTombol1Teks}</a>}
            {tpl.heroTombol2Teks && <a href="#keuangan" className="rounded-lg border border-white/60 px-5 py-2.5 font-semibold">{tpl.heroTombol2Teks}</a>}
          </div>
          {hasSocial && isYa(tpl.sosialDiHero) && <SocialIcons cfg={tpl} className={`mt-6 ${left ? 'justify-start' : 'justify-center'}`} />}
        </div></div>
      </section>

      {isYa(tpl.tampilProfil) && (
      <section id="profil" className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="text-2xl font-bold">Profil Yayasan</h2>
        <p className="mt-4 whitespace-pre-line leading-relaxed text-slate-600">{profile.deskripsi}</p>
      </section>
      )}

      {isYa(tpl.tampilLembaga) && (
      <section id="lembaga" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-content">
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
                  <article key={x.id} className="rounded-card border bg-slate-50 p-6 transition hover:-translate-y-1 hover:shadow-lg">
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
                    {x.anak.length > 0 && (
                      <div className="mt-4 border-t pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit di bawahnya</p>
                        <ul className="mt-2 space-y-2">
                          {x.anak.map((a) => (
                            <li key={a.id} className="flex items-start gap-2 text-sm">
                              <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.jenis === 'Usaha' ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-800'}`}>{a.jenis === 'Usaha' ? 'Usaha' : 'Unit'}</span>
                              <span className="min-w-0">
                                <b>{a.namaLembaga}</b>{a.kepalaUnit && <span className="text-slate-500"> · {a.kepalaUnit}</span>}
                                {a.deskripsi && <span className="block text-slate-600">{a.deskripsi}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
      )}

      <Konten namaYayasan={profile.namaYayasan} institutions={institutions} showBerita={isYa(tpl.tampilBerita)} showGaleri={isYa(tpl.tampilGaleri)} />

      {isYa(tpl.tampilPengurus) && (
      <section id="pengurus" className="mx-auto max-w-content px-4 py-16">
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
                      {m.fotoUrl ? <Image src={optimizeUrl(m.fotoUrl, 200)} alt={m.nama || 'Pengurus'} width={96} height={96} unoptimized className="h-24 w-24 object-cover" /> : <Users className="m-6 text-slate-400" size={48} />}
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
      )}

      {isYa(tpl.tampilKeuangan) && (
      <section id="keuangan" ref={keuRef} className="bg-white px-4 py-16">
        <div className="mx-auto max-w-content">
          <h2 className="flex items-center justify-center gap-2 text-2xl font-bold"><Wallet /> Transparansi Keuangan</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {UNITS.map((u) => {
              const Icon = ICONS[u];
              const s = saldo[u];
              return (
                <div key={u} className="rounded-card border bg-slate-50 p-6">
                  <div className="flex items-center gap-2 font-bold text-brand-800"><Icon size={20} /> Kas {u}</div>
                  <p className="mt-3 text-2xl font-extrabold">{kasText(s.masuk - s.keluar)}</p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p className="flex items-center gap-2 text-emerald-700"><ArrowDownCircle size={16} /> Masuk: {kasText(s.masuk)}</p>
                    <p className="flex items-center gap-2 text-red-600"><ArrowUpCircle size={16} /> Keluar: {kasText(s.keluar)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {kasError ? (
            <div className="mt-10 rounded-card border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
              <p>{kasError}</p>
              <button className="btn-light mt-3" onClick={() => { setKasError(''); setRetry((n) => n + 1); }}>Coba lagi</button>
            </div>
          ) : !kasReady ? (
            <p className="mt-10 text-center text-sm text-slate-500">Memuat ringkasan kas…</p>
          ) : trx ? (
            <LaporanKas trx={trx} namaYayasan={profile.namaYayasan} />
          ) : (
            <div className="mt-10 text-center">
              <button className="btn" onClick={loadTrx} disabled={trxLoading}>
                {trxLoading && <Loader2 size={14} className="animate-spin" />} Tampilkan laporan rinci
              </button>
              <p className="mt-2 text-xs text-slate-500">Grafik, rincian transaksi, bukti nota, dan ekspor Excel/PDF.</p>
              {laporanError && <p className="mt-2 text-sm text-red-600">{laporanError}</p>}
            </div>
          )}
          <p className="mt-10 text-center text-sm text-slate-500">Rekening donasi: <b>{profile.rekeningDonasi}</b></p>
        </div>
      </section>
      )}

      <footer id="kontak" className="bg-brand-900 px-4 py-12 text-brand-100">
        <div className="mx-auto grid max-w-content gap-8 md:grid-cols-2">
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
            {hasSocial && <SocialIcons cfg={tpl} className="pt-2" />}
          </div>
        </div>
        {tpl.footerTeks && <p className="mx-auto mt-8 max-w-content whitespace-pre-line text-center text-sm text-brand-100">{tpl.footerTeks}</p>}
        <p className="mt-8 text-center text-xs text-brand-100/70">© {new Date().getFullYear()} {profile.namaYayasan}</p>
      </footer>
    </div>
  );
}
