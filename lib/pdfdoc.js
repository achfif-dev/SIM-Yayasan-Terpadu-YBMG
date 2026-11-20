// Pembuat PDF (jsPDF, dimuat saat dibutuhkan saja): susunan panitia, laporan pertanggungjawaban, ucapan terima kasih.
// Font bawaan PDF hanya mendukung huruf Latin; karakter lain (mis. Arab) dibuang agar tidak menjadi karakter rusak.
import { kelompokSeksi, namaJabatan, rentangTanggal, rupiah, terbilang, tglHariIni, tglPanjang, tujuanUcapan } from './kegiatan';

const HIJAU = [4, 120, 87];
const MUDA = [209, 250, 229];
const ABU = [243, 244, 246];
// eslint-disable-next-line no-control-regex
const bersih = (s) => String(s ?? '').replace(/[^\u0009\u000A\u0020-\u007E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g, '');

async function kelasPdf() {
  const m = await import('jspdf');
  return m.jsPDF || m.default;
}

// Logo → PNG (jsPDF tidak membaca WebP). Gagal/lambat → tanpa logo.
async function muatLogo(url) {
  if (!url) return null;
  try {
    let u = url;
    if (/res\.cloudinary\.com/.test(u) && u.includes('/upload/') && !/\/upload\/[^/]*(f_|w_)/.test(u)) u = u.replace('/upload/', '/upload/f_png,w_240/');
    const img = await Promise.race([
      new Promise((res, rej) => { const i = new window.Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = u; }),
      new Promise((_, rej) => { setTimeout(() => rej(new Error('lambat')), 6000); }),
    ]);
    const sk = Math.min(1, 300 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * sk));
    c.height = Math.max(1, Math.round(img.naturalHeight * sk));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/png'), w: c.width, h: c.height };
  } catch (e) { return null; }
}

class Kertas {
  constructor(doc, margin = 15) {
    this.d = doc;
    this.m = margin;
    this.W = doc.internal.pageSize.getWidth();
    this.H = doc.internal.pageSize.getHeight();
    this.y = margin;
  }

  get lebar() { return this.W - 2 * this.m; }

  ruang(h) {
    if (this.y + h > this.H - this.m - 6) { this.d.addPage(); this.y = this.m; return true; }
    return false;
  }

  font(size, style = 'normal') { this.d.setFont('helvetica', style); this.d.setFontSize(size); }

  teks(str, { size = 10, style = 'normal', align = 'left', x, lebar, gap = 1.5, warna = [0, 0, 0] } = {}) {
    this.font(size, style);
    this.d.setTextColor(...warna);
    const lh = size * 0.3528 * 1.3;
    const baris = this.d.splitTextToSize(bersih(str), lebar ?? this.lebar);
    baris.forEach((b) => {
      this.ruang(lh);
      const px = align === 'center' ? this.W / 2 : align === 'right' ? this.m + this.lebar : (x ?? this.m);
      this.d.text(b, px, this.y + size * 0.3528 * 0.85, { align });
      this.y += lh;
    });
    this.y += gap;
    this.d.setTextColor(0, 0, 0);
  }

  judul(str) { this.ruang(14); this.y += 2; this.teks(str, { size: 11, style: 'bold', warna: HIJAU, gap: 1.5 }); }

  garis(tebal = 0.3) {
    this.d.setDrawColor(0, 0, 0);
    this.d.setLineWidth(tebal);
    this.d.line(this.m, this.y, this.W - this.m, this.y);
    this.y += 1.5;
  }

