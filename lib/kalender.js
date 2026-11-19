// Ekspor kegiatan ke kalender (.ics / Google Calendar) dan teks siap bagikan ke WhatsApp.
// Murni (tanpa Firebase/DOM) kecuali fungsi unduh di bagian bawah. Zona waktu tetap Asia/Jakarta (WIB, tanpa DST).
import { antara, berikutnya, parseTgl, polaTeks, toStr, tglHijriTeks, HARI_NAMA, BULAN_NAMA, bacaPengecualian } from './rutin';

const TZ = 'Asia/Jakarta';
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const p2 = (n) => String(n).padStart(2, '0');
const ymd = (s) => String(s).replace(/-/g, '');
const hm = (j) => String(j || '').replace(':', '') + '00';
const tambahHari = (s, n) => { const d = parseTgl(s); return toStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12)); };
const esc = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const num = (v) => Number(v);

// Aturan yang TIDAK bisa ditulis sebagai RRULE standar → diurai menjadi daftar tanggal
// (kalender Hijriah, pengecualian/libur, tanggal 29–31 yang "mengikuti akhir bulan", 29 Februari).
const perluDiurai = (r) => String(r.frekuensi).startsWith('hijriah')
  || !!bacaPengecualian(r.pengecualian).rentang.length
  || r.liburRamadan === 'Ya'
  || (r.frekuensi === 'bulanan_tanggal' && num(r.tanggal) >= 29 && num(r.tanggal) < 31)
  || (r.frekuensi === 'tahunan' && num(r.bulan) === 2 && num(r.tanggal) >= 29);

// RRULE (tanpa awalan "RRULE:") untuk aturan sederhana; null bila perlu diurai
export function rrule(r) {
  if (perluDiurai(r)) return null;
  let o;
  switch (r.frekuensi) {
    case 'harian': o = 'FREQ=DAILY'; break;
    case 'mingguan': o = `FREQ=WEEKLY;BYDAY=${[...new Set((r.hari || []).map(num))].sort().map((x) => BYDAY[x]).join(',')}`; break;
    case 'dua_pekan': o = 'FREQ=WEEKLY;INTERVAL=2'; break;
    case 'bulanan_tanggal': o = `FREQ=MONTHLY;BYMONTHDAY=${num(r.tanggal) === 31 ? -1 : num(r.tanggal)}`; break;
    case 'bulanan_pekan': o = `FREQ=MONTHLY;BYDAY=${num(r.pekanKe) === 5 ? '-1' : num(r.pekanKe)}${BYDAY[num(r.hariPekan)]}`; break;
    case 'tahunan': o = `FREQ=YEARLY;BYMONTH=${num(r.bulan)};BYMONTHDAY=${num(r.tanggal)}`; break;
    default: return null;
  }
  if (r.sampai) o += `;UNTIL=${ymd(r.sampai)}T165959Z`; // akhir hari "sampai" WIB = 16:59:59 UTC
  return o;
}

// Satu "kejadian" kalender: { tgl, jamMulai, jamSelesai, judul, lokasi, deskripsi, rrule? }
const dtProps = (tgl, jMulai, jSelesai) => {
  if (!jMulai) return { semuaHari: true, mulai: ymd(tgl), akhir: ymd(tambahHari(tgl, 1)) };
  let akhirTgl = tgl;
  let akhirJam = jSelesai && jSelesai > jMulai ? jSelesai : null;
  if (!akhirJam) { // tanpa jam selesai: durasi 1 jam
    const [h, m] = jMulai.split(':').map(Number);
    if (h + 1 >= 24) { akhirTgl = tambahHari(tgl, 1); akhirJam = `${p2(h + 1 - 24)}:${p2(m)}`; } else akhirJam = `${p2(h + 1)}:${p2(m)}`;
  }
  return { semuaHari: false, mulai: `${ymd(tgl)}T${hm(jMulai)}`, akhir: `${ymd(akhirTgl)}T${hm(akhirJam)}` };
};

