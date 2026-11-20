// Fungsi murni untuk rekap & ekspor laporan kas (tanpa dependensi tambahan).
import { BIDANG, normBidang } from './bidang';
import { susunLembaga } from './lembaga';
export const UNITS = BIDANG; // keagamaan, sosial, kemanusiaan (lihat lib/bidang.js)
export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

const num = (v) => Number(v) || 0;
const pad = (n) => String(n).padStart(2, '0');
const isMasuk = (t) => t.tipe === 'masuk';
const signed = (t) => (isMasuk(t) ? 1 : -1) * num(t.jumlah);
const monthKey = (t) => (/^\d{4}-\d{2}/.test(String(t.tanggal || '')) ? String(t.tanggal).slice(0, 7) : '');

export const fmtTanggal = (s) => {
  const p = String(s || '').split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : (s || '-');
};

export const availableYears = (trx) =>
  Array.from(new Set(trx.map((t) => Number(monthKey(t).slice(0, 4))).filter(Boolean))).sort((a, b) => b - a);

export const periodLabel = (tahun, bulan) => {
  if (tahun === 'Semua') return 'Semua periode';
  return bulan === 'Semua' ? `Tahun ${tahun}` : `${BULAN[bulan - 1]} ${tahun}`;
};

// unit: 'Semua' | nama unit; tahun: 'Semua' | angka; bulan: 'Semua' | 1..12
export function buildReport(trxMentah, { unit, tahun, bulan, lembaga = [] }) {
  // data lama memakai nama kategori lama (Masjid/Pendidikan/Sosial): normalkan ke bidang sekarang
  const trx = trxMentah.map((t) => ({ ...t, kategoriUnit: normBidang(t.kategoriUnit) }));
  const inUnit = (t) => unit === 'Semua' || t.kategoriUnit === unit;
  const inPeriod = (t) => {
    if (tahun === 'Semua') return true;
    const k = monthKey(t);
    if (!k) return false;
    return bulan === 'Semua' ? k.startsWith(`${tahun}-`) : k === `${tahun}-${pad(bulan)}`;
  };

  const startKey = tahun === 'Semua' ? null : `${tahun}-${bulan === 'Semua' ? '01' : pad(bulan)}`;
  const saldoAwal = startKey
    ? trx.filter((t) => inUnit(t) && monthKey(t) && monthKey(t) < startKey).reduce((s, t) => s + signed(t), 0)
    : 0;

  const sorted = trx
    .filter((t) => inUnit(t) && inPeriod(t))
    .sort((a, b) =>
      String(a.tanggal || '9999').localeCompare(String(b.tanggal || '9999')) ||
      (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

  let run = saldoAwal;
  const rows = sorted.map((t) => { run += signed(t); return { ...t, saldo: run }; });
  const masuk = rows.filter(isMasuk).reduce((s, t) => s + num(t.jumlah), 0);
  const keluar = rows.filter((t) => !isMasuk(t)).reduce((s, t) => s + num(t.jumlah), 0);

  const perUnit = UNITS.map((u) => {
    const list = trx.filter((t) => t.kategoriUnit === u && inPeriod(t));
    return {
      label: u,
      masuk: list.filter(isMasuk).reduce((s, t) => s + num(t.jumlah), 0),
      keluar: list.filter((t) => !isMasuk(t)).reduce((s, t) => s + num(t.jumlah), 0),
    };
  });

  // Grafik waktu: per bulan untuk tahun terpilih, atau per tahun jika "Semua"
  const scoped = trx.filter(inUnit);
  let buckets;
  if (tahun === 'Semua') {
    const ys = availableYears(scoped).sort((a, b) => a - b);
    buckets = ys.map((y) => bucket(String(y), scoped.filter((t) => monthKey(t).startsWith(`${y}-`))));
  } else {
    buckets = BULAN_SINGKAT.map((l, i) => bucket(l, scoped.filter((t) => monthKey(t) === `${tahun}-${pad(i + 1)}`)));
  }

  const perLembaga = rincianLembaga(trx.filter((t) => inUnit(t) && inPeriod(t)), lembaga);
  return { rows, saldoAwal, masuk, keluar, saldoAkhir: saldoAwal + masuk - keluar, perUnit, perLembaga, buckets };
}

// Rincian per lembaga & sub unit (menurut penanda `unitId` = nama lembaga pada transaksi).
// Hanya lembaga yang punya transaksi (atau sub unitnya punya) pada periode itu; sisanya digabung di "Tanpa rincian".
// Mengembalikan [] bila daftar lembaga tidak diberikan. selisih = masuk - keluar (untuk unit Usaha = laba/rugi kas).
export function rincianLembaga(list, lembaga = []) {
  if (!lembaga.length) return [];
  const byNama = new Map();
  lembaga.forEach((x) => { const k = String(x.namaLembaga || '').trim().toLowerCase(); if (k && !byNama.has(k)) byNama.set(k, x.id); });
  const sum = new Map();
  const lain = { masuk: 0, keluar: 0, n: 0 };
  list.forEach((t) => {
    const id = byNama.get(String(t.unitId || '').trim().toLowerCase());
    if (id && !sum.has(id)) sum.set(id, { masuk: 0, keluar: 0, n: 0 });
    const tgt = id ? sum.get(id) : lain;
    tgt[isMasuk(t) ? 'masuk' : 'keluar'] += num(t.jumlah); tgt.n += 1;
  });
  const out = [];
  susunLembaga(lembaga).forEach((u) => {
    const kids = u.anak.filter((a) => sum.has(a.id));
    if (!sum.has(u.id) && !kids.length) return;
    const s = sum.get(u.id) || { masuk: 0, keluar: 0, n: 0 };
    out.push({ label: u.namaLembaga, anak: false, jenis: '', masuk: s.masuk, keluar: s.keluar, selisih: s.masuk - s.keluar });
    kids.forEach((a) => { const k = sum.get(a.id); out.push({ label: a.namaLembaga, anak: true, jenis: a.jenis || 'Unit', masuk: k.masuk, keluar: k.keluar, selisih: k.masuk - k.keluar }); });
  });
  if (lain.n) out.push({ label: 'Tanpa rincian lembaga', anak: false, jenis: '', masuk: lain.masuk, keluar: lain.keluar, selisih: lain.masuk - lain.keluar });
  return out;
}

function bucket(label, list) {
  return {
    label,
    masuk: list.filter(isMasuk).reduce((s, t) => s + num(t.jumlah), 0),
    keluar: list.filter((t) => !isMasuk(t)).reduce((s, t) => s + num(t.jumlah), 0),
  };
}

// ---------- Ekspor ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function download(name, mime, content) {
  const blob = new Blob(['\ufeff' + content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const ketOf = (t) => [t.unitId, t.keterangan].filter(Boolean).join(' — ');

const labelRincian = (r) => `${r.anak ? '   ↳ ' : ''}${r.label}${r.jenis === 'Usaha' ? ' (Usaha)' : ''}`;
const rincianExcel = (report) => (report.perLembaga?.length ? `<br><table border="1">
<tr><td colspan="4"><b>Rincian per lembaga &amp; sub unit</b></td></tr>
<tr>${['Lembaga / Sub unit', 'Masuk (Rp)', 'Keluar (Rp)', 'Selisih (Rp)'].map((h) => `<th style="background:#d1fae5">${h}</th>`).join('')}</tr>
${report.perLembaga.map((r) => `<tr><td>${esc(labelRincian(r))}</td><td>${r.masuk}</td><td>${r.keluar}</td><td>${r.selisih}</td></tr>`).join('')}
</table>` : '');
const rincianPdf = (report) => (report.perLembaga?.length ? `<h3 style="margin:16px 0 4px;font-size:12px">Rincian per lembaga &amp; sub unit</h3>
<table><thead><tr><th>Lembaga / Sub unit</th><th>Masuk</th><th>Keluar</th><th>Selisih</th></tr></thead><tbody>
${report.perLembaga.map((r) => `<tr><td>${esc(labelRincian(r))}</td><td class="r">${rupiah(r.masuk)}</td><td class="r">${rupiah(r.keluar)}</td><td class="r">${rupiah(r.selisih)}</td></tr>`).join('')}
</tbody></table>` : '');

export function exportExcel(report, { namaYayasan, statusHukum = '', unit, tahun, bulan }) {
  const per = periodLabel(tahun, bulan);
  const title = `Laporan Kas ${unit === 'Semua' ? 'Seluruh Bidang' : unit}`;
  const head = ['Tanggal', 'Bidang', 'Keterangan', 'Masuk (Rp)', 'Keluar (Rp)', 'Saldo (Rp)', 'Bukti'];
  const body = report.rows.map((t) => `<tr>
    <td>${esc(fmtTanggal(t.tanggal))}</td><td>${esc(t.kategoriUnit)}</td><td>${esc(ketOf(t))}</td>
    <td>${isMasuk(t) ? num(t.jumlah) : ''}</td><td>${isMasuk(t) ? '' : num(t.jumlah)}</td><td>${t.saldo}</td><td>${t.bukti ? 'Ada' : '-'}</td></tr>`).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"></head><body><table border="1">
<tr><td colspan="7"><b>${esc(namaYayasan)}</b></td></tr>
${statusHukum ? `<tr><td colspan="7">${esc(statusHukum)}</td></tr>\n` : ''}<tr><td colspan="7"><b>${esc(title)}</b></td></tr>
<tr><td colspan="7">Periode: ${esc(per)}</td></tr>
<tr><td colspan="7"></td></tr>
<tr><td colspan="3">Saldo awal</td><td></td><td></td><td>${report.saldoAwal}</td><td></td></tr>
<tr>${head.map((h) => `<th style="background:#d1fae5">${h}</th>`).join('')}</tr>
${body}
<tr><td colspan="3"><b>Total</b></td><td><b>${report.masuk}</b></td><td><b>${report.keluar}</b></td><td><b>${report.saldoAkhir}</b></td><td></td></tr>
</table>${rincianExcel(report)}</body></html>`;
  download(`laporan-kas-${slug(unit)}-${slug(per)}.xls`, 'application/vnd.ms-excel;charset=utf-8', html);
}

// PDF: buka halaman cetak lalu pengguna memilih "Simpan sebagai PDF"
export function exportPdf(report, { namaYayasan, statusHukum = '', unit, tahun, bulan }) {
  const per = periodLabel(tahun, bulan);
  const title = `Laporan Kas ${unit === 'Semua' ? 'Seluruh Bidang' : unit}`;
  const body = report.rows.map((t) => `<tr>
    <td>${esc(fmtTanggal(t.tanggal))}</td><td>${esc(t.kategoriUnit)}</td><td>${esc(ketOf(t))}</td>
    <td class="r">${isMasuk(t) ? rupiah(t.jumlah) : ''}</td><td class="r">${isMasuk(t) ? '' : rupiah(t.jumlah)}</td><td class="r">${rupiah(t.saldo)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} - ${esc(per)}</title>
<style>
@page { size: A4; margin: 14mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; }
h1 { font-size: 16px; margin: 0; } .hukum { font-size: 10px; color: #444; font-style: italic; margin-top: 1px; } h2 { font-size: 13px; margin: 2px 0 0; font-weight: normal; }
.sum { display: flex; gap: 12px; margin: 14px 0; }
.sum div { flex: 1; border: 1px solid #999; padding: 6px 8px; } .sum b { display: block; font-size: 13px; margin-top: 2px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #d1fae5; } .r { text-align: right; white-space: nowrap; }
tfoot td { font-weight: bold; background: #f3f4f6; } tr { page-break-inside: avoid; }
.foot { margin-top: 14px; font-size: 10px; color: #555; }
</style></head><body>
<h1>${esc(namaYayasan)}</h1>${statusHukum ? `<div class="hukum">${esc(statusHukum)}</div>` : ''}<h2>${esc(title)} · ${esc(per)}</h2>
<div class="sum">
<div>Saldo awal<b>${rupiah(report.saldoAwal)}</b></div><div>Total masuk<b>${rupiah(report.masuk)}</b></div>
<div>Total keluar<b>${rupiah(report.keluar)}</b></div><div>Saldo akhir<b>${rupiah(report.saldoAkhir)}</b></div></div>
<table><thead><tr><th>Tanggal</th><th>Bidang</th><th>Keterangan</th><th>Masuk</th><th>Keluar</th><th>Saldo</th></tr></thead>
<tbody>${body || '<tr><td colspan="6">Tidak ada transaksi pada periode ini.</td></tr>'}</tbody>
<tfoot><tr><td colspan="3">Total</td><td class="r">${rupiah(report.masuk)}</td><td class="r">${rupiah(report.keluar)}</td><td class="r">${rupiah(report.saldoAkhir)}</td></tr></tfoot></table>
${rincianPdf(report)}
<p class="foot">Dicetak pada ${new Date().toLocaleString('id-ID')}</p>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Popup diblokir browser. Izinkan popup untuk situs ini, lalu coba lagi.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