  async kop(profil, logo) {
    const x0 = this.m;
    const tinggi = 18;
    let tx = x0;
    let lw = this.lebar;
    if (logo) {
      const sk = Math.min(tinggi / logo.h, 24 / logo.w);
      this.d.addImage(logo.data, 'PNG', x0, this.y, logo.w * sk, logo.h * sk);
      tx = x0 + 26;
      lw = this.lebar - 26;
    }
    const yAwal = this.y;
    this.y = yAwal + 1;
    const opsi = { align: logo ? 'left' : 'center', x: logo ? tx : undefined, lebar: lw };
    this.teks(profil.namaYayasan || 'Yayasan', { size: 14, style: 'bold', warna: HIJAU, gap: 0.3, ...opsi });
    if (profil.statusHukum) this.teks(profil.statusHukum, { size: 8.5, style: 'italic', gap: 0.3, ...opsi });
    const kontak = [profil.alamat, [profil.telepon, profil.email].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
    if (kontak) this.teks(kontak, { size: 8.5, gap: 0.3, ...opsi });
    this.y = Math.max(this.y, yAwal + tinggi) + 1.5;
    this.garis(0.8);
    this.garis(0.2);
    this.y += 3;
  }

  // kolom: [{judul, w, align}]; baris: array sel | {cells, tebal, fill} | {span:'teks'}
  tabel(kolom, baris, { size = 8.5 } = {}) {
    const tot = kolom.reduce((a, c) => a + c.w, 0);
    const lk = kolom.map((c) => (c.w / tot) * this.lebar);
    const lh = size * 0.3528 * 1.25;
    const pad = 1.4;
    const d = this.d;
    const gambarBaris = (cells, { tebal = false, fill = null, header = false } = {}) => {
      this.font(size, tebal || header ? 'bold' : 'normal');
      const pecah = cells.map((c, i) => d.splitTextToSize(bersih(c), lk[i] - 2 * pad));
      const h = Math.max(...pecah.map((p) => p.length)) * lh + 2 * pad;
      return { pecah, h, tebal, fill, header };
    };
    const cetak = (r) => {
      let x = this.m;
      d.setLineWidth(0.2);
      d.setDrawColor(120, 120, 120);
      r.pecah.forEach((p, i) => {
        if (r.fill) { d.setFillColor(...r.fill); d.rect(x, this.y, lk[i], r.h, 'FD'); } else d.rect(x, this.y, lk[i], r.h);
        this.font(size, r.tebal || r.header ? 'bold' : 'normal');
        const al = kolom[i].align || 'left';
        p.forEach((b, j) => {
          const ty = this.y + pad + j * lh + size * 0.3528 * 0.85;
          if (al === 'right') d.text(b, x + lk[i] - pad, ty, { align: 'right' });
          else if (al === 'center') d.text(b, x + lk[i] / 2, ty, { align: 'center' });
          else d.text(b, x + pad, ty);
        });
        x += lk[i];
      });
      this.y += r.h;
    };
    const kepala = gambarBaris(kolom.map((c) => c.judul), { header: true, fill: MUDA });
    this.ruang(kepala.h + 8);
    cetak(kepala);
    baris.forEach((b) => {
      let r;
      if (b && b.span !== undefined) {
        this.font(size, 'bold');
        const p = d.splitTextToSize(bersih(b.span), this.lebar - 2 * pad);
        r = { span: true, pecah: [p], h: p.length * lh + 2 * pad };
        if (this.y + r.h > this.H - this.m - 6) { d.addPage(); this.y = this.m; cetak(kepala); }
        d.setLineWidth(0.2); d.setDrawColor(120, 120, 120); d.setFillColor(...ABU);
        d.rect(this.m, this.y, this.lebar, r.h, 'FD');
        this.font(size, 'bold');
        p.forEach((t, j) => d.text(t, this.m + pad, this.y + pad + j * lh + size * 0.3528 * 0.85));
        this.y += r.h;
        return;
      }
      const cells = Array.isArray(b) ? b : b.cells;
      r = gambarBaris(cells, Array.isArray(b) ? {} : { tebal: b.tebal, fill: b.fill });
      if (this.y + r.h > this.H - this.m - 6) { d.addPage(); this.y = this.m; cetak(kepala); }
      cetak(r);
    });
    this.y += 3;
  }

  nomorHalaman(kiri = '') {
    const n = this.d.getNumberOfPages();
    for (let i = 1; i <= n; i += 1) {
      this.d.setPage(i);
      this.font(8);
      this.d.setTextColor(110, 110, 110);
      if (kiri) this.d.text(bersih(kiri), this.m, this.H - 8);
      this.d.text(`Halaman ${i} / ${n}`, this.W - this.m, this.H - 8, { align: 'right' });
    }
    this.d.setTextColor(0, 0, 0);
  }
}

const hasil = (doc, nama) => ({ blob: doc.output('blob'), nama });

// ---------- Susunan panitia ----------
export async function pdfStruktur({ profil, k }) {
  const JsPDF = await kelasPdf();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const p = new Kertas(doc);
  await p.kop(profil, await muatLogo(profil.logoUrl));
  p.teks('SUSUNAN KEPANITIAAN', { size: 13, style: 'bold', align: 'center', gap: 0.5 });
  p.teks(String(k.nama || '').toUpperCase(), { size: 12, style: 'bold', align: 'center', gap: 0.5 });
  p.teks([rentangTanggal(k.tanggal, k.tanggalSelesai), k.lokasi].filter(Boolean).join(' · '), { size: 9.5, align: 'center', gap: 4 });
  const baris = [];
  let no = 0;
  kelompokSeksi(k.struktur, true).forEach((g) => {
    baris.push({ span: g.seksi });
    g.anggota.forEach((r) => { no += 1; baris.push([String(no), r.jabatan, r.nama]); });
  });
  if (!baris.length) p.teks('Susunan panitia belum diisi.', { size: 10 });
  else p.tabel([{ judul: 'No', w: 10, align: 'center' }, { judul: 'Jabatan', w: 70 }, { judul: 'Nama', w: 100 }], baris, { size: 9.5 });
  const ketua = namaJabatan(k.struktur, /^ketua(\s+panitia)?$/i);
  p.ruang(45);
  p.y += 4;
  p.teks(tglPanjang(tglHariIni()), { align: 'right', gap: 0.5 });
  p.teks('Ketua Panitia', { align: 'right', gap: 18 });
  p.teks(ketua ? `( ${ketua} )` : '( .............................. )', { align: 'right', style: 'bold' });
  p.nomorHalaman(profil.namaYayasan || '');
  return hasil(doc, `susunan-panitia-${(k.nama || 'kegiatan').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`);
}

// ---------- Laporan pertanggungjawaban ----------
export async function pdfLPJ({ profil, k, h, link = '' }) {
  const JsPDF = await kelasPdf();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const p = new Kertas(doc);
  await p.kop(profil, await muatLogo(profil.logoUrl));
  p.teks('LAPORAN PERTANGGUNGJAWABAN KEUANGAN', { size: 13, style: 'bold', align: 'center', gap: 0.5 });
  p.teks(String(k.nama || '').toUpperCase(), { size: 12, style: 'bold', align: 'center', gap: 0.5 });
  p.teks([rentangTanggal(k.tanggal, k.tanggalSelesai), k.lokasi].filter(Boolean).join(' · '), { size: 9.5, align: 'center', gap: 3 });

  p.judul('A. Ringkasan Keuangan');
  p.tabel([{ judul: 'Uraian', w: 110 }, { judul: 'Jumlah', w: 70, align: 'right' }], [
    ['Total pemasukan', rupiah(h.masuk)],
    ['Total pengeluaran', rupiah(h.keluar)],
    { cells: ['Sisa dana', rupiah(h.saldo)], tebal: true, fill: ABU },
  ], { size: 9.5 });

  if (h.rabTotal > 0) {
    p.judul('B. Anggaran (RAB) dan Realisasi');
    const baris = h.perKategori.map((x) => [x.kategori, rupiah(x.anggaran), rupiah(x.total), rupiah(x.selisih)]);
    baris.push({ cells: ['Jumlah', rupiah(h.rabTotal), rupiah(h.keluar), rupiah(h.rabTotal - h.keluar)], tebal: true, fill: ABU });
    p.tabel([{ judul: 'Kategori', w: 70 }, { judul: 'Anggaran', w: 36, align: 'right' }, { judul: 'Realisasi', w: 36, align: 'right' }, { judul: 'Selisih', w: 36, align: 'right' }], baris);
  }

  const hurufPemasukan = h.rabTotal > 0 ? 'C' : 'B';
  p.judul(`${hurufPemasukan}. Rincian Pemasukan`);
  if (!h.masukRows.length) p.teks('Belum ada pemasukan.', { size: 9.5 });
  else {
    const baris = h.masukRows.map((x, i) => [String(i + 1), tglPanjang(x.tanggal), `${x.sumber || '-'}${x.keterangan ? ` (${x.keterangan})` : ''}`, x.jenis || '-', rupiah(x.jumlah)]);
    baris.push({ cells: ['', '', 'Total pemasukan', '', rupiah(h.masuk)], tebal: true, fill: ABU });
    p.tabel([{ judul: 'No', w: 9, align: 'center' }, { judul: 'Tanggal', w: 30 }, { judul: 'Sumber / Penyumbang', w: 74 }, { judul: 'Jenis', w: 27 }, { judul: 'Jumlah', w: 34, align: 'right' }], baris);
  }

  p.judul(`${h.rabTotal > 0 ? 'D' : 'C'}. Rincian Pengeluaran`);
  const kel = h.perKategori.filter((x) => x.rows.length);
  if (!kel.length) p.teks('Belum ada pengeluaran.', { size: 9.5 });
  else {
    const baris = [];
    let no = 0;
    kel.forEach((g) => {
      baris.push({ span: `${g.kategori} — ${rupiah(g.total)}` });
      g.rows.forEach((x) => {
        no += 1;
        const qty = Number(x.qty) > 0 && Number(x.harga) > 0 ? `${x.qty} ${x.satuan || ''}`.trim() : '';
        baris.push([String(no), tglPanjang(x.tanggal), `${x.uraian || '-'}${x.seksi ? ` [${x.seksi}]` : ''}${x.bukti ? ' *' : ''}`, qty, Number(x.harga) > 0 ? rupiah(x.harga) : '', rupiah(x.jumlah)]);
      });
    });
    baris.push({ cells: ['', '', 'Total pengeluaran', '', '', rupiah(h.keluar)], tebal: true, fill: ABU });
    p.tabel([{ judul: 'No', w: 8, align: 'center' }, { judul: 'Tanggal', w: 27 }, { judul: 'Uraian', w: 62 }, { judul: 'Jumlah Barang', w: 24 }, { judul: 'Harga Satuan', w: 26, align: 'right' }, { judul: 'Jumlah', w: 28, align: 'right' }], baris, { size: 8 });
    if (h.keluarRows.some((x) => x.bukti)) p.teks('* = ada bukti nota/kwitansi yang disimpan oleh bendahara.', { size: 8, gap: 2 });
  }

  const struktur = kelompokSeksi(k.struktur, true);
  let huruf = h.rabTotal > 0 ? 'E' : 'D';
  if (struktur.length) {
    p.judul(`${huruf}. Susunan Panitia`);
    struktur.forEach((g) => p.teks(`${g.seksi}: ${g.anggota.map((r) => `${r.nama} (${r.jabatan})`).join(', ')}`, { size: 9, gap: 1 }));
    huruf = String.fromCharCode(huruf.charCodeAt(0) + 1);
  }

  p.judul(`${huruf}. Penutup`);
  const sisa = h.saldo !== 0 && k.sisaDisposisi ? ` Sisa dana sebesar ${rupiah(h.saldo)}: ${String(k.sisaDisposisi).toLowerCase()}.` : '';
  p.teks(`${k.penutup || 'Demikian laporan pertanggungjawaban keuangan ini kami susun dengan sebenarnya. Semoga Allah SWT membalas kebaikan para penyumbang dan seluruh pihak yang telah membantu terselenggaranya kegiatan ini. Jazakumullahu khairan katsiran.'}${sisa}`, { size: 9.5 });
  if (link) p.teks(`Rincian dapat dilihat di: ${link}`, { size: 8.5, warna: HIJAU });

  const ketua = namaJabatan(k.struktur, /^ketua(\s+panitia)?$/i);
  const bendahara = namaJabatan(k.struktur, /bendahara/i);
  p.ruang(70);
  p.y += 3;
  p.teks(tglPanjang(tglHariIni()), { align: 'right', gap: 3 });
  const y0 = p.y;
  const tanda = (cx, label, nama) => {
    p.font(10);
    doc.text(label, cx, y0 + 3.5, { align: 'center' });
    p.font(10, 'bold');
    doc.text(nama ? `( ${bersih(nama)} )` : '( .......................... )', cx, y0 + 25, { align: 'center' });
  };
  tanda(p.m + p.lebar * 0.25, 'Bendahara,', bendahara);
  tanda(p.m + p.lebar * 0.75, 'Ketua Panitia,', ketua);
  p.y = y0 + 32;
  p.teks('Mengetahui,', { align: 'center', gap: 0 });
  p.teks(k.mengetahuiJabatan || 'Ketua Yayasan', { align: 'center', gap: 16 });
  p.teks(k.mengetahuiNama ? `( ${k.mengetahuiNama} )` : '( .......................... )', { align: 'center', style: 'bold' });
  p.nomorHalaman(profil.namaYayasan || '');
  return hasil(doc, `lpj-${(k.nama || 'kegiatan').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`);
}

// ---------- Ucapan terima kasih (A5 mendatar, enak dibaca di layar HP) ----------
export async function pdfTerimaKasih({ profil, d: don, ttd = '' }) {
  const JsPDF = await kelasPdf();
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
  const p = new Kertas(doc, 16);
  doc.setDrawColor(...HIJAU);
  doc.setLineWidth(1.2);
  doc.rect(6, 6, p.W - 12, p.H - 12);
  doc.setLineWidth(0.3);
  doc.rect(8.5, 8.5, p.W - 17, p.H - 17);
  const logo = await muatLogo(profil.logoUrl);
  p.y = 14;
  if (logo) {
    const sk = Math.min(14 / logo.h, 22 / logo.w);
    doc.addImage(logo.data, 'PNG', (p.W - logo.w * sk) / 2, p.y, logo.w * sk, logo.h * sk);
    p.y += logo.h * sk + 2;
  }
  p.teks(profil.namaYayasan || 'Yayasan', { size: 13, style: 'bold', align: 'center', warna: HIJAU, gap: 0.3 });
  if (profil.statusHukum) p.teks(profil.statusHukum, { size: 8, style: 'italic', align: 'center', gap: 0.3 });
  const kontak = [profil.alamat, profil.telepon].filter(Boolean).join(' · ');
  if (kontak) p.teks(kontak, { size: 8, align: 'center', gap: 2 });
  p.teks('UCAPAN TERIMA KASIH', { size: 18, style: 'bold', align: 'center', warna: HIJAU, gap: 1 });
  p.teks('Jazakumullahu khairan katsiran', { size: 10, style: 'italic', align: 'center', gap: 2 });
  p.teks('Disampaikan kepada Bapak/Ibu', { size: 9.5, align: 'center', gap: 0.5 });
  p.teks(don.nama, { size: 17, style: 'bold', align: 'center', gap: 2 });
  const jenis = String(don.jenis || 'infaq').toLowerCase();
  const untuk = tujuanUcapan(don.tujuan, profil.namaYayasan);
  p.teks(`atas ${jenis} sebesar ${rupiah(don.jumlah)} (${terbilang(don.jumlah)})${untuk}, yang kami terima pada ${tglPanjang(don.tanggal)}. Semoga Allah SWT menerima amal kebaikan Bapak/Ibu, membalasnya dengan pahala yang berlipat ganda, melapangkan rezeki, dan memberkahi keluarga. Aamiin.`, { size: 10, align: 'center', gap: 2, x: p.m + 8, lebar: p.lebar - 16 });
  if (don.pesan) p.teks(don.pesan, { size: 9.5, style: 'italic', align: 'center', gap: 2, x: p.m + 8, lebar: p.lebar - 16 });
  p.y = Math.max(p.y + 2, p.H - 46);
  p.teks('Hormat kami,', { align: 'right', gap: 9, size: 9.5 });
  p.teks(ttd || profil.namaYayasan || '', { align: 'right', style: 'bold', size: 10, gap: 0 });
  return hasil(doc, `ucapan-terima-kasih-${String(don.nama || 'donatur').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`);
}
