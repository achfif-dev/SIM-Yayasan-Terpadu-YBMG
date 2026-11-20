'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { Loader2, MessageCircle, Paperclip } from 'lucide-react';
import { getDb } from '../lib/firebase';
import { bukaWA } from '../lib/bagikan';
import { hitung, kelompokSeksi, num, rentangTanggal, rupiah, teksLPJ, tglPanjang } from '../lib/kegiatan';
import { muatProfil } from '../lib/profil';
import { pdfLPJ } from '../lib/pdfdoc';
import { BuktiModal } from './Bukti';
import PdfAksi from './PdfAksi';

const Kartu = ({ t, v, w = '' }) => (<div className="min-w-0 rounded-xl bg-white p-3 text-center shadow-sm"><p className="text-xs text-slate-500">{t}</p><p className={`break-words text-sm font-bold sm:text-base ${w}`}>{v}</p></div>);

export default function LaporanPublik() {
  const [k, setK] = useState(null);
  const [kas, setKas] = useState([]);
  const [profil, setProfil] = useState({ namaYayasan: 'Yayasan' });
  const [status, setStatus] = useState('memuat'); // memuat | ok | tidak
  const [lihat, setLihat] = useState(null);

  useEffect(() => {
    let hidup = true;
    (async () => {
      const id = new URLSearchParams(window.location.search).get('id') || '';
      try {
        const [pr, s] = await Promise.all([muatProfil(), id ? getDoc(doc(getDb(), 'panitia', id)) : null]);
        if (!hidup) return;
        setProfil(pr);
        if (!s || !s.exists()) { setStatus('tidak'); return; }
        const ks = await getDocs(collection(getDb(), 'panitia', id, 'kas'));
        if (!hidup) return;
        setK({ id, ...s.data() });
        setKas(ks.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStatus('ok');
      } catch (e) { if (hidup) setStatus('tidak'); }
    })();
    return () => { hidup = false; };
  }, []);

  const h = useMemo(() => hitung(kas, k?.rab), [kas, k]);

  if (status === 'memuat') return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-brand-700" /></div>;
  if (status === 'tidak') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div><h1 className="text-lg font-bold">Laporan tidak tersedia</h1><p className="mt-1 text-sm text-slate-500">Tautan salah, atau laporan ini belum dibagikan oleh pengurus.</p></div>
      </div>
    );
  }

  const link = window.location.href;
  const teks = teksLPJ({ k, h, yayasan: profil.namaYayasan, statusHukum: profil.statusHukum, link });
  const struktur = kelompokSeksi(k.struktur, true);
  const kel = h.perKategori.filter((x) => x.rows.length);
  const Nota = ({ x }) => (x.bukti ? <button type="button" onClick={() => setLihat(x.bukti)} className="ml-1 inline-flex items-center text-brand-700" aria-label="Lihat nota"><Paperclip size={12} /></button> : null);

  return (
    <div className="min-h-screen pb-10">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {profil.logoUrl && <img src={profil.logoUrl} alt="" className="h-10 w-10 object-contain" />}
          <div className="min-w-0"><p className="truncate font-bold text-brand-800">{profil.namaYayasan}</p>{profil.statusHukum && <p className="truncate text-xs text-slate-500">{profil.statusHukum}</p>}{profil.alamat && <p className="truncate text-xs text-slate-500">{profil.alamat}</p>}</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Laporan pertanggungjawaban keuangan</p>
          <h1 className="text-2xl font-extrabold">{k.nama}</h1>
          <p className="text-sm text-slate-500">{[rentangTanggal(k.tanggal, k.tanggalSelesai), k.lokasi].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Kartu t="Pemasukan" v={rupiah(h.masuk)} w="text-emerald-700" />
          <Kartu t="Pengeluaran" v={rupiah(h.keluar)} w="text-red-600" />
          <Kartu t="Sisa dana" v={rupiah(h.saldo)} w="text-brand-800" />
        </div>
        {h.saldo !== 0 && k.sisaDisposisi && <p className="text-sm text-slate-600">Sisa dana: {k.sisaDisposisi}.</p>}

        {h.rabTotal > 0 && (
          <section className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-bold">Anggaran dan realisasi</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500"><th className="py-1">Kategori</th><th className="py-1 text-right">Anggaran</th><th className="py-1 text-right">Realisasi</th><th className="py-1 text-right">Selisih</th></tr></thead>
              <tbody>{h.perKategori.map((x) => (<tr key={x.kategori} className="border-t"><td className="py-1.5">{x.kategori}</td><td className="py-1.5 text-right tabular-nums">{rupiah(x.anggaran)}</td><td className="py-1.5 text-right tabular-nums">{rupiah(x.total)}</td><td className={`py-1.5 text-right tabular-nums ${x.selisih < 0 ? 'text-red-600' : ''}`}>{rupiah(x.selisih)}</td></tr>))}</tbody>
            </table>
          </section>
        )}

        <section className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-bold">Pemasukan</h2>
          {!h.masukRows.length ? <p className="text-sm text-slate-500">Belum ada pemasukan.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500"><th className="py-1">Tanggal</th><th className="py-1">Sumber</th><th className="py-1 text-right">Jumlah</th></tr></thead>
              <tbody>
                {h.masukRows.map((x) => (<tr key={x.id} className="border-t align-top"><td className="py-1.5 pr-2 whitespace-nowrap">{tglPanjang(x.tanggal)}</td><td className="py-1.5 pr-2">{x.sumber} <span className="text-xs text-slate-500">· {x.jenis}</span></td><td className="py-1.5 text-right tabular-nums">{rupiah(x.jumlah)}</td></tr>))}
                <tr className="border-t font-bold"><td className="py-1.5" colSpan={2}>Total</td><td className="py-1.5 text-right tabular-nums">{rupiah(h.masuk)}</td></tr>
              </tbody>
            </table>
          )}
        </section>

        <section className="space-y-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-bold">Pengeluaran</h2>
          {!kel.length && <p className="text-sm text-slate-500">Belum ada pengeluaran.</p>}
          {kel.map((g) => (
            <div key={g.kategori}>
              <p className="mb-1 flex justify-between text-sm font-semibold text-brand-800"><span>{g.kategori}</span><span>{rupiah(g.total)}</span></p>
              <table className="w-full text-sm">
                <tbody>
                  {g.rows.map((x) => (
                    <tr key={x.id} className="border-t align-top">
                      <td className="py-1.5 pr-2 whitespace-nowrap text-slate-500">{tglPanjang(x.tanggal)}</td>
                      <td className="py-1.5 pr-2">{x.uraian}<Nota x={x} />{num(x.harga) > 0 && <span className="block text-xs text-slate-500">{x.qty} {x.satuan} × {rupiah(x.harga)}</span>}</td>
                      <td className="py-1.5 text-right tabular-nums">{rupiah(x.jumlah)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {kel.length > 0 && <p className="border-t pt-2 text-right font-bold">Total pengeluaran {rupiah(h.keluar)}</p>}
        </section>

        {struktur.length > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-bold">Susunan panitia</h2>
            <div className="space-y-2 text-sm">
              {struktur.map((g) => (<div key={g.seksi}><p className="font-semibold text-brand-800">{g.seksi}</p><ul className="text-slate-700">{g.anggota.map((r) => <li key={r.id}>{r.jabatan}: {r.nama}</li>)}</ul></div>))}
            </div>
          </section>
        )}

        {k.penutup && <p className="text-sm text-slate-600">{k.penutup}</p>}

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <PdfAksi buat={() => pdfLPJ({ profil, k, h, link })} teks={teks} versi={k.id} label="Unduh / bagikan PDF" />
          <button type="button" className="btn-light" onClick={() => bukaWA(teks)}><MessageCircle size={14} /> Bagikan ringkasan ke WhatsApp</button>
        </section>
      </main>
      {lihat && <BuktiModal value={lihat} onClose={() => setLihat(null)} />}
    </div>
  );
}
