// Urikem Legal — veri katmanı.
// UYAP cevaplarını ürünün kendi modeline çevirir, süre kontrolü ve masraf hesabını yapar.
// Hem eklentinin köprü betiğinde hem panelde kullanılır. Kendisi UYAP'a istek göndermez (okumayı yakala.js yapar).
(function (kok) {
  const UA = (kok.UA = kok.UA || {});

  UA.IZLENEN = [
    'search_phrase_detayli.ajx',
    'dosyaAyrintiBilgileri_brd.ajx',
    'dosya_taraf_bilgileri_brd.ajx',
    'list_dosya_evraklar.ajx',
    'dosya_tahsilat_reddiyat_bilgileri_brd.ajx',
    'avukat_durusma_sorgula_brd.ajx',
    'get_kullanici_bildirimleri.ajx',
  ];

  UA.bos = () => ({
    surum: 1, budandi: 1, kimlikDuzeldi: 3, evrakDuzeldi: 4, // yeni kayıtlar baştan temiz
    gorulen: {},
    kimlik: {},     // UYAP'ın o oturumdaki dosya kimliği → kalıcı dosya anahtarı
    dosyalar: {},   // kalıcı dosya anahtarı (mahkeme + numara) → dosya
    durusmalar: {}, // kayitId → duruşma
    evraklar: {},   // evrakId → evrak
    para: {},       // dosyaId → UYAP tahsilat/harç/reddiyat
    taraflar: {},   // dosyaId → [taraf]
    bildirimler: {},
    senkron: {},    // veri türü → son yakalama zamanı (ISO)
  });

  // ---------- yardımcılar ----------
  const duzlestir = (v) => (Array.isArray(v) ? v.flatMap(duzlestir) : v && typeof v === 'object' ? [v] : []);

  // UYAP dosya kimliğini istekte tırnak içinde gönderiyor ("\"abc\""); cevaplarda tırnaksız. Tek biçime indir.
  UA.dosyaIdCoz = (x) => (x == null ? x : String(x).replace(/^"+|"+$/g, ''));
  UA.istekCoz = (govde) => {
    if (!govde) return {};
    if (typeof govde === 'object') return govde;
    try { return JSON.parse(govde); } catch (_) {}
    try { return Object.fromEntries(new URLSearchParams(govde)); } catch (_) {}
    return {};
  };

  // Farklı UYAP tarih biçimlerini "YYYY-AA-GG" (ve varsa saat) olarak çözer.
  UA.tarihCoz = (v) => {
    if (!v) return null;
    if (typeof v === 'object' && v.date) {
      const d = v.date, t = v.time || {};
      return new Date(d.year, d.month - 1, d.day, t.hour || 0, t.minute || 0);
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
    const d = new Date(s);
    return isNaN(d) ? null : d;
  };

  UA.gun = (d) => { if (!d) return null; const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  UA.iso = (d) => { const x = UA.gun(d); return x ? `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` : ''; };
  UA.trTarih = (d) => (d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
  UA.trSaat = (d) => (d ? new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '');
  UA.tl = (n) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL');
  UA.normal = (s) => String(s || '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();

  // ---------- kalıcı kimlikler ----------
  // UYAP dosya ve evrak kimliklerini her oturumda yeniden üretiyor (aynı dosya her okumada başka kimlikle geliyor).
  // Bu yüzden ürün dosyayı "mahkeme + dosya numarası"yla, evrakı içeriğiyle (tür, tarih, açıklama…) tanır.
  // UYAP'ın o anki kimliği yalnız okuma isteği için dosya kaydında (uyapId) tutulur.
  const ozet = (metin) => {
    let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
    for (let i = 0; i < metin.length; i++) { const c = metin.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822507) ^ (h2 >>> 13); }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  };
  UA.dosyaAnahtari = (no, birim) => (no && birim ? 'd' + ozet(UA.normal(birim) + '|' + UA.normal(no)) : null);
  UA.evrakAnahtari = (dosya, e) => 'e' + ozet([dosya, e.tur, e.tip, e.onayTarihi, e.sistemTarihi, e.aciklama, e.gonderen].map((x) => UA.normal(x)).join('|'));
  UA.durusmaAnahtari = (dosya, tarihSaat, islem) => 'r' + ozet([dosya, tarihSaat, UA.normal(islem)].join('|'));
  // UYAP kimliği → kalıcı dosya anahtarı. Dosya başına en fazla 4 eski kimlik akılda tutulur.
  UA.kimlikBagla = (db, d, uyapId, zaman) => {
    if (!uyapId) return;
    db.kimlik = db.kimlik || {};
    db.kimlik[uyapId] = d.dosyaId;
    const l = (d.uyapIdler || []).filter((x) => x !== uyapId);
    l.unshift(uyapId);
    for (const eski of l.splice(4)) if (db.kimlik[eski] === d.dosyaId) delete db.kimlik[eski];
    d.uyapIdler = l; d.uyapId = uyapId; d.uyapIdZaman = zaman;
  };
  // İstekteki UYAP kimliğinden dosya kaydını bul (bilinmiyorsa geçici kayıt aç)
  const dosyaBul = (db, hamId, zaman) => {
    const id = UA.dosyaIdCoz(hamId);
    if (!id) return null;
    const k = (db.kimlik || {})[id] || id;
    let d = db.dosyalar[k];
    if (!d) { d = db.dosyalar[k] = { dosyaId: k, ilkGorulme: zaman }; UA.kimlikBagla(db, d, id, zaman); }
    return d;
  };

  // Önce geçici anahtarla açılmış bir kaydı (ör. arama yapılmadan gelen duruşma) asıl kayda taşır
  const kayitTasi = (db, eski, yeni) => {
    const a = db.dosyalar[eski], b = db.dosyalar[yeni];
    if (!a || !b || eski === yeni) return;
    for (const [k, v] of Object.entries(a)) if (!dolu(b[k])) b[k] = v;
    b.uyapIdler = [...new Set([...(b.uyapIdler || []), ...(a.uyapIdler || [])])].slice(0, 4);
    delete db.dosyalar[eski];
    for (const alan of ['taraflar', 'para', 'gorulen']) if (db[alan] && db[alan][eski]) { db[alan][yeni] = db[alan][yeni] || db[alan][eski]; delete db[alan][eski]; }
    for (const e of Object.values(db.evraklar)) if (e.anaDosyaId === eski) e.anaDosyaId = yeni;
    for (const [id, r] of Object.entries(db.durusmalar)) if (r.dosyaId === eski) {
      delete db.durusmalar[id];
      const n = UA.durusmaAnahtari(yeni, r.tarihSaat, r.islem);
      db.durusmalar[n] = { ...r, id: n, dosyaId: yeni, birim: b.birimAdi || r.birim };
    }
    for (const [i, k] of Object.entries(db.kimlik || {})) if (k === eski) db.kimlik[i] = yeni;
  };

  const dolu = (v) => v != null && v !== '' && !(Array.isArray(v) && !v.length);
  const birlestir = (a, b) => { // a yeni, b eski: a'da boş olan alanlar b'den gelir
    if (!a) return b; if (!b) return a;
    const o = { ...a };
    for (const [k, v] of Object.entries(b)) if (!dolu(o[k])) o[k] = v;
    if (a.ilkGorulme && b.ilkGorulme) o.ilkGorulme = a.ilkGorulme < b.ilkGorulme ? a.ilkGorulme : b.ilkGorulme;
    return o;
  };
  const enYeni = (...l) => l.filter(Boolean).sort().pop();

  // Eski kayıtları kalıcı kimliklere taşır (yüklenirken bir kez). Aynı dosyanın kopyaları tek kayıtta birleşir.
  UA.dbDuzelt = (db) => {
    if (!db || db.surum !== 1) return db;
    if (db.kimlikDuzeldi !== 3) kalicaTasi(db);
    if (db.evrakDuzeldi !== 4) evrakTekille(db);
    return db;
  };
  const kalicaTasi = (db) => {
    const c = UA.dosyaIdCoz, simdi = new Date().toISOString();
    const eskiler = Object.entries(db.dosyalar || {}).map(([k, d]) => ({ id: c(k), d }))
      .sort((x, y) => String(y.d.guncelleme || y.d.ilkGorulme || '').localeCompare(String(x.d.guncelleme || x.d.ilkGorulme || '')));
    const takma = {}, dosyalar = {};
    for (const { id, d } of eskiler) { const a = UA.dosyaAnahtari(d.dosyaNo, d.birimAdi); if (a && !takma[id]) takma[id] = a; }
    // Türsüz geçici kayıtlar (yalnız evrak/taraf okunmuş): aynı UYAP kimliğinin numaralı kaydı varsa ona bağlanır
    for (const { id, d } of eskiler) {
      const k = takma[id] || id;
      takma[id] = k;
      const onceki = dosyalar[k];
      const yeni = birlestir(onceki, { ...d, dosyaId: k });
      yeni.sonOkuma = enYeni(onceki?.sonOkuma, d.sonOkuma);
      yeni.uyapIdler = [...new Set([...(onceki?.uyapIdler || []), id])].slice(0, 4);
      yeni.uyapId = yeni.uyapIdler[0];
      dosyalar[k] = yeni;
    }
    db.kimlik = {};
    for (const d of Object.values(dosyalar)) { delete d.uyapIdZaman; delete d.evrakIlkSenkron; for (const i of d.uyapIdler) db.kimlik[i] = d.dosyaId; }
    db.dosyalar = dosyalar;
    const tasi = (o, sec) => { const y = {}; for (const [k, v] of Object.entries(o || {})) { const n = takma[c(k)] || c(k); y[n] = y[n] ? sec(y[n], v) : v; } return y; };
    db.taraflar = tasi(db.taraflar, (a, b) => (a && a.length ? a : b));
    db.para = tasi(db.para, (a, b) => (String(a.guncelleme || '') >= String(b.guncelleme || '') ? a : b));
    // Evrak: içerik anahtarına taşı. Görülen listesi eski kimliklerden kurulamaz; dosyanın bir sonraki okuması
    // taban kabul edilir (o okumada hiçbir evrak "yeni" işaretlenmez).
    const evraklar = {}, evrakTakma = {};
    for (const e of Object.values(db.evraklar || {})) {
      const dk = takma[c(e.anaDosyaId)] || c(e.anaDosyaId);
      const ek = UA.evrakAnahtari(dk, e);
      evrakTakma[e.evrakId] = ek;
      evraklar[ek] = birlestir({ ...e, evrakId: ek, anaDosyaId: dk, uyapEvrakId: e.evrakId, dosyaId: undefined, yeni: false }, evraklar[ek]);
    }
    db.evraklar = evraklar; db.evrakTakma = evrakTakma; db.gorulen = {};
    const durusmalar = {};
    for (const r of Object.values(db.durusmalar || {})) {
      const dk = takma[c(r.dosyaId)] || UA.dosyaAnahtari(r.dosyaNo, r.birim) || c(r.dosyaId);
      const id = UA.durusmaAnahtari(dk, r.tarihSaat, r.islem);
      durusmalar[id] = { ...r, id, dosyaId: dk };
    }
    db.durusmalar = durusmalar;
    db.kimlikDuzeldi = 3; db.kimlikTasindi = simdi;
  };
  // v0.5'te aynı evrakın kategori kopyaları "-2, -3…" ekiyle ayrı kaydedilmiş ve sonraki okumada yanlışlıkla "yeni" sayılmıştı.
  // Kopyalar tek kayıtta birleşir, yanlış "yeni" işaretleri kalkar; her dosyanın bir sonraki okuması taban kabul edilir.
  const evrakTekille = (db) => {
    const kok = (k) => String(k).replace(/-\d+$/, '');
    const y = {}, takma = db.evrakTakma || {};
    for (const e of Object.values(db.evraklar || {})) {
      const k = kok(e.evrakId);
      if (k !== e.evrakId) takma[e.evrakId] = k;
      const o = y[k];
      y[k] = o ? { ...o, ilkGorulme: o.ilkGorulme < e.ilkGorulme ? o.ilkGorulme : e.ilkGorulme, yeni: false } : { ...e, evrakId: k, yeni: false };
    }
    db.evraklar = y; db.evrakTakma = takma;
    for (const [d, l] of Object.entries(db.gorulen || {})) db.gorulen[d] = [...new Set(l.map(kok))];
    for (const d of Object.values(db.dosyalar || {})) delete d.evrakIlkSenkron;
    db.evrakDuzeldi = 4;
  };
  // Panelde elle girilen bilgiler (müvekkil, masraf hareketleri, son günler) kalıcı kimliklere taşınır.
  UA.elleDuzelt = (elle, db) => {
    if (!elle || !db) return false;
    let degisti = false;
    if (elle.evrakDuzeldi !== 4 && db.evrakDuzeldi === 4) { // "-2" ekli evrak anahtarlarındaki okundu/son gün kayıtları
      for (const alan of ['sureler', 'okundu']) if (elle[alan] && typeof elle[alan] === 'object') {
        const z = {}; for (const [k, v] of Object.entries(elle[alan])) { const n = String(k).replace(/^(e[0-9a-f]{16})-\d+$/, '$1'); z[n] = z[n] ?? v; } elle[alan] = z;
      }
      elle.evrakDuzeldi = 4; degisti = true;
    }
    if (elle.kimlikDuzeldi === 3 || db.kimlikDuzeldi !== 3) return degisti;
    const c = UA.dosyaIdCoz, kim = db.kimlik || {}, et = db.evrakTakma || {};
    const y = {};
    for (const [k, v] of Object.entries(elle.dosyalar || {})) {
      const n = kim[c(k)] || c(k), a = y[n];
      if (!a) { y[n] = v; continue; }
      const o = birlestir(a, v); o.hareketler = [...(a.hareketler || []), ...(v.hareketler || [])];
      const elleMuv = [a, v].find((x) => x.muvekkil && !x.otoMuvekkil);
      if (elleMuv) { o.muvekkil = elleMuv.muvekkil; o.otoMuvekkil = false; }
      y[n] = o;
    }
    // Hiç UYAP verisi olmayan eski kimlikli boş kayıtları at
    for (const [k, v] of Object.entries(y)) if (!db.dosyalar[k] && !(v.hareketler || []).length && !v.vekaletUcreti && !(v.muvekkil && !v.otoMuvekkil)) delete y[k];
    elle.dosyalar = y;
    for (const alan of ['sureler', 'okundu']) if (elle[alan] && typeof elle[alan] === 'object') {
      const z = {}; for (const [k, v] of Object.entries(elle[alan])) z[et[k] || k] = z[et[k] || k] ?? v; elle[alan] = z;
    }
    elle.kimlikDuzeldi = 3;
    return true;
  };

  // Bir kez: dosya başına en yeni 40 evrak ayrıntısını bırakır, gerisini yalnız kimlik olarak tutar.
  // İlk okumalarda "yeni" işareti taban kabul edilir ve sıfırlanır (ilk kurulumda her şey yeni görünmesin).
  UA.dbBuda = (db) => {
    if (!db || db.surum !== 1 || db.budandi) return db;
    db.gorulen = db.gorulen || {};
    const grup = {};
    for (const e of Object.values(db.evraklar || {})) (grup[e.anaDosyaId] = grup[e.anaDosyaId] || []).push(e);
    for (const [id, l] of Object.entries(grup)) {
      db.gorulen[id] = [...new Set([...(db.gorulen[id] || []), ...l.map((e) => e.evrakId)])];
      l.sort((a, b) => String(b.onayTarihi || b.ilkGorulme).localeCompare(String(a.onayTarihi || a.ilkGorulme)));
      l.forEach((e, i) => { e.yeni = false; if (i >= 40) delete db.evraklar[e.evrakId]; });
      if (db.dosyalar[id]) db.dosyalar[id].evrakIlkSenkron = db.dosyalar[id].evrakIlkSenkron || new Date().toISOString();
    }
    db.budandi = 1;
    return db;
  };

  // ---------- UYAP cevabını işle ----------
  // db: UA.bos() yapısı. uc: yolun son parçası. istek: istek gövdesi. cevap: JSON. zaman: ISO metin.
  UA.isle = (db, uc, istek, cevap, zaman) => {
    zaman = zaman || new Date().toISOString();
    const ad = String(uc).split('/').pop();
    const ist = UA.istekCoz(istek);
    if (cevap == null) return false;
    // UYAP hata döndürdüyse (ör. { error: '…', errorCode: '…' }) eldeki kaydın üzerine boş veri yazılmaz
    if (typeof cevap === 'object' && !Array.isArray(cevap) && ((typeof cevap.error === 'string' && cevap.error.trim()) || (cevap.errorCode != null && String(cevap.errorCode).trim()))) return false;

    switch (ad) {
      case 'search_phrase_detayli.ajx': {
        for (const r of duzlestir(cevap)) {
          const rid = UA.dosyaIdCoz(r.dosyaId);
          if (!rid) continue;
          const k = UA.dosyaAnahtari(r.dosyaNo, r.birimAdi) || (db.kimlik || {})[rid] || rid;
          const d = (db.dosyalar[k] = db.dosyalar[k] || { dosyaId: k, ilkGorulme: zaman });
          const onceki = (db.kimlik || {})[rid];
          if (onceki && onceki !== k) kayitTasi(db, onceki, k);
          Object.assign(d, {
            dosyaNo: r.dosyaNo, birimAdi: r.birimAdi, dosyaTur: r.dosyaTur, dosyaTurKod: r.dosyaTurKod,
            dosyaDurum: r.dosyaDurum, dosyaDurumKod: r.dosyaDurumKod,
            acilisTarihi: UA.tarihCoz(r.dosyaAcilisTarihi)?.toISOString() || d.acilisTarihi,
            uyapYeni: !!r.isNew, guncelleme: zaman,
          });
          UA.kimlikBagla(db, d, rid, zaman);
        }
        db.senkron.dosyalar = zaman;
        return true;
      }
      case 'dosyaAyrintiBilgileri_brd.ajx': {
        const hamId = ist.dosyaId || cevap.id;
        const k = UA.dosyaAnahtari(cevap.dosyaNo, cevap.birimAdi);
        let d = k && db.dosyalar[k];
        if (d) UA.kimlikBagla(db, d, UA.dosyaIdCoz(hamId), zaman); else d = dosyaBul(db, hamId, zaman);
        if (!d) return false;
        Object.assign(d, {
          dosyaNo: cevap.dosyaNo || d.dosyaNo, birimAdi: cevap.birimAdi || d.birimAdi,
          dosyaDurum: cevap.dosyaDurumu || d.dosyaDurum, davaTurleri: cevap.davaTurleriStr || d.davaTurleri,
          birlesenDosyalar: cevap.birlesenDosyaListStr || '', ilgiliDosyalar: cevap.ilgiliDosyaListesiStr || '',
          icra: cevap.takibinTuruAciklama ? {
            takibinTuru: cevap.takibinTuruAciklama, takibinYolu: cevap.takibinYoluAciklama,
            alacak: cevap.alacakKalemToplamTutar, faiz: cevap.alacakKalemFaizTutar,
            takipSonrasiMasraf: cevap.takipSonrasiMasraf, vekaletUcreti: cevap.vekaletUcreti,
            tahsilHarci: cevap.tahsilHarci, tahsilat: cevap.yapilmisBorcTahsilati,
          } : d.icra,
          detayGuncelleme: zaman,
        });
        return true;
      }
      case 'dosya_taraf_bilgileri_brd.ajx': {
        if (!ist.dosyaId || !Array.isArray(cevap)) return false;
        const d = dosyaBul(db, ist.dosyaId, zaman);
        db.taraflar[d.dosyaId] = cevap.map((t) => ({ adi: t.adi, rol: t.rol, vekil: t.vekil, kisiKurum: t.kisiKurum }));
        return true;
      }
      case 'list_dosya_evraklar.ajx': {
        // Bir dosyada yüzlerce evrak olabilir. Yeni evrakı tanımak için bütün evrakın içerik anahtarları tutulur;
        // ayrıntı yalnız son 40 evrak ile henüz okunmamış yeni evrak için saklanır.
        const d = dosyaBul(db, ist.dosyaId, zaman);
        if (!d) return false;
        const id = d.dosyaId;
        db.gorulen = db.gorulen || {};
        const ilkKez = !d.evrakIlkSenkron;
        if (ilkKez) d.evrakIlkSenkron = zaman;
        const gorulen = new Set(db.gorulen[id] || Object.values(db.evraklar).filter((e) => e.anaDosyaId === id).map((e) => e.evrakId));
        // UYAP aynı evrakı birden çok kategoride ve ayrıca "Son 20 Evrak" listesinde, her seferinde başka kimlikle gönderir.
        // Bu yüzden: "Son 20" yalnız kategori listesi boşsa kullanılır; aynı içerikli evrak tek kayıt olur.
        const liste = [];
        for (const [grup, arr] of Object.entries(cevap.tumEvraklar || {})) for (const e of arr || []) liste.push([grup, e]);
        if (!liste.length) for (const e of cevap.son20Evrak || []) liste.push([null, e]);
        const kirp = (x, n) => (x == null ? x : String(x).slice(0, n));
        const islenen = new Set();
        for (const [grup, e] of liste) {
          if (!e.evrakId) continue;
          const alanlar = {
            tur: kirp(e.tur, 80), tip: kirp(e.tip, 60), aciklama: kirp(e.aciklama, 140), gonderen: kirp(e.gonderenYerKisi, 80),
            onayTarihi: UA.tarihCoz(e.onaylandigiTarih)?.toISOString() || null,
            sistemTarihi: UA.tarihCoz(e.sistemeGonderildigiTarih)?.toISOString() || null,
          };
          const ek = UA.evrakAnahtari(id, alanlar);
          if (islenen.has(ek)) continue; // aynı evrakın başka kategorideki kopyası
          islenen.add(ek);
          const v = db.evraklar[ek];
          const yeniMi = !gorulen.has(ek) && !ilkKez;
          db.evraklar[ek] = Object.assign(v || { evrakId: ek, ilkGorulme: zaman, yeni: yeniMi }, alanlar, {
            anaDosyaId: id, uyapEvrakId: e.evrakId, grup: kirp(v?.grup || grup || null, 60),
            ekSayisi: (e.ekEvrakListesi || []).length,
          });
          gorulen.add(ek);
        }
        // Bu dosyanın ayrıntısı tutulan evrakı: okunmamış yeniler + en yeni 40
        const bunun = Object.values(db.evraklar).filter((e) => e.anaDosyaId === id);
        const tut = new Set(bunun.filter((e) => e.yeni).map((e) => e.evrakId));
        bunun.sort((a, b) => String(b.onayTarihi || b.ilkGorulme).localeCompare(String(a.onayTarihi || a.ilkGorulme))).slice(0, 40).forEach((e) => tut.add(e.evrakId));
        for (const e of bunun) if (!tut.has(e.evrakId)) delete db.evraklar[e.evrakId];
        db.gorulen[id] = [...gorulen];
        d.sonOkuma = zaman;
        db.senkron.evraklar = zaman;
        return true;
      }
      case 'dosya_tahsilat_reddiyat_bilgileri_brd.ajx': {
        const d = dosyaBul(db, ist.dosyaId, zaman);
        if (!d) return false;
        const id = d.dosyaId;
        // UYAP alan adları ekrana ve dosya türüne göre değişebiliyor: bilinen adlar, yoksa adında tutar/miktar geçen sayı alanı.
        const sayi = (v) => (typeof v === 'number' ? v : typeof v === 'string' && /^-?[\d.,\s]+$/.test(v.trim()) && v.trim() ? +(/,\d{1,2}$/.test(v.trim()) ? v.replace(/[.\s]/g, '').replace(',', '.') : v.replace(/[,\s]/g, '')) : null);
        const sec = (r, adlar, desen, haric) => {
          for (const a of adlar) if (r[a] != null && r[a] !== '') return r[a];
          for (const [k, v] of Object.entries(r)) if (desen.test(k) && !(haric && haric.test(k)) && v != null && v !== '') return v;
          return null;
        };
        const TUTAR_ADI = {
          tahsilat: ['tahsilatTutari', 'yatirilanMiktar', 'miktar', 'tutar', 'odenenMiktar'],
          'harç': ['yatirilanMiktar', 'miktar', 'harcTutari', 'tahsilatTutari', 'tutar'],
          reddiyat: ['reddiyatTutari', 'miktar', 'tutar', 'odenenMiktar'],
        };
        const satir = (r, tur) => ({
          kayitId: r.kayitId ?? `${tur}-${r.makbuzNo}-${r.tahsilatTarihi ?? r.reddiyatTarihi ?? ''}`, tur, makbuzNo: r.makbuzNo,
          odeyen: sec(r, ['odeyenKisi', 'alacakli', 'odenenKisi', 'reddiyatYapilanKisi'], /(odeyen|odenen|alici|kisi)/i),
          kalem: sec(r, ['tahsilatTuru', 'reddiyatNedeni', 'reddiyatTuru', 'harcTuru', 'harcAdi', 'aciklama', 'durumAciklama'], /(tur|turu|adi|aciklama)$/i, /dosya|birim/i),
          tarih: (() => { const t = sec(r, ['tahsilatTarihi', 'reddiyatTarihi', 'harcTarihi', 'odemeTarihi', 'tarih'], /tarih/i); return UA.tarihCoz(t)?.toISOString() || t || null; })(),
          // Harçta UYAP üç rakam verir: hesaplamaYapilanTutar (harca esas değer), odenebilirMiktar, yatirilanMiktar (ödenen). Ödenen alınır.
          tutar: sayi(sec(r, TUTAR_ADI[tur], /(tutar|miktar|bedel)/i, /kalan|toplam|hesaplama|matrah|odenebilir/i)),
          kalan: sayi(sec(r, ['kalanMiktar', 'kalanTutar'], /kalan/i)),
          // İstinaf/Yargıtay dosyası ilk derece dosyasının ödemelerini de listeler: satırın asıl dosyası
          satirDosya: UA.dosyaAnahtari(r.dosyaNo, r.birimAdi) || null,
        });
        // Teşhis için yalnız ALAN ADLARI ve türleri tutulur (değer tutulmaz)
        db.alanAdlari = db.alanAdlari || {};
        const ap = (db.alanAdlari.para = db.alanAdlari.para || {});
        const adlar = (ad, l) => { const o = (ap[ad] = ap[ad] || {}); for (const r of (l || []).slice(0, 20)) for (const [k, v] of Object.entries(r || {})) if (Object.keys(o).length < 60) o[k] = typeof v; };
        adlar('tahsilat', cevap.tahsilatList); adlar('harc', cevap.harcList); adlar('reddiyat', cevap.reddiyatList);
        adlar('ust', [Object.fromEntries(Object.entries(cevap).map(([k, v]) => [k, Array.isArray(v) ? [] : v]))]);
        ap.zaman = zaman;
        db.para[id] = {
          tahsilatlar: (cevap.tahsilatList || []).map((r) => satir(r, 'tahsilat')),
          harclar: (cevap.harcList || []).map((r) => satir(r, 'harç')),
          reddiyatlar: (cevap.reddiyatList || []).map((r) => satir(r, 'reddiyat')),
          toplam: { tahsilat: cevap.toplamTahsilat, reddiyat: cevap.toplamreddiyat, teminat: cevap.toplamTeminat, harc: cevap.toplamTahsilHarci, kalan: cevap.toplamKalan, haricen: cevap.haricen },
          icraMi: !!cevap.isIcraMi, guncelleme: zaman, surum: 3,
        };
        db.senkron.para = zaman;
        return true;
      }
      case 'avukat_durusma_sorgula_brd.ajx': {
        if (!Array.isArray(cevap)) return false;
        for (const r of cevap) {
          const did = UA.dosyaIdCoz(r.dosyaId);
          const k = (db.kimlik || {})[did] || UA.dosyaAnahtari(r.dosyaNo, r.yerelBirimAd) || did;
          if (!k) continue;
          let d = db.dosyalar[k];
          if (!d) d = db.dosyalar[k] = { dosyaId: k, dosyaNo: r.dosyaNo, birimAdi: r.yerelBirimAd, dosyaTur: r.dosyaTurKodAciklama, ilkGorulme: zaman };
          if (did) UA.kimlikBagla(db, d, did, zaman);
          const tarihSaat = UA.tarihCoz(r.tarihSaat)?.toISOString() || null;
          const id = UA.durusmaAnahtari(k, tarihSaat, r.islemTuruAciklama);
          db.durusmalar[id] = {
            id, dosyaId: k, dosyaNo: r.dosyaNo, birim: r.yerelBirimAd, dosyaTur: r.dosyaTurKodAciklama,
            tarihSaat, islem: r.islemTuruAciklama, sonuc: r.islemSonucuAciklama,
            taraflar: (r.dosyaTaraflari || []).map((t) => ({ ad: [t.isim, t.soyad].filter(Boolean).join(' '), sifat: t.sifat, vekil: !!t.isVekil })),
            guncelleme: zaman,
          };
        }
        db.senkron.durusmalar = zaman;
        return true;
      }
      case 'get_kullanici_bildirimleri.ajx': {
        if (!Array.isArray(cevap)) return false;
        for (const b of cevap) db.bildirimler[b.bildirimId ?? b.mesajId] = { baslik: b.baslik, mesaj: b.mesaj, tarih: UA.tarihCoz(b.gonderilmeTarihi)?.toISOString() || b.gonderilmeTarihi, okundu: !!b.okunduMu };
        db.senkron.bildirimler = zaman;
        return true;
      }
    }
    return false;
  };

  // ---------- evrak sınıflandırma ----------
  UA.evrakMetni = (e) => UA.normal([e.tur, e.tip, e.aciklama, e.grup].join(' '));
  UA.tebligatMi = (e) => /tebli[gğ]|mazbata|tebellü[gğ]/.test(UA.evrakMetni(e));
  UA.makbuzMu = (e) => /makbuz|dekont|reddiyat fi[sş]/.test(UA.evrakMetni(e));
  UA.onemliMi = (e) => UA.tebligatMi(e) || /karar|zapt|zab[ıi]t|bilirki[sş]i|ihtar|muht[ıi]ra|[oö]deme emri/.test(UA.evrakMetni(e));

  // ---------- süre kontrolü ----------
  // Sistem son günü ÖNERMEZ. Avukat son günü girer; asistan Kartı ajandasının hesap motoruyla
  // (karti-sure.js) karşılaştırır, farkı ve her adımın dayanağını gösterir.
  UA.sureKontrol = (tebligTarihi, sure, girilenSonGun, tabi) => {
    const t = UA.iso(UA.tarihCoz(tebligTarihi)), g = UA.iso(UA.tarihCoz(girilenSonGun));
    if (!t || !g || !sure || !sure.miktar || !UA.kartiHesapla) return null;
    const birim = { 'gün': 'gun', gun: 'gun', hafta: 'hafta', ay: 'ay' }[sure.birim] || 'gun';
    const h = UA.kartiHesapla({ tarih: t, n: +sure.miktar, birim, tabi: !!tabi });
    const adimlar = h.adimlar.map((a) => `${a.e}: ${UA.trTarih(UA.tarihCoz(a.t))}${a.n ? ' — ' + a.n : ''}`);
    const fark = Math.round((UA.tarihCoz(g) - UA.tarihCoz(h.son)) / 86400000);
    const notlar = [];
    if (!tabi && UA.adliAralik(h.son)) notlar.push('Son gün 20 Temmuz – 1 Eylül arasına rastlıyor. İş adli tatile tabiyse "adli tatile tabi" seçin.');
    if (!UA.tatilYiliVar(h.son)) notlar.push('Bu yılın resmî tatil listesi henüz tanımlı değil; yalnız hafta sonları hesaba katıldı.');
    notlar.push('Hesap Kartı Avukat Ajandası motoruyla yapıldı. Süreyi doğuran evrakı ve kanun hükmünü siz de kontrol edin.');
    return { hesaplanan: h.son, adimlar, fark, durum: fark === 0 ? 'uyumlu' : fark > 0 ? 'gec' : 'erken', sinirlar: notlar.join(' ') };
  };

  // ---------- masraf / avans / tahsilat ----------
  // Yonca'nın planı: masraf ayrı, avans ayrı finansal hareket. Masraf müvekkile yansıtılabilir ya da büroda kalır.
  // Bakiye = alınan avans + masraf tahsilatları − iadeler − müvekkile yansıtılan masraflar.
  // Bakiye ≥ 0 → kullanılabilir avans; < 0 → müvekkilden tahsil edilecek. Kapanış: vekâlet ücreti − bakiye.
  // ---------- müvekkili UYAP'tan tanıma ----------
  // Taraflar sekmesinde vekil olarak avukatın adı geçen taraf müvekkil sayılır. Avukat sonradan değiştirebilir.
  UA.otoMuvekkil = (db, elle, avukatAdi) => {
    const ad = UA.normal(avukatAdi).replace(/^av\.?\s*/, '');
    if (!ad) return false;
    let degisti = false;
    for (const id of Object.keys(db.dosyalar)) {
      const e = (elle.dosyalar[id] = elle.dosyalar[id] || { hareketler: [] });
      if (!(e.bizimAdlar || []).includes(avukatAdi)) { e.bizimAdlar = [...(e.bizimAdlar || []), avukatAdi]; degisti = true; }
      if (e.muvekkil) continue;
      const t = (db.taraflar[id] || []).find((x) => UA.normal(x.vekil).includes(ad));
      if (t) { e.muvekkil = t.adi; e.otoMuvekkil = true; degisti = true; }
    }
    return degisti;
  };

  // ---------- sabah bildirimi (eklentinin arka planı ve panel ortak kullanır) ----------
  UA.bildirimOzeti = (db, elle, bugun = new Date()) => {
    const b = UA.gun(bugun), fark = (d) => Math.round((UA.gun(UA.tarihCoz(d) || d) - b) / 86400000);
    const kademeler = (elle.ayarlar && elle.ayarlar.kademeler) || [7, 3, 1];
    const satir = [];
    const dr = Object.values(db.durusmalar).filter((d) => d.tarihSaat && fark(d.tarihSaat) >= 0 && fark(d.tarihSaat) <= 1).sort((x, y) => x.tarihSaat.localeCompare(y.tarihSaat));
    for (const d of dr) satir.push(`${fark(d.tarihSaat) === 0 ? 'Bugün' : 'Yarın'} ${UA.trSaat(d.tarihSaat)} duruşma: ${d.birim || ''} ${d.dosyaNo || ''}`);
    let acil = false;
    for (const [id, s] of Object.entries(elle.sureler || {})) {
      const k = fark(s.sonGun);
      if (k < 0 || !(k === 0 || kademeler.includes(k))) continue;
      if (k <= 1) acil = true;
      const e = db.evraklar[id];
      satir.push(`${k === 0 ? 'SON GÜN BUGÜN' : k + ' gün kaldı'}: ${s.aciklama || (e && e.tur) || 'süre'} (${UA.trTarih(UA.tarihCoz(s.sonGun))})`);
    }
    const yeni = Object.values(db.evraklar).filter((e) => e.yeni && !(elle.okundu || {})[e.evrakId]);
    const suresiz = yeni.filter((e) => UA.tebligatMi(e) && !(elle.sureler || {})[e.evrakId]);
    if (suresiz.length) { acil = true; satir.push(`${suresiz.length} tebligatın son günü girilmedi`); }
    if (yeni.length) satir.push(`${yeni.length} okunmamış yeni evrak`);
    return { satirlar: satir, acil, baslik: satir.length ? (acil ? 'Dikkat: süresi yaklaşan iş var' : 'Urikem Legal — bugün') : 'Urikem Legal — bugün sakin' };
  };

  UA.KATEGORI = ['Mahkeme', 'İcra', 'Noter / resmî kurum', 'Ulaşım', 'Diğer'];
  UA.HAREKET = { avans: 'Avans alındı', gider: 'Masraf', tahsilat: 'Masraf tahsilatı', iade: 'Avans iadesi' };
  // UYAP Tah./Red. satırının türü: yalnız "masraf" türü müvekkile yansıtılacak gider olabilir.
  //  teminat → iade edilecek para; borç → icrada borçludan yapılan tahsilat; masraf → harç, gider/delil avansı, depo bedeli…
  UA.paraSinif = (s) => {
    const k = UA.normal(s.kalem);
    if (s.tur === 'reddiyat') return 'reddiyat';
    if (k.includes('teminat')) return 'teminat';
    if (/borç tahsil|borc tahsil|alacak|satış bedeli|ihale bedeli|kira bedeli/.test(k)) return 'borc';
    return 'masraf';
  };
  // Kim ödemiş? Avukatın adı (UYAP'ta görünen ad) → avukat; müvekkilin adı → müvekkil; diğerleri → başkası.
  // buro: ayarlardaki "büromuzda ödeme yapanlar" (ortak avukat, stajyer, sekreter…) — onların ödemesi de büronun masrafıdır.
  UA.odeyenKim = (s, e, buro) => {
    const od = UA.normal(s.odeyen).replace(/^av\.?\s*/, '');
    if (!od) return 'bilinmiyor';
    const avukat = [...(e?.bizimAdlar || []), ...(buro || [])].map((a) => UA.normal(a).replace(/^av\.?\s*/, '')).filter((a) => a.length > 4);
    if (avukat.some((a) => od.includes(a) || a.includes(od) && od.length > 4)) return 'avukat';
    const m = UA.normal(e?.muvekkil);
    if (m && m.length > 4 && (od.includes(m) || m.includes(od) && od.length > 4)) return 'muvekkil';
    return 'baskasi';
  };
  // Geriye uyum: avukatın kendi cebinden ödediği masraf satırı mı?
  UA.bizimOdemeMi = (satir, elle) => {
    const k = elle?.satirSecimi?.[satir.kayitId];
    if (k != null) return k;
    return UA.paraSinif(satir) === 'masraf' && UA.odeyenKim(satir, elle) === 'avukat';
  };

  // Yonca'nın modeli: bakiye = alınan avans + masraf tahsilatı − iade − müvekkile yansıtılan masraf.
  // Müvekkile yansıtılan masraf yalnız AVUKATIN ödediği masraflardır. Müvekkilin kendisinin yatırdığı avans/harç,
  // teminatlar ve borçludan tahsilatlar hesaba girmez. Bekleyen tahsilat ancak dosyanın hesabı açıldıysa
  // (avans/hareket ya da vekâlet ücreti girildiyse) hesaplanır; yoksa ödenen masraf "avans kaydı yok" diye ayrı gösterilir.
  // Aynı UYAP ödemesi birden çok dosyanın Tah./Red. listesinde görünebilir (ilk derece + istinaf + Yargıtay).
  // Her ödeme tek bir dosyada sayılır: satırın kendi dosyası panelde varsa orada; yoksa listeleyen dosyalardan
  // açık olanında (yoksa ilkinde).
  const sahipBellek = new WeakMap();
  const anahtarBellek = new WeakMap();
  const satirAnahtari = (s) => {
    let k = anahtarBellek.get(s);
    if (!k) { k = [s.satirDosya || '', s.tur, s.makbuzNo, s.tarih, s.tutar, UA.normal(s.kalem)].join('|'); anahtarBellek.set(s, k); }
    return k;
  };
  UA.paraSahibi = (db) => {
    if (sahipBellek.has(db.para)) return sahipBellek.get(db.para);
    const acik = (id) => UA.normal(db.dosyalar[id]?.dosyaDurum).startsWith('açık');
    const m = new Map(), kesin = new Set(), tabanSahip = new Map();
    const taban = (s) => [s.tur, s.makbuzNo, s.tarih, s.tutar, UA.normal(s.kalem)].join('|');
    const satirlar = (id) => [...(db.para[id].tahsilatlar || []), ...(db.para[id].harclar || []), ...(db.para[id].reddiyatlar || [])];
    const idler = Object.keys(db.para).sort();
    // 1) Asıl dosyası yazılı satırlar
    for (const id of idler) for (const s of satirlar(id)) {
      if (!s.satirDosya) continue;
      const k = satirAnahtari(s);
      if (db.dosyalar[s.satirDosya]) { m.set(k, s.satirDosya); kesin.add(k); tabanSahip.set(taban(s), s.satirDosya); continue; }
      if (kesin.has(k)) continue;
      const o = m.get(k);
      if (!o || (!acik(o) && acik(id))) m.set(k, id);
    }
    for (const s of idler.flatMap(satirlar)) if (s.satirDosya && !tabanSahip.has(taban(s))) tabanSahip.set(taban(s), m.get(satirAnahtari(s)));
    // 2) Eski okumadan kalan, asıl dosyası yazılı olmayan satırlar: aynı ödemenin yeni okunmuş hâline bağlanır
    for (const id of idler) for (const s of satirlar(id)) {
      if (s.satirDosya) continue;
      const k = satirAnahtari(s), t = tabanSahip.get(taban(s));
      if (t) { m.set(k, t); continue; }
      const o = m.get(k);
      if (!o || (!acik(o) && acik(id))) m.set(k, id);
    }
    sahipBellek.set(db.para, m);
    return m;
  };
  // ayar: { buro: [ad…] }. Dosyayı başka avukattan devraldıysanız e.devralma (YYYY-AA-GG) öncesindeki ödemeler hesaba girmez;
  // girilmemişse adınıza yapılan ilk ödemenin tarihi kabul edilir.
  UA.paraOzet = (db, elle, dosyaId, ayar) => {
    const sahip = UA.paraSahibi(db), buro = ayar?.buro || [];
    const baskasinin = (s) => { const o = sahip.get(satirAnahtari(s)); return !!o && o !== dosyaId; };
    const p = db.para[dosyaId] || { tahsilatlar: [], harclar: [], reddiyatlar: [] };
    const e = (elle && elle[dosyaId]) || {};
    const kat = p.icraMi || UA.normal(db.dosyalar[dosyaId]?.dosyaTur).includes('icra') ? 'İcra' : 'Mahkeme';
    const yansitMi = (s) => (e.uyapYansit || {})[s.kayitId] !== false;
    const ham = [...p.tahsilatlar, ...p.harclar].map((s) => ({ s, sinif: UA.paraSinif(s), kim: UA.odeyenKim(s, e, buro), baskaDosya: baskasinin(s) }));
    const ilkBizim = ham.filter((x) => x.kim === 'avukat' && !x.baskaDosya && x.s.tarih).map((x) => x.s.tarih.slice(0, 10)).sort()[0] || null;
    const devralma = e.devralma || null, sinir = devralma || ilkBizim;
    const uyapSatirlar = ham.map(({ s, sinif, kim, baskaDosya }) => {
      const once = !!(sinir && s.tarih && s.tarih.slice(0, 10) < sinir && (devralma || kim !== 'avukat'));
      const secim = e.satirSecimi?.[s.kayitId];
      const bizim = secim != null ? secim : sinif === 'masraf' && kim === 'avukat' && !baskaDosya && !once;
      return { ...s, kategori: kat, sinif, kim, baskaDosya, once, bizim, yansit: yansitMi(s) };
    });
    const bizim = uyapSatirlar.filter((s) => s.bizim);
    const topla = (l) => l.reduce((t, s) => t + (+s.tutar || 0), 0);
    const uyapOdeme = topla(bizim);
    const kendi = uyapSatirlar.filter((s) => !s.baskaDosya && !s.once);
    const muvekkilOdedi = topla(kendi.filter((s) => s.sinif === 'masraf' && s.kim === 'muvekkil'));
    const teminat = topla(kendi.filter((s) => s.sinif === 'teminat'));
    const borcTahsilati = topla(kendi.filter((s) => s.sinif === 'borc'));
    const iadeEdilebilir = bizim.filter((s) => s.tur === 'tahsilat').reduce((t, s) => t + (+s.kalan || 0), 0);
    const hareketler = e.hareketler || [];
    const top = (f) => hareketler.filter(f).reduce((t, h) => t + (+h.tutar || 0), 0);
    const avans = top((h) => h.tur === 'avans'), tahsilat = top((h) => h.tur === 'tahsilat'), iade = top((h) => h.tur === 'iade');
    const gider = top((h) => h.tur === 'gider');
    const yansitilan = topla(bizim.filter((s) => s.yansit)) + top((h) => h.tur === 'gider' && h.yansit !== false);
    const buroda = uyapOdeme + gider - yansitilan;
    const bakiye = avans + tahsilat - iade - yansitilan;
    const vekalet = +e.vekaletUcreti || 0;
    const hesapAcik = !!(hareketler.length || vekalet || e.hesapAcik);
    const belgesiz = hareketler.filter((h) => h.tur === 'gider' && !h.belge).length;
    const kategoriler = {};
    for (const s of bizim) kategoriler[s.kategori] = (kategoriler[s.kategori] || 0) + (+s.tutar || 0);
    for (const h of hareketler.filter((x) => x.tur === 'gider')) kategoriler[h.kategori || 'Diğer'] = (kategoriler[h.kategori || 'Diğer'] || 0) + (+h.tutar || 0);
    const reddiyat = topla((p.reddiyatlar || []).filter((s) => !baskasinin(s)));
    return {
      uyapSatirlar, uyapOdeme, iadeEdilebilir, avans, tahsilat, iade, gider, yansitilan, buroda, bakiye, vekalet, belgesiz, kategoriler, hareketler,
      muvekkilOdedi, teminat, borcTahsilati, reddiyat, hesapAcik, devralma, devralmaOtomatik: !devralma ? ilkBizim : null,
      onceki: topla(uyapSatirlar.filter((s) => s.once && !s.baskaDosya)),
      toplamMasraf: uyapOdeme + gider,
      kullanilabilir: hesapAcik ? Math.max(0, bakiye) : 0, bekleyen: hesapAcik ? Math.max(0, -bakiye) : 0,
      avansKaydiYok: !hesapAcik && yansitilan > 0 ? yansitilan : 0,
      kapanistaIstenecek: vekalet ? vekalet - bakiye : null, hareketVar: hesapAcik,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
