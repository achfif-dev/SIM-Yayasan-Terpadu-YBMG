'use client';

import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Copy, Link2, Loader2, MessageCircle, Save } from 'lucide-react';
import { getDb } from '../lib/firebase';
import { bukaWA, salinTeks } from '../lib/bagikan';
import { DISPOSISI_SISA, rupiah, teksLPJ } from '../lib/kegiatan';
import { linkLaporan } from '../lib/profil';
import { pdfLPJ } from '../lib/pdfdoc';
import PdfAksi from './PdfAksi';

const AMBIL = (k) => ({ penutup: k.penutup || '', sisaDisposisi: k.sisaDisposisi || '', mengetahuiNama: k.mengetahuiNama || '', mengetahuiJabatan: k.mengetahuiJabatan || 'Ketua Yayasan', publik: !!k.publik });

export default function KegiatanLaporan({ k, h, profil, onSaved }) {
  const [p, setP] = useState(AMBIL(k));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { setP(AMBIL(k)); }, [k.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch) => setP((x) => ({ ...x, ...patch }));

  const simpan = async () => {
    setBusy(true);
    setMsg('');
    try { await updateDoc(doc(getDb(), 'panitia', k.id), p); setMsg('Tersimpan ✓'); await onSaved?.(); } catch (e) { setMsg(`Gagal: ${e.message}`); }
    setBusy(false);
  };

  const kk = { ...k, ...p };
  const link = p.publik && typeof window !== 'undefined' ? linkLaporan(k.id) : '';
  const teks = teksLPJ({ k: kk, h, yayasan: profil.namaYayasan, statusHukum: profil.statusHukum, link });
  const tersimpan = !!k.publik === p.publik;
  const versi = `${h.masuk}|${h.keluar}|${h.rabTotal}|${h.masukRows.length}|${h.keluarRows.length}|${p.penutup}|${p.sisaDisposisi}|${p.mengetahuiNama}|${p.mengetahuiJabatan}|${JSON.stringify(k.struktur || []).length}|${link}`;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">Pemasukan</p><p className="font-bold text-emerald-700">{rupiah(h.masuk)}</p></div>
        <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">Pengeluaran</p><p className="font-bold text-red-600">{rupiah(h.keluar)}</p></div>
        <div className="rounded-xl bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">Sisa dana</p><p className={`font-bold ${h.saldo < 0 ? 'text-red-600' : 'text-brand-800'}`}>{rupiah(h.saldo)}</p></div>
      </div>

      {h.saldo < 0 && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Pengeluaran melebihi pemasukan. Periksa catatan kas, atau catat dana talangan sebagai pemasukan agar laporan seimbang.</p>}

      {h.perKategori.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-1">Kategori</th>{h.rabTotal > 0 && <th className="py-1 text-right">Anggaran</th>}<th className="py-1 text-right">Realisasi</th>{h.rabTotal > 0 && <th className="py-1 text-right">Selisih</th>}</tr></thead>
            <tbody>
              {h.perKategori.map((x) => (
                <tr key={x.kategori} className="border-t">
                  <td className="py-1.5">{x.kategori}</td>
                  {h.rabTotal > 0 && <td className="py-1.5 text-right tabular-nums">{rupiah(x.anggaran)}</td>}
                  <td className="py-1.5 text-right tabular-nums">{rupiah(x.total)}</td>
                  {h.rabTotal > 0 && <td className={`py-1.5 text-right tabular-nums ${x.selisih < 0 ? 'text-red-600' : ''}`}>{rupiah(x.selisih)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-bold">Pengaturan laporan</h3>
        <div><label className="mb-1 block text-sm font-medium">Sisa dana akan…</label>
          <input className="inp" list="disp-sisa" placeholder="mis. Disetorkan ke kas yayasan" value={p.sisaDisposisi} onChange={(e) => set({ sisaDisposisi: e.target.value })} />
          <datalist id="disp-sisa">{DISPOSISI_SISA.map((x) => <option key={x} value={x} />)}</datalist></div>
        <div><label className="mb-1 block text-sm font-medium">Kalimat penutup (kosongkan = kalimat bawaan)</label>
          <textarea className="inp" rows={3} value={p.penutup} onChange={(e) => set({ penutup: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm font-medium">Mengetahui — nama</label><input className="inp" value={p.mengetahuiNama} onChange={(e) => set({ mengetahuiNama: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm font-medium">Mengetahui — jabatan</label><input className="inp" value={p.mengetahuiJabatan} onChange={(e) => set({ mengetahuiJabatan: e.target.value })} /></div>
        </div>
        <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={p.publik} onChange={(e) => set({ publik: e.target.checked })} />
          <span><b>Izinkan laporan dibuka lewat tautan.</b> Siapa pun yang memegang tautan dapat melihat susunan panitia, nama sumber dana, rincian belanja, dan foto nota. Tulis “Hamba Allah” pada kolom sumber bila penyumbang ingin dirahasiakan.</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn" onClick={simpan} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan pengaturan</button>
          <span className="text-sm text-slate-500">{msg}{!tersimpan && !msg ? 'Pengaturan tautan belum disimpan — tautan baru aktif setelah disimpan.' : ''}</span>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-bold">Bagikan laporan</h3>
        {p.publik && tersimpan && link
          ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 p-3 text-sm">
              <Link2 size={14} /> <span className="min-w-0 flex-1 break-all">{link}</span>
              <button type="button" className="btn-light" onClick={async () => setMsg((await salinTeks(link)) ? 'Tautan disalin ✓' : 'Gagal menyalin')}><Copy size={14} /> Salin tautan</button>
            </div>
          )
          : <p className="text-sm text-slate-500">Centang “Izinkan laporan dibuka lewat tautan” lalu simpan bila ingin menyertakan tautan rincian di pesan WhatsApp.</p>}
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">{teks}</pre>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => bukaWA(teks)}><MessageCircle size={14} /> Kirim lewat WhatsApp</button>
          <button type="button" className="btn-light" onClick={async () => setMsg((await salinTeks(teks)) ? 'Teks disalin ✓' : 'Gagal menyalin')}><Copy size={14} /> Salin teks</button>
        </div>
        <PdfAksi buat={() => pdfLPJ({ profil, k: kk, h, link })} teks={teks} versi={versi} label="Buat PDF laporan pertanggungjawaban" />
      </div>
    </div>
  );
}
