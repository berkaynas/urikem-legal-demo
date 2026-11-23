// Urikem Legal — doğal dille sorgu (1. faz: kural tabanlı, internetsiz).
// Soruyu bir filtreye çevirir: konu, zaman aralığı, dosya türü, müvekkil, mahkeme, dosya no ve durum.
// Veri hiçbir yere gönderilmez. 2. fazda serbest sorular için yapay zekâ yalnızca bu filtreyi üretir.
(function (kok) {
  const UA = (kok.UA = kok.UA || {});
  const kucuk = (s) => String(s || '').toLocaleLowerCase('tr-TR').replace(/[’'`"]/g, '').replace(/\s+/g, ' ').trim();
  const GENEL = new Set(['ltd', 'şti', 'a.ş.', 'aş', 'san', 'tic', 've', 'mahkemesi', 'dairesi', 'istanbul', 'asliye', 'hukuk', 'dosya', 'dosyası']);

  const gunEkle = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const pazartesi = (d) => gunEkle(d, -((d.getDay() + 6) % 7));
  const ayBasi = (d, n = 0) => new Date(d.getFullYear(), d.getMonth() + n, 1);
  const aySonu = (d, n = 0) => new Date(d.getFullYear(), d.getMonth() + n + 1, 0);

  function zamanCoz(q, bugun) {
    const b = UA.gun(bugun);
    let m;
    if (/\bbugün|bugun\b/.test(q)) return { bas: b, bit: b, etiket: 'bugün' };
    if (/\byarın|yarin\b/.test(q)) return { bas: gunEkle(b, 1), bit: gunEkle(b, 1), etiket: 'yarın' };
    if (/(gelecek|önümüzdeki|onumuzdeki|sonraki) hafta|haftaya/.test(q)) { const p = gunEkle(pazartesi(b), 7); return { bas: p, bit: gunEkle(p, 6), etiket: 'gelecek hafta' }; }
    if (/geçen hafta|gecen hafta/.test(q)) { const p = gunEkle(pazartesi(b), -7); return { bas: p, bit: gunEkle(p, 6), etiket: 'geçen hafta' }; }
    if (/bu hafta/.test(q)) { const sonu = gunEkle(pazartesi(b), 6); return { bas: b, bit: (b.getDay() === 6 || b.getDay() === 0) ? gunEkle(b, 7) : sonu, etiket: 'bu hafta' }; }
    if (/(gelecek|önümüzdeki|onumuzdeki) ay/.test(q)) return { bas: ayBasi(b, 1), bit: aySonu(b, 1), etiket: 'gelecek ay' };
    if (/geçen ay|gecen ay/.test(q)) return { bas: ayBasi(b, -1), bit: aySonu(b, -1), etiket: 'geçen ay' };
    if (/bu ay/.test(q)) return { bas: ayBasi(b), bit: aySonu(b), etiket: 'bu ay' };
    if ((m = q.match(/son (\d{1,3}) gün/))) return { bas: gunEkle(b, -+m[1]), bit: b, etiket: `son ${m[1]} gün` };
    if ((m = q.match(/(\d{1,3}) gün (içinde|içerisinde|kala|kalan)|(önümüzdeki|gelecek) (\d{1,3}) gün/))) { const n = +(m[1] || m[4]); return { bas: b, bit: gunEkle(b, n), etiket: `${n} gün içinde` }; }
    if ((m = q.match(/(\d{1,2}) hafta (içinde|içerisinde)/))) return { bas: b, bit: gunEkle(b, 7 * m[1]), etiket: `${m[1]} hafta içinde` };
    return null;
  }

  function konuCoz(q) {
    if (/son gün|son gun|süre|sure(si|leri)?\b|süresi|kaçır/.test(q)) return 'sure';
    if (/tebli[gğ]|mazbata/.test(q)) return 'tebligat';
    if (/duruşma|durusma|celse|keşif/.test(q)) return 'durusma';
    if (/masraf|gider|harç|harc|avans|bakiye|tahsil|borç|ödeme|odeme|alacak|para|vekâlet|vekalet ücret/.test(q)) return 'para';
    if (/evrak|belge|karar|dilekçe|dilekce|rapor|zabıt|zapt/.test(q)) return 'evrak';
    if (/müvekkil|muvekkil/.test(q)) return 'muvekkil';
    return 'dosya';
  }

  function adEslestir(q, adlar) {
    const tokenlar = q.split(/[^0-9a-zçğıöşü]+/).filter((t) => t.length >= 3);
    let enIyi = 0, secilen = [];
    for (const ad of adlar) {
      const kelimeler = kucuk(ad).split(/[^0-9a-zçğıöşü.]+/).filter((k) => k.length >= 3 && !GENEL.has(k));
      let puan = 0;
      for (const k of kelimeler) {
        if (tokenlar.some((t) => t === k || (t.length >= 4 && t.startsWith(k)) || (t.length >= 5 && k.startsWith(t)))) puan += k.length;
      }
      if (puan > enIyi) { enIyi = puan; secilen = [ad]; } else if (puan && puan === enIyi) secilen.push(ad);
    }
    return enIyi >= 4 ? secilen : [];
  }

  // ctx = { muvekkilAdlari: [...], birimAdlari: [...] }
  const esikCoz = (q) => {
    const l = [];
    const re = /(en az|en fazla|en çok)?\s*(\d[\d.,]*)\s*(bin|milyon)?\s*(tl|lira|₺)?\s*['’]?\s*(?:[dt][ae]n|[ıiuü]n)?\s*(fazla|çok|yüksek|büyük|üstü|üstünde|üzeri|üzerinde|aşan|geçen|az|düşük|küçük|altı|altında)?(\s+dosya)?/g;
    for (const m of q.matchAll(re)) {
      const [tam, en, sayi, kat, para, kar, dosya] = m;
      if (!en && !kar) continue;
      const sonra = q.slice(m.index + tam.length, m.index + tam.length + 8);
      if (/^\s*(gün|gun|hafta|ay|yıl|saat)/.test(sonra) || /\/\s*$/.test(q.slice(0, m.index + (m[0].indexOf(sayi))))) continue;
      let v = parseFloat(sayi.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
      if (!Number.isFinite(v)) continue;
      if (kat === 'bin') v *= 1000; else if (kat === 'milyon') v *= 1e6;
      const op = en === 'en az' ? '>=' : en ? '<=' : /^(az|düşük|küçük|alt)/.test(kar) ? '<' : '>';
      const alan = dosya || (!para && !kat && /dosya/.test(sonra + ' ' + q.slice(m.index + tam.length, m.index + tam.length + 20)) && !/masraf|avans|tahsil|bakiye/.test(q)) ? 'dosya'
        : /avans/.test(q) ? 'avans' : /tahsil|alacak|borç/.test(q) ? 'tahsil' : /bakiye/.test(q) ? 'bakiye' : 'masraf';
      l.push({ alan, op, deger: v });
    }
    return l;
  };

  UA.sorguCoz = (metin, ctx = {}, bugun = new Date()) => {
    const q = kucuk(metin);
    const sonuc = { metin, konu: konuCoz(q), zaman: zamanCoz(q, bugun), tur: null, muvekkiller: [], birimler: [], dosyaNo: null, durum: {}, hedefMuvekkil: /müvekkil|muvekkil/.test(q) };
    if (/\bicra\b|icra dosya|takip/.test(q)) sonuc.tur = 'icra';
    else if (/\bhukuk\b|dava/.test(q)) sonuc.tur = 'hukuk';
    const no = q.match(/\b(20\d{2})\s*\/\s*(\d{1,6})\b/);
    if (no) sonuc.dosyaNo = `${no[1]}/${no[2]}`;
    sonuc.muvekkiller = adEslestir(q, ctx.muvekkilAdlari || []);
    // Mahkeme: müvekkil adına girmeyen, birim adlarında geçen kelimeler
    const muvKelime = new Set(sonuc.muvekkiller.flatMap((a) => kucuk(a).split(/\s+/)));
    const birimKelimeleri = ['ticaret', 'iş mahkeme', 'aile', 'sulh', 'tüketici', 'kadıköy', 'anadolu', 'bakırköy', 'ankara', 'izmir', 'icra dairesi', 'ağır ceza', 'idare'];
    for (const k of birimKelimeleri) if (q.includes(k) && !muvKelime.has(k)) sonuc.birimler.push(k);
    if (/biten|bitmiş|\beksi\b|eksiye|negatif|yetmeyen|yetersiz|tükenen|tahsil edilecek|bekleyen|borçlu/.test(q)) sonuc.durum.avansEksi = true;
    if (/okunmamış|okunmamis|yeni gelen|yeni evrak|okumadığım/.test(q)) sonuc.durum.okunmamis = true;
    if (/belgesi eksik|belgesiz|makbuzu eksik|fişi eksik|faturası eksik/.test(q)) sonuc.durum.belgesiz = true;
    if (/girilmemiş|girmediğim|girilmedi/.test(q)) sonuc.durum.suresiz = true;
    if (/uyumsuz|hatalı|yanlış|tutmayan/.test(q)) sonuc.durum.uyumsuz = true;
    if (/kapan|bitmiş dosya/.test(q) && sonuc.konu === 'dosya') sonuc.durum.kapali = true;
    // Tutar / sayı şartları: "5000 TL'den fazla masraf", "en az 3 dosyası olan", "10 binin altında avans"
    sonuc.esikler = esikCoz(q);
    if (sonuc.esikler.length && ['dosya', 'muvekkil'].includes(sonuc.konu)) sonuc.konu = sonuc.hedefMuvekkil ? 'muvekkil' : 'para';
    if (sonuc.esikler.length && sonuc.konu === 'para' && sonuc.hedefMuvekkil) sonuc.konu = 'muvekkil';
    // "Yarın ne var?" gibi yalnız zaman soran sorular: o aralıktaki bütün işler
    if (sonuc.konu === 'dosya' && sonuc.zaman && !sonuc.muvekkiller.length && !sonuc.dosyaNo && !sonuc.birimler.length) sonuc.konu = 'ajanda';
    return sonuc;
  };

  UA.ORNEK_SORULAR = [
    'Gelecek hafta duruşması olan dosyalarım',
    'Avansı biten müvekkiller',
    '7 gün içinde dolan süreler',
    'Bu hafta ne var',
    'İcra dosyalarım',
    'Örnek Lojistik dosyaları ve bakiyesi',
    'Son 30 günde gelen tebligatlar',
    'Belgesi eksik masraflar',
  ];
})(typeof window !== 'undefined' ? window : globalThis);
