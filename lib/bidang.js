// Bidang yayasan menurut AD/ART: keagamaan, sosial, dan kemanusiaan.
// Bidang dipakai sebagai kategori lembaga (institutions.kategori) sekaligus unit kas (transactions.kategoriUnit).
export const BIDANG = ['Keagamaan', 'Sosial', 'Kemanusiaan'];

// Nama kategori LAMA (sebelum mengikuti AD/ART) → bidang baru. Data lama tidak perlu dimigrasi: setiap pembacaan
// dinormalkan lewat normBidang(), dan nilai barunya tertulis sendiri saat data diedit/disimpan ulang.
//   Masjid     → Keagamaan
//   Pendidikan → Sosial   (pendidikan lazimnya dikelompokkan ke bidang sosial; ubah di sini bila AD/ART menetapkan lain,
//                          mis. 'Keagamaan' bila lembaganya pesantren/madrasah)
//   Sosial     → Sosial
export const PETA_LAMA = { Masjid: 'Keagamaan', Pendidikan: 'Sosial', Sosial: 'Sosial' };

export const normBidang = (k) => (BIDANG.includes(k) ? k : (PETA_LAMA[k] || k));

// Gabungkan objek { namaBidang: { masuk, keluar } } yang masih memakai nama lama (mis. dokumen ringkasanKas lama)
// menjadi per bidang baru; nama yang tidak dikenal diabaikan.
export function gabungBidang(obj = {}) {
  const out = Object.fromEntries(BIDANG.map((b) => [b, { masuk: 0, keluar: 0 }]));
  Object.entries(obj || {}).forEach(([k, v]) => {
    const b = normBidang(k);
    if (!out[b]) return;
    out[b].masuk += Number(v?.masuk) || 0;
    out[b].keluar += Number(v?.keluar) || 0;
  });
  return out;
}
