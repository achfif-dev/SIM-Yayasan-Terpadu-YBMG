// Lembaga & sub unit. Sub unit disimpan di koleksi `institutions` yang sama dengan field:
//   indukId : ID dokumen lembaga induk ('' / kosong = lembaga utama)
//   jenis   : 'Unit' | 'Usaha' (hanya untuk sub unit)
// Sub unit mewarisi `kategori` (kas) induknya. Hanya satu tingkat: sub unit tidak punya sub unit lagi.
// Yayasan bergerak di bidang keagamaan, sosial, dan kemanusiaan (bukan usaha), jadi unit USAHA hanya boleh berada
// di bawah lembaga berbidang yang tercantum di USAHA_DI (Keagamaan, mis. Masjid). Ubah daftar ini bila kebijakan berubah.
// `kategori` = bidang (lib/bidang.js); nama lama (Masjid/Pendidikan/Sosial) dinormalkan saat dibaca.
import { normBidang } from './bidang';
export const USAHA_DI = ['Keagamaan'];
export const JENIS_SUB = ['Unit', 'Usaha'];

const namaOf = (x) => String(x.namaLembaga || '');
const urut = (a, b) => (a.urutan || 0) - (b.urutan || 0) || namaOf(a).localeCompare(namaOf(b));

// ID lembaga utama (akar) dari sebuah item; item yatim (induk hilang) dianggap lembaga utama
function akarId(x, byId) {
  let cur = x;
  for (let i = 0; i < 5; i += 1) {
    const p = cur.indukId && cur.indukId !== cur.id ? byId.get(cur.indukId) : null;
    if (!p) return cur.id;
    cur = p;
  }
  return cur.id;
}

// [{...lembagaUtama, anak: [subUnit...]}] terurut menurut urutan lalu nama
export function susunLembaga(mentah = []) {
  const list = mentah.map((x) => ({ ...x, kategori: normBidang(x.kategori) }));
  const byId = new Map(list.map((x) => [x.id, x]));
  const anak = new Map();
  const utama = [];
  list.forEach((x) => {
    const a = akarId(x, byId);
    if (a === x.id) utama.push(x);
    else { if (!anak.has(a)) anak.set(a, []); anak.get(a).push(x); }
  });
  return utama.sort(urut).map((u) => ({ ...u, anak: (anak.get(u.id) || []).sort(urut) }));
}

// Daftar datar untuk tampilan admin: induk lalu anak-anaknya (anak diberi `_anak: true`)
export const urutkanLembaga = (list) => susunLembaga(list).flatMap((u) => { const { anak, ...induk } = u; return [induk, ...anak.map((a) => ({ ...a, _anak: true }))]; });

// Kategori (kas) efektif: sub unit mengikuti induknya
export function kategoriEfektif(x, list = []) {
  const p = x.indukId ? list.find((y) => y.id === x.indukId) : null;
  return normBidang(p ? p.kategori : x.kategori);
}

// Nama-nama yang tercakup saat memfilter menurut lembaga: lembaga utama → dirinya + semua sub unitnya
export function cakupanNama(nama, list = []) {
  const s = new Set([nama]);
  susunLembaga(list).filter((u) => namaOf(u) === nama).forEach((u) => u.anak.forEach((a) => s.add(namaOf(a))));
  return s;
}

// Pilihan untuk <select>: [{ nama, label, anak: bool, jenis }]
export const opsiLembaga = (list = []) => urutkanLembaga(list).filter((x) => namaOf(x)).map((x) => ({
  nama: namaOf(x), label: x._anak ? `↳ ${namaOf(x)}${x.jenis === 'Usaha' ? ' (Usaha)' : ''}` : namaOf(x), anak: !!x._anak, jenis: x.jenis || '',
}));

// Validasi form lembaga; string kosong = valid
export function validasiLembaga(f, daftar = [], editId = null) {
  const nama = String(f.namaLembaga || '').trim();
  if (!nama) return 'Nama lembaga wajib diisi';
  if (daftar.some((x) => x.id !== editId && namaOf(x).trim().toLowerCase() === nama.toLowerCase())) {
    return `Nama "${nama}" sudah dipakai lembaga/sub unit lain (nama dipakai sebagai penanda di berita, kegiatan, dan kas, jadi harus unik)`;
  }
  const kids = editId ? daftar.filter((x) => x.indukId === editId) : [];
  if (f.indukId) {
    const p = daftar.find((x) => x.id === f.indukId);
    if (!p) return 'Lembaga induk tidak ditemukan';
    if (p.id === editId) return 'Lembaga tidak bisa menjadi sub unit dari dirinya sendiri';
    if (p.indukId) return 'Sub unit tidak bisa memiliki sub unit lagi; pilih lembaga utama sebagai induk';
    if (kids.length) return 'Lembaga ini punya sub unit, jadi tidak bisa dijadikan sub unit';
    if (f.jenis === 'Usaha' && !USAHA_DI.includes(normBidang(p.kategori))) {
      return `Unit Usaha hanya boleh berada di bawah lembaga bidang ${USAHA_DI.join(' / ')} (mis. Masjid). Yayasan bergerak di bidang keagamaan, sosial, dan kemanusiaan, bukan usaha.`;
    }
  } else if (kids.some((k) => k.jenis === 'Usaha') && !USAHA_DI.includes(normBidang(f.kategori))) {
    return `Lembaga ini punya unit Usaha; bidangnya harus tetap ${USAHA_DI.join(' / ')}`;
  }
  return '';
}

// Siapkan data sebelum disimpan: sub unit mewarisi kategori induk; lembaga utama tidak punya jenis
export function siapkanLembaga(data, daftar = []) {
  const out = { ...data };
  if (out.indukId) {
    const p = daftar.find((x) => x.id === out.indukId);
    if (p) out.kategori = normBidang(p.kategori);
    if (!JENIS_SUB.includes(out.jenis)) out.jenis = 'Unit';
  } else { out.indukId = ''; out.jenis = ''; out.kategori = normBidang(out.kategori); }
  return out;
}

export const blokirHapus = (item, daftar = []) => {
  const n = daftar.filter((x) => x.indukId === item.id).length;
  return n ? `"${namaOf(item)}" masih punya ${n} sub unit. Hapus atau pindahkan sub unitnya dulu.` : '';
};

// Transaksi kas yang ditandai ke sebuah lembaga/sub unit (unitId = nama) harus sejalan dengan kas unitnya
export function validasiKas(f, daftar = []) {
  const nama = String(f.unitId || '').trim().toLowerCase();
  if (!nama) return '';
  const x = daftar.find((y) => namaOf(y).trim().toLowerCase() === nama);
  if (!x) return '';
  const kat = kategoriEfektif(x, daftar);
  return kat && f.kategoriUnit && kat !== normBidang(f.kategoriUnit)
    ? `"${namaOf(x)}" termasuk Kas ${kat}. Ubah "Bidang (Kas)" menjadi ${kat}, atau pilih lembaga lain.`
    : '';
}
