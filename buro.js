// Urikem Legal — büro (çok kullanıcılı) kuralları. Arayüzden bağımsız; panel ve testler kullanır.
//
// Model:
//  - Büroda kullanıcılar vardır; her kullanıcının bir ROLÜ olur (yönetici ortak, avukat, stajyer, sekreter, mali müşavir).
//  - Her rolün her MODÜLDE bir yetki SEVİYESİ olur: yok · görür · kendi dosyaları · tam.
//  - Her dosyanın bir SORUMLU avukatı ve bir EKİBİ olur. "Kendi dosyaları" = sorumlusu ya da ekibinde olduğu dosyalar.
//  - GİZLİ dosyayı yalnız sorumlusu, ekibi ve yönetici görür; yöneticinin her açışı kayıt geçmişine yazılır.
//  - Her avukatın eklentisi kendi UYAP'ını okur. Aynı dosya iki avukatın UYAP'ından gelirse kalıcı anahtarla
//    (mahkeme + dosya no) tek kayıtta birleşir; "kaynaklar" hangi avukatların UYAP'ında olduğunu tutar.
//  - Yapay zekâ ve arama, kullanıcının yetkisi dışındaki dosyaları hiç görmez: panel veriyi en başta kapsamla süzer.
(function (kok) {
  const UA = kok.UA || (kok.UA = {});

  const ROLLER = {
    ortak: { ad: 'Yönetici ortak', aciklama: 'Bütün dosyalar, kullanıcılar, yetkiler ve onaylar' },
    avukat: { ad: 'Avukat', aciklama: 'Sorumlusu ya da ekibinde olduğu dosyalar' },
    stajyer: { ad: 'Stajyer avukat', aciklama: 'Atandığı dosyalar; eşik üstü masraf onaya düşer' },
    sekreter: { ad: 'Sekreter', aciklama: 'Takvim ve evrak; gizli olmayan dosyaları görür, dilekçe yazamaz' },
    muhasebe: { ad: 'Mali müşavir', aciklama: 'Yalnız masraf ve avans hesaplarını görür, değiştiremez' },
  };
  const MODULLER = [
    { k: 'dosya', ad: 'Dosyalar, duruşmalar, evrak' },
    { k: 'muvekkil', ad: 'Müvekkiller ve başvurular' },
    { k: 'para', ad: 'Masraf ve avans' },
    { k: 'dilekce', ad: 'Dilekçe (yapay zekâ)' },
    { k: 'buro', ad: 'Büro yönetimi: kullanıcı, yetki, devir, onay' },
    { k: 'gecmis', ad: 'Kayıt geçmişi' },
  ];
  const SEVIYELER = [
    { k: 'yok', ad: 'Yok' },
    { k: 'gorur', ad: 'Görür' },
    { k: 'kendi', ad: 'Kendi dosyaları' },
    { k: 'tam', ad: 'Tam' },
  ];
  const VARSAYILAN = {
    ortak: { dosya: 'tam', muvekkil: 'tam', para: 'tam', dilekce: 'tam', buro: 'tam', gecmis: 'tam' },
    avukat: { dosya: 'kendi', muvekkil: 'kendi', para: 'kendi', dilekce: 'kendi', buro: 'yok', gecmis: 'kendi' },
    stajyer: { dosya: 'kendi', muvekkil: 'kendi', para: 'kendi', dilekce: 'kendi', buro: 'yok', gecmis: 'yok' },
    sekreter: { dosya: 'gorur', muvekkil: 'tam', para: 'tam', dilekce: 'yok', buro: 'yok', gecmis: 'yok' },
    muhasebe: { dosya: 'yok', muvekkil: 'gorur', para: 'gorur', dilekce: 'yok', buro: 'yok', gecmis: 'yok' },
  };
  const ONAY_VARSAYILAN = { ortak: false, avukat: false, stajyer: true, sekreter: true, muhasebe: true };

  const yetkilerBos = () => JSON.parse(JSON.stringify(VARSAYILAN));
  const kullanici = (buro, id) => (buro?.kullanicilar || []).find((k) => k.id === id) || null;
  // Bir kullanıcının bir modüldeki seviyesi. Yönetici ortağın yetkisi kısıtlanamaz.
  function seviye(buro, k, modul) {
    if (!k) return 'yok';
    if (k.rol === 'ortak') return 'tam';
    return ((buro?.yetkiler || VARSAYILAN)[k.rol] || {})[modul] || VARSAYILAN[k.rol]?.[modul] || 'yok';
  }
  const onayGerekir = (buro, k) => !!k && k.rol !== 'ortak' && ((buro?.onayRolleri || ONAY_VARSAYILAN)[k.rol] ?? ONAY_VARSAYILAN[k.rol]);
  const ekipte = (k, e) => !!k && !!e && (e.sorumluId === k.id || (e.ekip || []).includes(k.id));

  // Kullanıcı bu dosyayı görebilir mi?
  function dosyaGorur(buro, k, e) {
    if (!k) return false;
    if (k.rol === 'ortak') return true;
    if (e?.gizli && !ekipte(k, e)) return false;
    const s = seviye(buro, k, 'dosya');
    if (s === 'tam' || s === 'gorur') return true;
    if (s === 'kendi') return ekipte(k, e);
    // Dosya modülü kapalı ama masraf açıksa (mali müşavir gibi) masraf hesabı için dosya listesi gerekir
    const p = seviye(buro, k, 'para');
    return p === 'tam' || p === 'gorur' || (p === 'kendi' && ekipte(k, e));
  }
  // Kullanıcı bu dosyada bu modülde değişiklik yapabilir mi?
  function yazabilir(buro, k, modul, e) {
    const s = seviye(buro, k, modul);
    if (s === 'tam') return true;
    if (s === 'kendi') return ekipte(k, e);
    return false;
  }

  // Veriyi kullanıcının görebildiği dosyalarla süzer. Panelin geri kalanı (arama, yapay zekâ dahil) yalnız bunu görür.
  function kapsamla(db, elle, buro, k) {
    const izin = new Set(Object.keys(db.dosyalar || {}).filter((id) => dosyaGorur(buro, k, (elle.dosyalar || {})[id])));
    const suz = (o, f) => Object.fromEntries(Object.entries(o || {}).filter(([key, v]) => f(key, v)));
    return {
      ...db,
      dosyalar: suz(db.dosyalar, (id) => izin.has(id)),
      taraflar: suz(db.taraflar, (id) => izin.has(id)),
      para: suz(db.para, (id) => izin.has(id)),
      gorulen: suz(db.gorulen, (id) => izin.has(id)),
      durusmalar: suz(db.durusmalar, (_, v) => izin.has(v.dosyaId)),
      evraklar: suz(db.evraklar, (_, v) => izin.has(v.anaDosyaId || v.dosyaId)),
    };
  }

  // ---------- çıkar çatışması ----------
  // Ad karşılaştırması: büyük/küçük harf, noktalama ve şirket ekleri (Ltd. Şti., A.Ş., San. Tic.) yok sayılır.
  const EKLER = new Set(['ltd', 'şti', 'sti', 'a', 'ş', 'as', 'aş', 'san', 'tic', 've', 'anonim', 'şirketi', 'limited', 'şirket', 'sanayi', 'ticaret', 'inc', 'co']);
  const sozcukler = (s) => String(s || '').toLocaleLowerCase('tr').replace(/[.,;:()"'’\-/&]/g, ' ').split(/\s+/).filter((w) => w && !EKLER.has(w));
  function benzerlik(a, b) {
    const x = sozcukler(a), y = sozcukler(b);
    if (!x.length || !y.length) return 0;
    if (x.join(' ') === y.join(' ')) return 1;
    const [kisa, uzun] = x.length <= y.length ? [x, y] : [y, x];
    const ortak = kisa.filter((w) => uzun.includes(w)).length;
    // Tek sözcüklük adlarda (yalnız soyad gibi) yanlış alarm vermemek için en az iki sözcük ya da tam eşleşme
    if (kisa.length === 1) return 0;
    return ortak === kisa.length ? 0.9 : ortak / Math.max(kisa.length, 2) >= 0.75 ? 0.7 : 0;
  }
  // Büronun BÜTÜN dosyalarında (kullanıcının göremedikleri de dahil) adı arar. Sonuç, kullanıcı yetkisizse
  // dosya ayrıntısını değil yalnız "büroda bir dosyada karşı taraf" bilgisini ve sorumlu avukatı gösterecek kadar döner.
  function catismaAra(db, elle, ad, aranan = []) {
    const sonuc = [];
    const adlar = [ad, ...aranan].filter((x) => String(x || '').trim());
    for (const [id, taraflar] of Object.entries(db.taraflar || {})) {
      const e = (elle.dosyalar || {})[id] || {}, d = (db.dosyalar || {})[id] || {};
      for (const t of taraflar || []) {
        for (const a of adlar) {
          const b = benzerlik(a, t.adi);
          if (!b) continue;
          const muvekkil = UA.normal ? UA.normal(e.muvekkil) === UA.normal(t.adi) : e.muvekkil === t.adi;
          sonuc.push({ dosyaId: id, dosyaNo: d.dosyaNo, birim: d.birimAdi, taraf: t.adi, rol: t.rol, muvekkil, aranan: a, benzerlik: b, sorumluId: e.sorumluId, gizli: !!e.gizli, karsiVekil: !muvekkil ? t.vekil || '' : '' });
        }
      }
    }
    // Aynı dosya + taraf bir kez
    const gor = new Set();
    return sonuc.sort((x, y) => y.benzerlik - x.benzerlik).filter((r) => { const k = r.dosyaId + '|' + r.taraf; if (gor.has(k)) return false; gor.add(k); return true; });
  }
  // Kısa karar: çatışma (karşı tarafta geçiyor), mevcut müvekkil, ya da temiz
  function catismaKarar(sonuclar) {
    const karsi = sonuclar.filter((r) => !r.muvekkil), muv = sonuclar.filter((r) => r.muvekkil);
    if (karsi.length) return { durum: 'catisma', karsi, muv };
    if (muv.length) return { durum: 'muvekkil', karsi, muv };
    return { durum: 'temiz', karsi, muv };
  }

  // Başvuru kontrolü: başvuranı ve onun karşı taraflarını büronun bütün dosyalarında arar.
  //  - Başvuran büroda bir dosyada KARŞI TARAF ise: çatışma.
  //  - Başvuranın karşı tarafı büronun MÜVEKKİLİ ise: çatışma (en ağır durum).
  //  - Başvuran zaten müvekkilse ya da karşı tarafı başka dosyada da karşı tarafsa: bilgi.
  function basvuruKontrol(db, elle, ad, karsilar = []) {
    const satirlar = [];
    for (const r of catismaAra(db, elle, ad)) satirlar.push({ ...r, tip: r.muvekkil ? 'bilgi' : 'catisma', kim: 'basvuran' });
    for (const k of karsilar.filter((x) => String(x || '').trim())) for (const r of catismaAra(db, elle, k)) satirlar.push({ ...r, tip: r.muvekkil ? 'catisma' : 'bilgi', kim: 'karsi' });
    const durum = satirlar.some((x) => x.tip === 'catisma') ? 'catisma' : satirlar.length ? 'bilgi' : 'temiz';
    return { durum, satirlar };
  }

  UA.buro = { basvuruKontrol, ROLLER, MODULLER, SEVIYELER, VARSAYILAN, ONAY_VARSAYILAN, yetkilerBos, kullanici, seviye, onayGerekir, ekipte, dosyaGorur, yazabilir, kapsamla, benzerlik, catismaAra, catismaKarar };
})(typeof window !== 'undefined' ? window : globalThis);
