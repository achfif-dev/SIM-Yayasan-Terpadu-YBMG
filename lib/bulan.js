// Susunan kalender bulanan (grid 7 kolom, pekan mulai Minggu) yang menggabungkan
// kegiatan sekali jalan (koleksi events) dan kemunculan kegiatan rutin (koleksi routine_events). Murni; mudah diuji.
import { antara, parseTgl, toStr } from './rutin';

const jam12 = (y, m, d) => new Date(y, m, d, 12); // jam 12 menghindari geser tanggal karena zona waktu

// Tanggal-tanggal grid untuk bulan `bulan` (1–12): array pekan, tiap pekan 7 string 'YYYY-MM-DD'
export function gridBulan(tahun, bulan) {
  const awalBulan = jam12(tahun, bulan - 1, 1);
  const geser = awalBulan.getDay(); // 0 = Minggu
  const hariBulan = new Date(tahun, bulan, 0).getDate();
  const jumlahPekan = Math.ceil((geser + hariBulan) / 7);
  const minggu = [];
  for (let w = 0; w < jumlahPekan; w += 1) {
    minggu.push(Array.from({ length: 7 }, (_, i) => toStr(jam12(tahun, bulan - 1, 1 - geser + w * 7 + i))));
  }
  return minggu;
}

const urut = (a, b) => (a.libur === b.libur ? 0 : a.libur ? 1 : -1)
  || String(a.jamMulai || '').localeCompare(String(b.jamMulai || ''))
  || String(a.judul).localeCompare(String(b.judul));

// Peta tanggal → daftar kegiatan pada grid bulan tsb.
// item: { kunci, tipe:'sekali'|'rutin', judul, jamMulai, jamSelesai, lokasi, lembaga, deskripsi, libur, sumber }
export function isiBulan(tahun, bulan, tunggal = [], rutin = []) {
  const minggu = gridBulan(tahun, bulan);
  const awal = minggu[0][0];
  const akhir = minggu[minggu.length - 1][6];
  const peta = {};
  const taruh = (tgl, item) => { (peta[tgl] = peta[tgl] || []).push(item); };

  tunggal.forEach((e) => {
    if (e.tanggal >= awal && e.tanggal <= akhir) taruh(e.tanggal, { kunci: `e-${e.id}`, tipe: 'sekali', libur: false, sumber: e, ...salin(e) });
  });
  rutin.forEach((r) => {
    const nyata = new Set(antara(r, awal, akhir));
    const normal = antara({ ...r, pengecualian: '', liburRamadan: 'Tidak' }, awal, akhir);
    normal.forEach((t) => taruh(t, { kunci: `r-${r.id}-${t}`, tipe: 'rutin', libur: !nyata.has(t), sumber: r, ...salin(r) }));
  });
  Object.values(peta).forEach((l) => l.sort(urut));
  return { minggu, awal, akhir, peta };
}
const salin = (x) => ({ judul: x.judul, jamMulai: x.jamMulai, jamSelesai: x.jamSelesai, lokasi: x.lokasi, lembaga: x.lembaga, deskripsi: x.deskripsi });

export const geserBulan = ({ y, m }, n) => { const d = new Date(y, m - 1 + n, 1, 12); return { y: d.getFullYear(), m: d.getMonth() + 1 }; };
export const bulanDari = (tglStr) => { const d = parseTgl(tglStr); return d ? { y: d.getFullYear(), m: d.getMonth() + 1 } : null; };
export const bandingBulan = (a, b) => (a.y - b.y) * 12 + (a.m - b.m);
