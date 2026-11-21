// Fungsi murni untuk rekap & ekspor laporan kas (tanpa dependensi tambahan).
import { BIDANG, DANA, normBidang, normDana } from './bidang';
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
  // Rincian per jenis dana (tidak terikat / zakat / wakaf / infaq terikat): saldo awal + masuk - keluar pada periode
  const perDana = DANA.map((d) => {
    const awal = startKey ? trx.filter((t) => inUnit(t) && normDana(t.dana) === d && monthKey(t) && monthKey(t) < startKey).reduce((s, t) => s + signed(t), 0) : 0;
    const list = trx.filter((t) => inUnit(t) && normDana(t.dana) === d && inPeriod(t));
    const m = list.filter(isMasuk).reduce((s, t) => s + num(t.jumlah), 0);
    const k = list.filter((t) => !isMasuk(t)).reduce((s, t) => s + num(t.jumlah), 0);
    return { label: d, saldoAwal: awal, masuk: m, keluar: k, saldoAkhir: awal + m - k };
  }).filter((x) => x.saldoAwal || x.masuk || x.keluar || x.label === 'Tidak terikat');
  return { rows, saldoAwal, masuk, keluar, saldoAkhir: saldoAwal + masuk - keluar, perUnit, perLembaga, perDana, buckets };
}

// Rincian per lembaga & sub unit (menurut penanda `unitId` = nama lembaga pada transaksi).
// Hanya lembaga yang punya transaksi (atau sub unitnya punya) pada periode itu; sisanya digabung di "Tanpa rincian".
// Mengembalikan [] bila daftar lembaga tidak diberikan. selisih = masuk - keluar (untuk unit Usaha = laba/rugi kas).
export function rincianLembaga(list, lembaga = []) {
  if (!lembaga.length) return [];
  const byNama = new Map();
  lembaga.forEach((x) => { const k = String(x.namaLembaga || '').trim().toLowerCase(); if (k && !byNama.has(k)) byNama.set(k, x.id); });
  const ids = new Set(lembaga.map((x) => x.id));
  const sum = new Map();
  const lain = { masuk: 0, keluar: 0, n: 0 };
  list.forEach((t) => {
    // lembagaId (stabil walau nama diganti) didahulukan; transaksi lama jatuh ke pencocokan nama
    const id = (t.lembagaId && ids.has(t.lembagaId)) ? t.lembagaId : byNama.get(String(t.unitId || '').trim().toLowerCase());
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

const danaExcel = (report) => (report.perDana?.some((d) => d.label !== 'Tidak terikat') ? `<br><table border="1">
<tr><td colspan="5"><b>Rincian per jenis dana (dana terikat tidak boleh dicampur dengan dana umum)</b></td></tr>
<tr>${['Jenis dana', 'Saldo awal (Rp)', 'Masuk (Rp)', 'Keluar (Rp)', 'Saldo akhir (Rp)'].map((h) => `<th style="background:#d1fae5">${h}</th>`).join('')}</tr>
${report.perDana.map((d) => `<tr><td>${esc(d.label)}</td><td>${d.saldoAwal}</td><td>${d.masuk}</td><td>${d.keluar}</td><td>${d.saldoAkhir}</td></tr>`).join('')}
</table>` : '');

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
</table>${rincianExcel(report)}${danaExcel(report)}</body></html>`;
  download(`laporan-kas-${slug(unit)}-${slug(per)}.xls`, 'application/vnd.ms-excel;charset=utf-8', html);
}

// PDF: buka halaman cetak lalu pengguna memilih "Simpan sebagai PDF"
