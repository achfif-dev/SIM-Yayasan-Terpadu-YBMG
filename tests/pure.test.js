import { describe, it, expect } from 'vitest';
import { DANA, danaDariJenis, gabungBidang, normBidang, normDana } from '../lib/bidang';
import { normHp, terbilang, tglPanjang } from '../lib/kegiatan';
import { buildReport, rincianLembaga } from '../lib/laporan';
import { idLembaga } from '../lib/lembaga';
import { hidupkan, serial } from '../lib/cadangan';
import { hitungRingkasan } from '../lib/ringkasan';

describe('bidang & dana', () => {
  it('memetakan nama kategori lama ke bidang sekarang', () => {
    expect(normBidang('Masjid')).toBe('Keagamaan');
    expect(normBidang('Pendidikan')).toBe('Sosial');
    expect(gabungBidang({ Masjid: { masuk: 100, keluar: 10 }, Foo: { masuk: 9, keluar: 9 } }).Keagamaan).toEqual({ masuk: 100, keluar: 10 });
  });
  it('zakat dan wakaf tidak jatuh ke dana tidak terikat', () => {
    expect(danaDariJenis('Zakat')).toBe('Zakat');
    expect(danaDariJenis('Wakaf')).toBe('Wakaf');
    expect(danaDariJenis('Infaq & Shodaqoh')).toBe('Tidak terikat');
    expect(normDana(undefined)).toBe('Tidak terikat');
    expect(DANA).toHaveLength(4);
  });
});

describe('kegiatan', () => {
  it('terbilang', () => {
    expect(terbilang(1000)).toBe('Seribu rupiah');
    expect(terbilang(1001000)).toBe('Satu juta seribu rupiah');
    expect(terbilang(2500000)).toBe('Dua juta lima ratus ribu rupiah');
  });
  it('nomor WhatsApp & tanggal', () => {
    expect(normHp('0812-3456-789')).toBe('628123456789');
    expect(tglPanjang('2026-11-20')).toBe('20 November 2026');
    expect(tglPanjang('2026-13-45')).toBe('2026-13-45'); // bulan tak valid: dikembalikan apa adanya
  });
});

describe('laporan kas', () => {
  const lembaga = [{ id: 'L1', namaLembaga: 'Masjid Al-Falah (baru)', kategori: 'Keagamaan' }];
  const trx = [
    { tanggal: '2026-01-10', tipe: 'masuk', kategoriUnit: 'Keagamaan', jumlah: 1000, dana: 'Zakat', unitId: 'Masjid Al-Falah (lama)', lembagaId: 'L1' },
    { tanggal: '2026-01-11', tipe: 'masuk', kategoriUnit: 'Keagamaan', jumlah: 500 },
    { tanggal: '2026-01-12', tipe: 'keluar', kategoriUnit: 'Keagamaan', jumlah: 200, dana: 'Zakat' },
  ];
  it('memisahkan saldo per jenis dana', () => {
    const r = buildReport(trx, { unit: 'Semua', tahun: 2026, bulan: 'Semua', lembaga });
    const z = r.perDana.find((d) => d.label === 'Zakat');
    const u = r.perDana.find((d) => d.label === 'Tidak terikat');
    expect(z.saldoAkhir).toBe(800);
    expect(u.saldoAkhir).toBe(500);
    expect(r.saldoAkhir).toBe(1300);
  });
  it('riwayat tetap tersambung ke lembaga walau namanya diganti (lembagaId)', () => {
    const r = rincianLembaga(trx.slice(0, 1), lembaga);
    expect(r[0].label).toBe('Masjid Al-Falah (baru)');
    expect(r[0].masuk).toBe(1000);
  });
  it('idLembaga mencari menurut nama tanpa peduli huruf besar/kecil', () => {
    expect(idLembaga(' masjid al-falah (baru) ', lembaga)).toBe('L1');
    expect(idLembaga('tidak ada', lembaga)).toBe('');
  });
});

describe('ringkasan & cadangan', () => {
  it('ringkasan menjumlah per bidang dan per bulan', () => {
    const r = hitungRingkasan([{ tanggal: '2026-01-10', tipe: 'masuk', kategoriUnit: 'Masjid', jumlah: 100 }, { tanggal: '2026-01-11', tipe: 'keluar', kategoriUnit: 'Sosial', jumlah: 30 }]);
    expect(r.total.Keagamaan.masuk).toBe(100);
    expect(r.bulan['2026-01'].Sosial.keluar).toBe(30);
  });
  it('serial/hidupkan menjaga Timestamp bolak-balik', () => {
    const ts = { seconds: 1, toDate: () => new Date('2026-01-01T00:00:00Z') };
    const j = serial({ a: ts, b: [1, undefined] });
    expect(j.a).toEqual({ __ts: '2026-01-01T00:00:00.000Z' });
    expect(hidupkan(j, (ms) => ms).a).toBe(Date.parse('2026-01-01T00:00:00Z'));
  });
});
