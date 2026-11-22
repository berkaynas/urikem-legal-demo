// Süre hesabı — Saadet Kartı'nın "Avukat Ajandası" (ajanda.html, sürüm 0.1) hesap motorundan alınmıştır.
// Kaynak: https://www.karti.av.tr/acik-erisim.html
//
// MIT License
// Copyright (c) 2026 Saadet Kartı
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
// associated documentation files (the "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
// following conditions: The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
// LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
// EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
// IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// Değişiklik: Kod, Urikem Legal'in UA ad alanına taşındı; hesap kuralları aynen korundu.
(function (kok) {
  const UA = (kok.UA = kok.UA || {});

  const TATIL = {
    '2026-01-01': 'Yılbaşı', '2026-03-20': 'Ramazan Bayramı', '2026-03-21': 'Ramazan Bayramı', '2026-03-22': 'Ramazan Bayramı',
    '2026-04-23': '23 Nisan', '2026-05-01': '1 Mayıs', '2026-05-19': '19 Mayıs', '2026-05-27': 'Kurban Bayramı', '2026-05-28': 'Kurban Bayramı',
    '2026-05-29': 'Kurban Bayramı', '2026-05-30': 'Kurban Bayramı', '2026-07-15': '15 Temmuz', '2026-08-30': '30 Ağustos', '2026-10-29': 'Cumhuriyet Bayramı',
    '2027-01-01': 'Yılbaşı', '2027-03-09': 'Ramazan Bayramı', '2027-03-10': 'Ramazan Bayramı', '2027-03-11': 'Ramazan Bayramı',
    '2027-04-23': '23 Nisan', '2027-05-01': '1 Mayıs', '2027-05-16': 'Kurban Bayramı', '2027-05-17': 'Kurban Bayramı', '2027-05-18': 'Kurban Bayramı',
    '2027-05-19': '19 Mayıs', '2027-07-15': '15 Temmuz', '2027-08-30': '30 Ağustos', '2027-10-29': 'Cumhuriyet Bayramı',
  };
  const BIRIM = { gun: 'gün', hafta: 'hafta', ay: 'ay' };

  const p = (s) => { const a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); };
  const iki = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + iki(d.getMonth() + 1) + '-' + iki(d.getDate());
  const ekle = (s, n) => { const d = p(s); d.setDate(d.getDate() + n); return iso(d); };
  const ayEkle = (s, n) => {
    const d = p(s), g = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
    const son = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(g, son)); return iso(d);
  };
  const tatilAdi = (s) => { const g = p(s).getDay(); return TATIL[s] || (g === 6 ? 'Cumartesi' : g === 0 ? 'Pazar' : ''); };
  const isGunuIleri = (s) => { while (tatilAdi(s)) s = ekle(s, 1); return s; };

  // g = { tarih: 'YYYY-AA-GG', n: sayı, birim: 'gun'|'hafta'|'ay', tabi: true|false }
  function hesapla(g) {
    const a = [{ e: 'Tebliğ ya da tefhim günü', t: g.tarih }];
    let son = g.birim === 'gun' ? ekle(g.tarih, g.n) : g.birim === 'hafta' ? ekle(g.tarih, 7 * g.n) : ayEkle(g.tarih, g.n);
    a.push({ e: 'Süre: ' + g.n + ' ' + BIRIM[g.birim], t: son,
      n: g.birim === 'gun' ? 'HMK m. 92/1: tebliğ ya da tefhim günü sayılmaz' : 'HMK m. 92/2: başladığı güne karşılık gelen gün' });
    if (g.tabi) {
      const y = son.slice(0, 4);
      if (son >= y + '-07-20' && son <= y + '-08-31') {
        son = y + '-09-07';
        a.push({ e: 'Bitiş adli tatile rastlıyor', t: son, n: 'HMK m. 104: tatilin bittiği günden itibaren bir hafta' });
      }
    }
    const ilk = tatilAdi(son);
    if (ilk) {
      son = isGunuIleri(son);
      a.push({ e: 'Son gün tatile rastlıyor (' + ilk + ')', t: son, n: 'HMK m. 93: tatili izleyen ilk iş günü' });
    }
    return { adimlar: a, son };
  }

  UA.kartiHesapla = hesapla;
  UA.tatilAdi = tatilAdi;
  UA.tatilYiliVar = (s) => Object.keys(TATIL).some((t) => t.slice(0, 4) === String(s).slice(0, 4));
  UA.adliAralik = (s) => { const g = String(s).slice(5); return g >= '07-20' && g <= '09-01'; };
})(typeof window !== 'undefined' ? window : globalThis);