const deskripsiGabung = (k, namaYayasan) => [k.deskripsi, k.pola && `Pola: ${k.pola}`, namaYayasan].filter(Boolean).join('\n');

// Ubah kegiatan tunggal (tanggal) atau aturan rutin menjadi daftar kejadian kalender.
// `dari` = tanggal acuan (hari ini). Aturan rutin diurai ke tanggal untuk `bulan` ke depan bila tak bisa jadi RRULE.
export function kejadian(item, dari, { bulan = 12, maks = 60 } = {}) {
  const dasar = { judul: item.judul, lokasi: item.lokasi, jamMulai: item.jamMulai, jamSelesai: item.jamSelesai };
  if (!item.frekuensi) return item.tanggal ? [{ ...dasar, tgl: item.tanggal, deskripsi: item.deskripsi }] : [];
  const pola = polaTeks(item);
  const hijriah = String(item.frekuensi).startsWith('hijriah');
  const awal = berikutnya(item, dari);
  if (!awal) return [];
  const rr = rrule(item);
  if (rr) return [{ ...dasar, tgl: awal, deskripsi: item.deskripsi, pola, rrule: rr }];
  const d = parseTgl(awal);
  const batas = toStr(new Date(d.getFullYear(), d.getMonth() + bulan, d.getDate(), 12));
  return antara(item, awal, batas, maks).map((t) => ({
    ...dasar, tgl: t, deskripsi: item.deskripsi, pola: hijriah ? `${pola} · ${tglHijriTeks(t, item.geserHijri)}` : pola,
  }));
}

const lipat = (baris) => { // RFC 5545: maks 75 oktet per baris
  const enc = new TextEncoder(); let out = ''; let cur = ''; let len = 0;
  for (const ch of baris) {
    const b = enc.encode(ch).length;
    if (len + b > 74) { out += `${cur}\r\n `; cur = ''; len = 1; }
    cur += ch; len += b;
  }
  return out + cur;
};

export function buatICS(daftar, { namaYayasan = 'Yayasan', dari = toStr(new Date()), kalender = 'Kegiatan' } = {}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${esc(namaYayasan)}//SIM Yayasan//ID`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(`${namaYayasan} – ${kalender}`)}`, `X-WR-TIMEZONE:${TZ}`,
    'BEGIN:VTIMEZONE', `TZID:${TZ}`, 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0700', 'TZOFFSETTO:+0700', 'TZNAME:WIB', 'END:STANDARD', 'END:VTIMEZONE'];
  let n = 0;
  daftar.forEach((item, i) => {
    kejadian(item, dari).forEach((k, j) => {
      const t = dtProps(k.tgl, k.jamMulai, k.jamSelesai);
      L.push('BEGIN:VEVENT', `UID:${item.id || `k${i}`}-${j}-${ymd(k.tgl)}@sim-yayasan`, `DTSTAMP:${stamp}`);
      if (t.semuaHari) L.push(`DTSTART;VALUE=DATE:${t.mulai}`, `DTEND;VALUE=DATE:${t.akhir}`);
      else L.push(`DTSTART;TZID=${TZ}:${t.mulai}`, `DTEND;TZID=${TZ}:${t.akhir}`);
      if (k.rrule) L.push(`RRULE:${k.rrule}`);
      L.push(`SUMMARY:${esc(k.judul)}`);
      if (k.lokasi) L.push(`LOCATION:${esc(k.lokasi)}`);
      const des = deskripsiGabung(k, namaYayasan);
      if (des) L.push(`DESCRIPTION:${esc(des)}`);
      L.push('END:VEVENT');
      n += 1;
    });
  });
  L.push('END:VCALENDAR');
  return n ? `${L.map(lipat).join('\r\n')}\r\n` : '';
}

