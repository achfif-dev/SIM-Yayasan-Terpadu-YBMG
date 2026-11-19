'use client';

import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Paperclip } from 'lucide-react';
import { BULAN, UNITS, availableYears, buildReport, exportExcel, exportPdf, fmtTanggal, periodLabel, rupiah } from '../lib/laporan';
import { BuktiModal } from './Bukti';

function TimeChart({ buckets }) {
  const max = Math.max(1, ...buckets.flatMap((b) => [b.masuk, b.keluar]));
  const h = (v) => `${Math.max((v / max) * 100, v > 0 ? 2 : 0)}%`;
  if (!buckets.length) return <p className="py-10 text-center text-sm text-slate-500">Belum ada data untuk grafik.</p>;
  return (
    <div className="flex items-end gap-1 sm:gap-2">
      {buckets.map((b) => (
        <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center">
          <div className="flex h-36 w-full items-end justify-center gap-0.5"
            title={`${b.label}\nMasuk: ${rupiah(b.masuk)}\nKeluar: ${rupiah(b.keluar)}`}>
            <div className="w-1/2 max-w-[14px] rounded-t bg-emerald-500" style={{ height: h(b.masuk) }} />
            <div className="w-1/2 max-w-[14px] rounded-t bg-red-500" style={{ height: h(b.keluar) }} />
          </div>
          <span className="mt-1 text-[10px] text-slate-500">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function UnitChart({ data }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.masuk, d.keluar]));
  const w = (v) => `${Math.max((v / max) * 100, v > 0 ? 2 : 0)}%`;
  return (
    <div className="space-y-4">
      {data.map((d) => (
        <div key={d.label}>
          <p className="mb-1 text-sm font-semibold">{d.label}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2"><div className="h-3 rounded bg-emerald-500" style={{ width: w(d.masuk) }} /><span className="text-xs text-slate-600">{rupiah(d.masuk)}</span></div>
            <div className="flex items-center gap-2"><div className="h-3 rounded bg-red-500" style={{ width: w(d.keluar) }} /><span className="text-xs text-slate-600">{rupiah(d.keluar)}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

const Legend = () => (
  <div className="mb-3 flex gap-4 text-xs text-slate-600">
    <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded bg-emerald-500" /> Pemasukan</span>
    <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded bg-red-500" /> Pengeluaran</span>
  </div>
);

// `lembaga` (opsional) = daftar lembaga/sub unit; bila diberikan, tampil tabel rincian per lembaga & sub unit (termasuk Usaha)
export default function LaporanKas({ trx, namaYayasan = 'Yayasan', lembaga = [] }) {
  const years = useMemo(() => availableYears(trx), [trx]);
  const [unit, setUnit] = useState('Semua');
  const [tahunSel, setTahunSel] = useState(null); // null = tahun terbaru yang ada datanya
  const [bulan, setBulan] = useState('Semua');
  const [limit, setLimit] = useState(15);
  const [bukti, setBukti] = useState(null);

  const tahun = tahunSel ?? years[0] ?? 'Semua';
  const report = useMemo(() => buildReport(trx, { unit, tahun, bulan, lembaga }), [trx, unit, tahun, bulan, lembaga]);
  const meta = { namaYayasan, unit, tahun, bulan };
  const rows = report.rows;

  return (
    <div className="mt-12 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">Laporan Kas</h3>
          <p className="text-sm text-slate-500">{unit === 'Semua' ? 'Seluruh bidang' : `Kas ${unit}`} · {periodLabel(tahun, bulan)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Bidang" className="inp !w-auto" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {['Semua', ...UNITS].map((u) => <option key={u} value={u}>{u === 'Semua' ? 'Semua bidang' : u}</option>)}
          </select>
          <select aria-label="Tahun" className="inp !w-auto" value={String(tahun)}
            onChange={(e) => { const v = e.target.value; setTahunSel(v === 'Semua' ? 'Semua' : Number(v)); if (v === 'Semua') setBulan('Semua'); setLimit(15); }}>
            <option value="Semua">Semua tahun</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select aria-label="Bulan" className="inp !w-auto" value={String(bulan)} disabled={tahun === 'Semua'}
            onChange={(e) => { setBulan(e.target.value === 'Semua' ? 'Semua' : Number(e.target.value)); setLimit(15); }}>
            <option value="Semua">Semua bulan</option>
            {BULAN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Saldo awal', report.saldoAwal, ''],
          ['Pemasukan', report.masuk, 'text-emerald-700'],
          ['Pengeluaran', report.keluar, 'text-red-600'],
          ['Saldo akhir', report.saldoAkhir, 'text-brand-800'],
        ].map(([l, v, c]) => (
          <div key={l} className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-slate-500">{l}</p>
            <p className={`mt-1 text-lg font-extrabold ${c}`}>{rupiah(v)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-card border bg-slate-50 p-5">
          <h4 className="mb-3 font-bold">{tahun === 'Semua' ? 'Per tahun' : `Per bulan, ${tahun}`}</h4>
          <Legend />
          <TimeChart buckets={report.buckets} />
        </div>
        <div className="rounded-card border bg-slate-50 p-5">
          <h4 className="mb-3 font-bold">Per bidang · {periodLabel(tahun, bulan)}</h4>
          <Legend />
          <UnitChart data={report.perUnit} />
        </div>
      </div>

      {report.perLembaga.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-bold">Per lembaga &amp; sub unit · {periodLabel(tahun, bulan)}</h4>
          <div className="overflow-x-auto rounded-card border">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-brand-50 text-xs uppercase text-slate-600">
                <tr><th className="p-3">Lembaga / Sub unit</th><th className="p-3 text-right">Masuk</th><th className="p-3 text-right">Keluar</th><th className="p-3 text-right">Selisih</th></tr>
              </thead>
              <tbody className="divide-y bg-white">
                {report.perLembaga.map((r) => (
                  <tr key={`${r.anak ? 'a' : 'u'}-${r.label}`} className={r.anak ? '' : 'bg-slate-50 font-semibold'}>
                    <td className={`p-3 ${r.anak ? 'pl-8' : ''}`}>
                      {r.anak && <span className="mr-1 text-slate-400">↳</span>}{r.label}
                      {r.jenis === 'Usaha' && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Usaha</span>}
                    </td>
                    <td className="p-3 text-right text-emerald-700">{rupiah(r.masuk)}</td>
                    <td className="p-3 text-right text-red-600">{rupiah(r.keluar)}</td>
                    <td className={`p-3 text-right font-semibold ${r.selisih < 0 ? 'text-red-600' : 'text-slate-800'}`}>{rupiah(r.selisih)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Dihitung dari kolom “Nama Lembaga” pada transaksi. Selisih = masuk − keluar; transaksi tanpa penanda lembaga digabung di “Tanpa rincian lembaga”.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-bold">Rincian transaksi ({rows.length})</h4>
        <div className="flex gap-2">
          <button className="btn-light" onClick={() => exportExcel(report, meta)}><FileSpreadsheet size={14} /> Excel</button>
          <button className="btn-light" onClick={() => exportPdf(report, meta)}><FileText size={14} /> PDF</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-card border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-brand-50 text-xs uppercase text-slate-600">
            <tr><th className="p-3">Tanggal</th><th className="p-3">Bidang</th><th className="p-3">Keterangan</th>
              <th className="p-3 text-right">Masuk</th><th className="p-3 text-right">Keluar</th><th className="p-3 text-right">Saldo</th><th className="p-3">Bukti</th></tr>
          </thead>
          <tbody className="divide-y bg-white">
            {tahun !== 'Semua' && (
              <tr className="bg-slate-50 text-slate-600"><td className="p-3" colSpan={5}>Saldo awal periode</td><td className="p-3 text-right">{rupiah(report.saldoAwal)}</td><td /></tr>
            )}
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-500">Belum ada transaksi pada periode ini.</td></tr>}
            {rows.slice(0, limit).map((t) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap p-3">{fmtTanggal(t.tanggal)}</td>
                <td className="p-3">{t.kategoriUnit}</td>
                <td className="p-3">{[t.unitId, t.keterangan].filter(Boolean).join(' — ') || '-'}</td>
                <td className="whitespace-nowrap p-3 text-right text-emerald-700">{t.tipe === 'masuk' ? rupiah(t.jumlah) : ''}</td>
                <td className="whitespace-nowrap p-3 text-right text-red-600">{t.tipe === 'masuk' ? '' : rupiah(t.jumlah)}</td>
                <td className="whitespace-nowrap p-3 text-right">{rupiah(t.saldo)}</td>
                <td className="p-3">
                  {t.bukti
                    ? <button className="flex items-center gap-1 text-brand-700 hover:underline" onClick={() => setBukti(t.bukti)}><Paperclip size={14} /> Lihat</button>
                    : <span className="text-slate-300">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="text-center">
          <button className="btn-light" onClick={() => setLimit((l) => l + 30)}>Tampilkan lebih banyak ({rows.length - limit} lagi)</button>
        </div>
      )}
      {bukti && <BuktiModal value={bukti} onClose={() => setBukti(null)} />}
    </div>
  );
}