// Tautan "Tambah ke Google Kalender" untuk kejadian pertama (aturan sederhana ikut berulang)
export function googleKalenderUrl(item, { namaYayasan = 'Yayasan', dari = toStr(new Date()) } = {}) {
  const k = kejadian(item, dari, { bulan: 12, maks: 1 })[0];
  if (!k) return '';
  const t = dtProps(k.tgl, k.jamMulai, k.jamSelesai);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: k.judul, dates: `${t.mulai}/${t.akhir}`, details: deskripsiGabung(k, namaYayasan) });
  if (!t.semuaHari) q.set('ctz', TZ);
  if (k.lokasi) q.set('location', k.lokasi);
  if (k.rrule) q.set('recur', `RRULE:${k.rrule}`);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

// ---- WhatsApp ----
const tglPendek = (s) => { const d = parseTgl(s); return `${HARI_NAMA[d.getDay()]}, ${d.getDate()} ${BULAN_NAMA[d.getMonth()]} ${d.getFullYear()}`; };
const jamTeks = (e) => [e.jamMulai, e.jamSelesai].filter(Boolean).join('–');

export function teksWA(item, { namaYayasan = 'Yayasan', dari = toStr(new Date()) } = {}) {
  const tgl = item.frekuensi ? berikutnya(item, dari) : item.tanggal;
  const baris = [`*${item.judul}*`];
  if (item.frekuensi) baris.push(`🔁 ${polaTeks(item)}`);
  if (tgl) baris.push(`📅 ${item.frekuensi ? 'Berikutnya: ' : ''}${tglPendek(tgl)}`);
  if (jamTeks(item)) baris.push(`🕒 ${jamTeks(item)} WIB`);
  if (item.lokasi) baris.push(`📍 ${item.lokasi}`);
  if (item.deskripsi) baris.push('', item.deskripsi);
  baris.push('', `— ${namaYayasan}`);
  return baris.join('\n');
}

// Jadwal gabungan untuk `hari` ke depan (kegiatan sekali jalan + kemunculan kegiatan rutin)
export function jadwalPekan(tunggal, rutin, { dari = toStr(new Date()), hari = 7 } = {}) {
  const sampai = tambahHari(dari, hari - 1);
  const out = [];
  tunggal.filter((e) => e.tanggal >= dari && e.tanggal <= sampai).forEach((e) => out.push({ tgl: e.tanggal, ...e }));
  rutin.forEach((r) => antara(r, dari, sampai).forEach((t) => out.push({ ...r, tgl: t })));
  return out.sort((a, b) => a.tgl.localeCompare(b.tgl) || String(a.jamMulai || '99').localeCompare(String(b.jamMulai || '99')));
}

export function teksWAPekan(daftar, { namaYayasan = 'Yayasan', dari = toStr(new Date()), hari = 7 } = {}) {
  const sampai = tambahHari(dari, hari - 1);
  if (!daftar.length) return `*Jadwal Kegiatan ${namaYayasan}*\n${tglPendek(dari)} – ${tglPendek(sampai)}\n\nBelum ada kegiatan terjadwal.`;
  const baris = [`*Jadwal Kegiatan ${namaYayasan}*`, `${tglPendek(dari)} – ${tglPendek(sampai)}`];
  let tglSaatIni = '';
  daftar.forEach((k) => {
    if (k.tgl !== tglSaatIni) { tglSaatIni = k.tgl; baris.push('', `📅 *${tglPendek(k.tgl)}*`); }
    baris.push(`• ${jamTeks(k) ? `${jamTeks(k)} – ` : ''}${k.judul}${k.lokasi ? ` (${k.lokasi})` : ''}`);
  });
  return baris.join('\n');
}

export const waUrl = (teks) => `https://wa.me/?text=${encodeURIComponent(teks)}`;

// ---- Unduh di browser ----
export function unduhICS(isi, namaBerkas = 'kegiatan.ics') {
  const url = URL.createObjectURL(new Blob([isi], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = namaBerkas;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
