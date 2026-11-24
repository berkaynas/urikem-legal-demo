// Avukat Asistanı — DEMO verisi. Tüm kişi, şirket, dosya numarası ve tutarlar UYDURMADIR.
// Veri, UYAP cevaplarıyla aynı biçimde üretilip gerçek işleme hattından (UA.isle) geçirilir.
(function (kok) {
  const UA = kok.UA;

  UA.demoOlustur = (bugun = new Date()) => {
    const b = UA.gun(bugun);
    const ekle = (n) => { const d = new Date(b); d.setDate(d.getDate() + n); return d; };
    const isGunu = (n) => { const d = ekle(n); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return d; };
    const p2 = (x) => String(x).padStart(2, '0');
    const slash = (d) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
    const nokta = (d, s = '10:00') => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${s}:00`;
    const isoSaat = (d, s) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${s}:00.0`;
    const acilis = (d) => ({ date: { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }, time: { hour: 9, minute: 0, second: 0, nano: 0 } });

    // Büro: altı kullanıcı. Dosyalar sorumlu avukatlara dağıtılmış; "kaynak" = dosyanın UYAP'ında göründüğü avukatlar.
    const KUL = {
      'u-1': 'Av. Deniz Demo', 'u-2': 'Av. Kaan Taslak', 'u-3': 'Av. Elif Model',
      'u-4': 'Stj. Av. Mert Deneme', 'u-5': 'Ayşe Prova', 'u-6': 'Murat Misal',
    };
    const D = [
      { id: 'demo-1', no: '2025/412', birim: 'İstanbul Anadolu 7. Asliye Hukuk Mahkemesi', tur: 'Hukuk Dava Dosyası', muv: 'Örnek Lojistik Ltd. Şti.', karsi: 'Deneme İnşaat A.Ş.', rol: 'Davacı', ac: -210, av: 'u-1', ekip: ['u-4'], kaynak: ['u-1'] },
      { id: 'demo-2', no: '2025/988', birim: 'İstanbul 14. Asliye Ticaret Mahkemesi', tur: 'Hukuk Dava Dosyası', muv: 'Mehmet Örnekoğlu', karsi: 'Kurgu Yazılım A.Ş.', rol: 'Davacı', ac: -150, av: 'u-2', ekip: ['u-4'], kaynak: ['u-2'] },
      { id: 'demo-3', no: '2026/155', birim: 'Kadıköy 3. Sulh Hukuk Mahkemesi', tur: 'Hukuk Dava Dosyası', muv: 'Zeynep Kurgu', karsi: 'Ali Varsayım', rol: 'Davalı', ac: -60, av: 'u-3', ekip: [], kaynak: ['u-3'] },
      { id: 'demo-4', no: '2026/77', birim: 'İstanbul 21. İş Mahkemesi', tur: 'Hukuk Dava Dosyası', muv: 'Hasan Temsili', karsi: 'Hayali Tekstil San. A.Ş.', rol: 'Davacı', ac: -95, av: 'u-2', ekip: [], kaynak: ['u-2'] },
      { id: 'demo-5', no: '2024/1203', birim: 'Ankara Batı 2. Asliye Hukuk Mahkemesi', tur: 'Hukuk Dava Dosyası', muv: 'Ece Varsayım', karsi: 'Örnek Sigorta A.Ş.', rol: 'Davacı', ac: -420, av: 'u-1', ekip: ['u-2'], kaynak: ['u-1', 'u-2'] },
      { id: 'demo-6', no: '2026/301', birim: 'İstanbul 9. Aile Mahkemesi', tur: 'Hukuk Dava Dosyası', muv: 'Selin Hayali', karsi: 'Kerem Hayali', rol: 'Davacı', ac: -40, av: 'u-3', ekip: [], kaynak: ['u-3'], gizli: true },
      { id: 'demo-7', no: '2026/4410', birim: 'İstanbul Anadolu 12. İcra Dairesi', tur: 'İcra Dosyası', muv: 'Örnek Lojistik Ltd. Şti.', karsi: 'Kurgu Gıda Ltd. Şti.', rol: 'Alacaklı', ac: -35, av: 'u-2', ekip: ['u-4'], kaynak: ['u-2'] },
      { id: 'demo-8', no: '2025/8812', birim: 'İstanbul 33. İcra Dairesi', tur: 'İcra Dosyası', muv: 'Mehmet Örnekoğlu', karsi: 'Deneme Ticaret Ltd. Şti.', rol: 'Alacaklı', ac: -180, av: 'u-3', ekip: [], kaynak: ['u-3'] },
      { id: 'demo-9', no: '2026/512', birim: 'İstanbul 5. Tüketici Mahkemesi', tur: 'Hukuk Dava Dosyası', muv: 'Burak Numune', karsi: 'Örnek Elektronik A.Ş.', rol: 'Davacı', ac: -25, av: 'u-3', ekip: [], kaynak: ['u-3'] },
      { id: 'demo-10', no: '2026/233', birim: 'İstanbul Anadolu 4. İş Mahkemesi', tur: 'Hukuk Dava Dosyası', muv: 'Örnek Lojistik Ltd. Şti.', karsi: 'Cem Sanal', rol: 'Davalı', ac: -70, av: 'u-2', ekip: [], kaynak: ['u-2'] },
    ];
    const AVUKAT = KUL['u-1'];
    const AV = Object.fromEntries(D.map((d) => [d.id, KUL[d.av]]));
    const VEKIL = Object.fromEntries(D.map((d) => [d.id, d.kaynak.map((k) => KUL[k]).join(', ')]));

    const db = UA.bos();
    const t0 = ekle(-7).toISOString(); // ilk senkron bir hafta önce
    const t1 = new Date().toISOString(); // bugünkü senkron

    // 1) Dosya listesi (Dosya Sorgula)
    UA.isle(db, '/search_phrase_detayli.ajx', '', [D.map((d) => ({
      dosyaId: d.id, dosyaNo: d.no, dosyaDurumKod: 0, dosyaDurum: 'Açık', dosyaTurKod: d.tur.startsWith('İcra') ? 35 : 1, dosyaTur: d.tur,
      dosyaAcilisTarihi: acilis(ekle(d.ac)), birimAdi: d.birim, isNew: false,
    }))], t0);

    // 2) Taraflar
    for (const d of D) UA.isle(db, '/dosya_taraf_bilgileri_brd.ajx', `dosyaId=${d.id}`, [
      { adi: d.muv, rol: d.rol, vekil: VEKIL[d.id], kisiKurum: /A\.Ş\.|Ltd/.test(d.muv) ? 'Kurum' : 'Kişi' },
      { adi: d.karsi, rol: { Davacı: 'Davalı', Davalı: 'Davacı', Alacaklı: 'Borçlu' }[d.rol], vekil: d.id === 'demo-2' ? 'Av. Kurgu Hukuk Bürosu' : '', kisiKurum: /A\.Ş\.|Ltd/.test(d.karsi) ? 'Kurum' : 'Kişi' },
    ], t0);

    // İcra ayrıntısı
    UA.isle(db, '/dosyaAyrintiBilgileri_brd.ajx', 'dosyaId=demo-7', {
      id: 'demo-7', dosyaNo: '2026/4410', birimAdi: D[6].birim, dosyaDurumu: 'Açık', takibinTuruAciklama: 'İlamsız Takip',
      takibinYoluAciklama: 'Genel Haciz Yoluyla Takip', alacakKalemToplamTutar: 184500, alacakKalemFaizTutar: 6210.4,
      takipSonrasiMasraf: 1480, vekaletUcreti: 27675, tahsilHarci: 0, yapilmisBorcTahsilati: 40000,
    }, t0);

    // 3) Evraklar: önce bir hafta önceki hâli, sonra bugün gelenler
    let sayac = 1000;
    const evrak = (dosya, gunOnce, tur, aciklama, gonderen) => ({
      evrakId: `ev-${++sayac}`, dosyaId: dosya, ggEvrakId: '', birimEvrakNo: sayac, tur, tip: tur, aciklama,
      onaylandigiTarih: slash(ekle(-gunOnce)), sistemeGonderildigiTarih: slash(ekle(-gunOnce)), gonderenYerKisi: gonderen || '', ekEvrakListesi: [],
    });
    const eski = {
      'demo-1': [evrak('demo-1', 200, 'Dava Dilekçesi', 'Dava dilekçesi', AV['demo-1']), evrak('demo-1', 170, 'Cevap Dilekçesi', 'Davalı cevap dilekçesi'), evrak('demo-1', 120, 'Tensip Zaptı', 'Tensip tutanağı'), evrak('demo-1', 60, 'Ara Karar', 'Bilirkişi incelemesine karar verildi')],
      'demo-2': [evrak('demo-2', 140, 'Dava Dilekçesi', 'Dava dilekçesi', AV['demo-2']), evrak('demo-2', 90, 'Ön İnceleme Tutanağı', 'Ön inceleme duruşma zaptı')],
      'demo-3': [evrak('demo-3', 55, 'Dava Dilekçesi', 'Tahliye talepli dava dilekçesi'), evrak('demo-3', 30, 'Cevap Dilekçesi', 'Cevap dilekçesi', AV['demo-3'])],
      'demo-4': [evrak('demo-4', 90, 'Dava Dilekçesi', 'İşçilik alacakları', AV['demo-4']), evrak('demo-4', 20, 'Bilirkişi Raporu', 'Hesap bilirkişisi raporu')],
      'demo-5': [evrak('demo-5', 400, 'Dava Dilekçesi', 'Tazminat davası', AV['demo-5']), evrak('demo-5', 35, 'Duruşma Zaptı', 'Duruşma tutanağı')],
      'demo-6': [evrak('demo-6', 38, 'Dava Dilekçesi', 'Anlaşmalı boşanma', AV['demo-6'])],
      'demo-7': [evrak('demo-7', 34, 'Takip Talebi', 'İlamsız takip talebi', AV['demo-7']), evrak('demo-7', 33, 'Ödeme Emri', 'Örnek 7 ödeme emri'), evrak('demo-7', 12, 'Tahsilat Makbuzu', 'Borçlu kısmi ödeme')],
      'demo-9': [evrak('demo-9', 24, 'Dava Dilekçesi', 'Ayıplı mal — bedel iadesi', AV['demo-9']), evrak('demo-9', 10, 'Tensip Zaptı', 'Tensip tutanağı')],
      'demo-10': [evrak('demo-10', 70, 'Dava Dilekçesi', 'Davacı işçinin işe iade ve alacak talebi'), evrak('demo-10', 45, 'Cevap Dilekçesi', 'Cevap dilekçesi', AV['demo-10']), evrak('demo-10', 8, 'Ara Karar', 'Tanıkların dinlenmesine karar verildi')],
      'demo-8': [evrak('demo-8', 175, 'Takip Talebi', 'Kambiyo takibi', AV['demo-8']), evrak('demo-8', 60, 'Haciz Tutanağı', 'Menkul haczi')],
    };
    for (const [id, l] of Object.entries(eski)) UA.isle(db, '/list_dosya_evraklar.ajx', `dosyaId=${id}&pageNumber=1`, { tumEvraklar: { [`${id}`]: l }, son20Evrak: [], pageTotal: 1, status: 1 }, t0);

    const yeni = {
      'demo-1': [evrak('demo-1', 4, 'Bilirkişi Raporu', 'İnşaat mühendisi bilirkişi raporu'), evrak('demo-1', 1, 'E-Tebliğ Mazbatası', 'Bilirkişi raporu tebliği — okundu sayıldı')],
      'demo-2': [evrak('demo-2', 6, 'Ara Karar', 'Tanık listesinin sunulması için kesin süre'), evrak('demo-2', 3, 'Tebliğ Mazbatası', 'Ara karar tebliği (PTT)')],
      'demo-4': [evrak('demo-4', 2, 'Tahsilat Makbuzu', 'Bilirkişi ücreti avansı')],
      'demo-7': [evrak('demo-7', 2, 'Tebliğ Mazbatası', 'Ödeme emri tebliği — bizzat')],
    };
    for (const [id, l] of Object.entries(yeni)) UA.isle(db, '/list_dosya_evraklar.ajx', `dosyaId=${id}&pageNumber=1`, { tumEvraklar: { [`${id}`]: [...eski[id], ...l] }, son20Evrak: [], pageTotal: 1, status: 1 }, t1);

    // 4) Duruşmalar (sonraki 30 gün)
    const dur = (d, gun, saat, islem) => ({
      kayitId: `dr-${d.id}`, dosyaId: d.id, dosyaNo: d.no, dosyaTurKod: 1, dosyaTurKodAciklama: d.tur, yerelBirimAd: d.birim,
      tarihSaat: isoSaat(isGunu(gun), saat), islemTuru: 1, islemSonucu: 0, islemTuruAciklama: islem, islemSonucuAciklama: 'Bekleniyor',
      dosyaTaraflari: [{ isim: d.muv, soyad: '', sifat: d.rol, isVekil: false }, { isim: d.karsi, soyad: '', sifat: 'Karşı taraf', isVekil: false }],
    });
    UA.isle(db, '/avukat_durusma_sorgula_brd.ajx', '', [
      dur(D[0], 2, '10:30', 'Tahkikat Duruşması'), dur(D[1], 6, '14:00', 'Tahkikat Duruşması'), dur(D[3], 9, '11:15', 'Tahkikat Duruşması'),
      dur(D[2], 16, '09:40', 'Ön İnceleme Duruşması'), dur(D[5], 23, '13:20', 'Duruşma'),
      dur(D[9], 3, '10:00', 'Tahkikat Duruşması'), dur(D[8], 12, '11:30', 'Ön İnceleme Duruşması'),
    ], t1);

    // 5) Tahsilat / harç (UYAP'ın Tah./Red. sekmesi)
    let mk = 480000;
    const h = (ad, miktar, odeyen, gunOnce) => ({ makbuzNo: String(++mk), dosyaNo: '', birimAdi: '', odeyenKisi: odeyen, tahsilatTuru: ad, tahsilatTarihi: nokta(ekle(-gunOnce)), miktar });
    const t = (ad, tutar, kalan, odeyen, gunOnce) => ({ makbuzNo: String(++mk), dosyaNo: '', birimAdi: '', odeyenKisi: odeyen, tahsilatTuru: ad, tahsilatTarihi: nokta(ekle(-gunOnce)), tahsilatTutari: tutar, kalanMiktar: kalan, kayitId: mk });
    const para = (id, harcList, tahsilatList) => UA.isle(db, '/dosya_tahsilat_reddiyat_bilgileri_brd.ajx', `dosyaId=${id}&dosyaTurKod=1`, {
      harcList, tahsilatList, reddiyatList: [], toplamTahsilat: tahsilatList.reduce((a, r) => a + r.tahsilatTutari, 0), toplamreddiyat: 0, haricen: 0,
      toplamTeminat: 0, toplamTahsilHarci: harcList.reduce((a, r) => a + r.miktar, 0), toplamKalan: tahsilatList.reduce((a, r) => a + r.kalanMiktar, 0), isIcraMi: id === 'demo-7' || id === 'demo-8',
    }, t1);
    para('demo-1', [h('Başvurma Harcı', 732, 'Örnek Lojistik Ltd. Şti. Vekili ' + AV['demo-1'], 200), h('Peşin Harç', 4250, 'Örnek Lojistik Ltd. Şti. Vekili ' + AV['demo-1'], 200)],
      [t('Gider Avansı', 2380, 1140, 'Örnek Lojistik Ltd. Şti. Vekili ' + AV['demo-1'], 200), t('Bilirkişi Ücreti', 3600, 0, 'Örnek Lojistik Ltd. Şti.', 58), t('Gider Avansı', 1900, 1900, 'Deneme İnşaat A.Ş.', 165)]);
    para('demo-2', [h('Başvurma Harcı', 732, 'Mehmet Örnekoğlu Vekili ' + AV['demo-2'], 140), h('Peşin Harç', 6800, 'Mehmet Örnekoğlu Vekili ' + AV['demo-2'], 140)],
      [t('Gider Avansı', 2380, 1620, 'Mehmet Örnekoğlu Vekili ' + AV['demo-2'], 140)]);
    para('demo-4', [h('Başvurma Harcı', 732, 'Hasan Temsili Vekili ' + AV['demo-4'], 90)],
      [t('Gider Avansı', 1830, 900, 'Hasan Temsili Vekili ' + AV['demo-4'], 90), t('Bilirkişi Ücreti', 3600, 3600, 'Hasan Temsili Vekili ' + AV['demo-4'], 2)]);
    para('demo-7', [h('Peşin Harç', 922.5, 'Örnek Lojistik Ltd. Şti. Vekili ' + AV['demo-7'], 34), h('Başvurma Harcı', 732, 'Örnek Lojistik Ltd. Şti. Vekili ' + AV['demo-7'], 34)],
      [t('Posta Masrafı', 480, 0, 'Örnek Lojistik Ltd. Şti. Vekili ' + AV['demo-7'], 33), t('Borçlu Ödemesi', 40000, 40000, 'Kurgu Gıda Ltd. Şti.', 12)]);

    // 6) Bildirimler
    UA.isle(db, '/get_kullanici_bildirimleri.ajx', '', [
      { bildirimId: 1, mesajId: 1, baslik: 'Duruşma', mesaj: 'Yaklaşan duruşmanız var.', gonderilmeTarihi: nokta(ekle(-1)), okunduMu: false },
    ], t1);

    // Demo kayıtları okunaklı kimliklerle (demo-1…) dursun: kalıcı anahtarları demo kimliğine çevir
    const ad = {}; for (const d of Object.values(db.dosyalar)) ad[d.dosyaId] = d.uyapId || d.dosyaId;
    const yeniAd = (k) => ad[k] || k;
    db.dosyalar = Object.fromEntries(Object.values(db.dosyalar).map((d) => [yeniAd(d.dosyaId), { ...d, dosyaId: yeniAd(d.dosyaId) }]));
    for (const alan of ['taraflar', 'para', 'gorulen']) db[alan] = Object.fromEntries(Object.entries(db[alan] || {}).map(([k, v]) => [yeniAd(k), v]));
    for (const e of Object.values(db.evraklar)) e.anaDosyaId = yeniAd(e.anaDosyaId);
    for (const r of Object.values(db.durusmalar)) r.dosyaId = yeniAd(r.dosyaId);
    db.kimlik = Object.fromEntries(Object.keys(db.dosyalar).map((k) => [k, k]));

    // 7) Avukatın kendi girdikleri: müvekkil kartları, masraf, avans, tahsilat, paylaşım
    const elle = { dosyalar: {}, sureler: {}, okundu: {}, muvekkiller: {}, gorusmeler: [], kronoloji: {}, ayarlar: {} };
    const MUV = {
      'Örnek Lojistik Ltd. Şti.': { tur: 'Kurum', yetkili: 'Selim Örnek (genel müdür)', telefon: '0212 000 00 11', eposta: 'hukuk@orneklojistik.test', vergiNo: '000 000 00 11' },
      'Mehmet Örnekoğlu': { tur: 'Kişi', telefon: '0532 000 00 12', eposta: 'mehmet@ornekoglu.test' },
      'Zeynep Kurgu': { tur: 'Kişi', telefon: '0533 000 00 13', eposta: 'zeynep@kurgu.test' },
      'Hasan Temsili': { tur: 'Kişi', telefon: '0534 000 00 14', eposta: 'hasan@temsili.test' },
      'Ece Varsayım': { tur: 'Kişi', telefon: '0535 000 00 15', eposta: 'ece@varsayim.test' },
      'Selin Hayali': { tur: 'Kişi', telefon: '0536 000 00 16', eposta: 'selin@hayali.test' },
      'Burak Numune': { tur: 'Kişi', telefon: '0537 000 00 17', eposta: 'burak@numune.test' },
    };
    let mn = 0;
    for (const [ad, v] of Object.entries(MUV)) elle.muvekkiller[`m-${++mn}`] = { id: `m-${mn}`, ad, ...v, kayit: UA.iso(ekle(-400 + mn * 30)) };
    const muvId = (ad) => Object.values(elle.muvekkiller).find((m) => m.ad === ad).id;
    for (const d of D) elle.dosyalar[d.id] = { muvekkil: d.muv, muvekkilId: muvId(d.muv), bizimAdlar: d.kaynak.map((k) => KUL[k]), hareketler: [], sorumlu: KUL[d.av], sorumluId: d.av, ekip: d.ekip, kaynaklar: d.kaynak, gizli: !!d.gizli, paylas: false };
    let hn = 0;
    const hr = (id, tur, gunOnce, aciklama, tutar, ek = {}) => elle.dosyalar[id].hareketler.push({ id: `h-${++hn}`, tur, tarih: UA.iso(ekle(-gunOnce)), aciklama, tutar, ...ek });
    hr('demo-1', 'avans', 205, 'Masraf avansı (banka havalesi)', 15000, { odemeYontemi: 'Havale', belge: { ad: 'havale-dekontu.pdf' } });
    hr('demo-1', 'gider', 190, 'İhtarname', 1240, { kategori: 'Noter / resmî kurum', odeyen: AV['demo-1'], odemeYontemi: 'Kredi kartı', belge: { ad: 'noter-makbuzu.pdf' } });
    hr('demo-1', 'gider', 58, 'Bilirkişi incelemesi için yol', 640, { kategori: 'Ulaşım', odeyen: AV['demo-1'], odemeYontemi: 'Nakit', yansit: false });
    elle.dosyalar['demo-1'].vekaletUcreti = 45000; elle.dosyalar['demo-1'].paylas = true;
    hr('demo-2', 'avans', 145, 'Masraf avansı', 5000, { odemeYontemi: 'Havale', belge: { ad: 'dekont.pdf' } });
    hr('demo-2', 'tahsilat', 20, 'Eksik masrafın bir kısmı', 2500, { odemeYontemi: 'Havale' });
    hr('demo-2', 'gider', 12, 'Tapu kaydı', 850, { kategori: 'Noter / resmî kurum', odeyen: AV['demo-2'], odemeYontemi: 'Nakit' });
    elle.dosyalar['demo-2'].vekaletUcreti = 60000; elle.dosyalar['demo-2'].paylas = true;
    hr('demo-4', 'avans', 92, 'Masraf avansı', 10000, { odemeYontemi: 'Havale', belge: { ad: 'dekont.pdf' } });
    hr('demo-4', 'gider', 40, 'SGK hizmet dökümü', 350, { kategori: 'Noter / resmî kurum', odeyen: AV['demo-4'], odemeYontemi: 'Kredi kartı' });
    elle.dosyalar['demo-4'].vekaletUcreti = 30000;
    hr('demo-7', 'avans', 35, 'Takip masrafı', 3000, { odemeYontemi: 'Havale', belge: { ad: 'dekont.pdf' } });
    elle.dosyalar['demo-7'].vekaletUcreti = 27675; elle.dosyalar['demo-7'].paylas = true;
    hr('demo-3', 'avans', 50, 'Masraf avansı', 4000, { odemeYontemi: 'Nakit', belge: { ad: 'tahsilat-makbuzu.pdf' } });
    hr('demo-3', 'gider', 48, 'Vekâletname', 1450, { kategori: 'Noter / resmî kurum', odeyen: AV['demo-3'], odemeYontemi: 'Kredi kartı', belge: { ad: 'noter.pdf' } });
    hr('demo-3', 'iade', 5, 'Kullanılmayan avans iadesi', 500, { odemeYontemi: 'Havale' });
    elle.dosyalar['demo-3'].vekaletUcreti = 25000;
    hr('demo-6', 'avans', 30, 'Masraf avansı', 3000, { odemeYontemi: 'Havale' });
    elle.dosyalar['demo-6'].vekaletUcreti = 35000;

    // Süreler: avukat son günü kendisi girdi. Biri doğru, biri 3 gün geç girilmiş: asistan yakalıyor.
    const evrakBul = (dosya, tur) => Object.values(db.evraklar).find((e) => e.anaDosyaId === dosya && e.tur === tur && e.yeni);
    const e1 = evrakBul('demo-1', 'E-Tebliğ Mazbatası');
    const s1 = { birim: 'hafta', miktar: 2 };
    const k1 = UA.sureKontrol(UA.iso(ekle(-1)), s1, UA.iso(ekle(13)), true);
    elle.sureler[e1.evrakId] = { tebligTarihi: UA.iso(ekle(-1)), sure: s1, tabi: true, sonGun: k1.hesaplanan, aciklama: 'Bilirkişi raporuna itiraz' };
    const e2 = evrakBul('demo-2', 'Tebliğ Mazbatası');
    const s2 = { birim: 'hafta', miktar: 1 };
    const k2 = UA.sureKontrol(UA.iso(ekle(-3)), s2, UA.iso(ekle(4)), true);
    const hatali = UA.tarihCoz(k2.hesaplanan); hatali.setDate(hatali.getDate() + 3);
    elle.sureler[e2.evrakId] = { tebligTarihi: UA.iso(ekle(-3)), sure: s2, tabi: true, sonGun: UA.iso(hatali), aciklama: 'Tanık listesi (kesin süre)' };

    // 8) Görüşmeler: biri işlenmiş (kronolojide), biri yeni kaydedilmiş, özet bekliyor
    elle.kronoloji['m-1'] = [
      { id: 'k-1', tarih: UA.iso(ekle(-230)), olay: 'Davalı ile 3 depo için kira ve hizmet sözleşmesi imzalandı.', kaynak: 'Görüşme · ' + UA.trTarih(ekle(-206)) },
      { id: 'k-2', tarih: UA.iso(ekle(-215)), olay: 'Davalının inşaat işleri depo çatısında hasara yol açtı; fotoğraflar müvekkilde.', kaynak: 'Görüşme · ' + UA.trTarih(ekle(-206)) },
      { id: 'k-3', tarih: UA.iso(ekle(-205)), olay: 'Noter ihtarnamesi gönderildi.', kaynak: 'Masraf kaydı · noter makbuzu' },
      { id: 'k-4', tarih: UA.iso(ekle(-200)), olay: 'Dava açıldı.', kaynak: 'UYAP · dava dilekçesi' },
    ];
    elle.gorusmeler.push({
      id: 'g-1', muvekkilId: 'm-3', dosyaId: 'demo-3', tarih: UA.iso(ekle(-1)), sure: '18 dk', riza: { alindi: true, zaman: UA.trTarih(ekle(-1)) + ' 15:02', yontem: 'Sözlü onay kayda alındı + yazılı onay formu' }, durum: 'transkript',
      transkript: [
        ['Avukat', 'Kayda başlamadan önce sorayım: bu görüşmenin kaydedilmesine ve yazıya dökülmesine onay veriyor musunuz?'],
        ['Zeynep Kurgu', 'Evet, onay veriyorum.'],
        ['Avukat', 'Teşekkürler. Ev sahibinizle ilk sorun ne zaman başladı?'],
        ['Zeynep Kurgu', 'Mart ayında kirayı yüzde altmış artırmak istedi. Ben yasal oran kadar artış yaptım, kalanını ödemedim.'],
        ['Avukat', 'Ödemeleri nasıl yapıyorsunuz?'],
        ['Zeynep Kurgu', 'Her ay banka havalesiyle, açıklamaya "kira" yazarak. Dekontların hepsi bende.'],
        ['Avukat', 'Size bir ihtarname geldi mi?'],
        ['Zeynep Kurgu', 'Mayısın ortasında noterden ihtarname geldi, otuz gün içinde evi boşaltmamı istiyordu.'],
        ['Avukat', 'Evde başka bir sorun var mı?'],
        ['Zeynep Kurgu', 'Kombi ekim ayında bozuldu. Ev sahibine mesaj attım, hâlâ yaptırmadı. Mesajlar telefonumda duruyor.'],
        ['Avukat', 'Tamam. Dekontları ve mesajların ekran görüntülerini bu hafta bana gönderebilir misiniz?'],
        ['Zeynep Kurgu', 'Cuma gününe kadar gönderirim.'],
      ],
      ozet: {
        kisiler: ['Zeynep Kurgu (müvekkil, kiracı)', 'Ali Varsayım (ev sahibi, davacı)'],
        olaylar: [
          { tarih: `${b.getFullYear()}-03-01`, olay: 'Ev sahibi kirayı %60 artırmak istedi; müvekkil yasal oran kadar artış yaptı.' },
          { tarih: `${b.getFullYear()}-05-15`, olay: 'Noterden 30 gün içinde tahliye ihtarnamesi geldi.' },
          { tarih: `${b.getFullYear()}-10-01`, olay: 'Kombi bozuldu; ev sahibine mesajla bildirildi, onarılmadı.' },
        ],
        talepler: ['Tahliye talebinin reddi', 'Kombi arızası nedeniyle ayıp bildirimi değerlendirilecek'],
        beyanlar: ['Kira her ay havaleyle, "kira" açıklamasıyla ödendi; dekontlar müvekkilde.', 'Ev sahibine yazılı (mesaj) bildirim yapıldı.'],
        isler: [{ is: 'Müvekkil kira dekontlarını ve mesaj ekran görüntülerini gönderecek', son: UA.iso(isGunu(5)) }, { is: 'İhtarnamenin tebliğ tarihi kontrol edilecek', son: UA.iso(isGunu(3)) }],
      },
    });

    elle.ayarlar = { eposta: 'avukat@demo-hukuk.test', ortakEposta: 'ortak@demo-hukuk.test', saat: '08:00', kademeler: [7, 3, 1], gunlukOzet: true, ortagaBildir: true, buro: Object.values(KUL) };

    // 9) Büro: kullanıcılar, yetkiler, onay bekleyen masraflar, başvurular (CRM), görevler, kayıt geçmişi
    const saatOnce = (n) => new Date(Date.now() - n * 36e5).toISOString();
    const getirdi = (u) => D.filter((d) => d.kaynak.includes(u)).length;
    const B = UA.buro; // buro.js yüklenmemişse (eski testler) büro kısmı atlanır
    if (B) elle.buro = {
      ad: 'Demo Hukuk Bürosu', esik: 2500,
      yetkiler: B.yetkilerBos(), onayRolleri: { ...B.ONAY_VARSAYILAN },
      kullanicilar: [
        { id: 'u-1', ad: KUL['u-1'], rol: 'ortak', eposta: 'deniz@demo-hukuk.test', unvan: 'Kurucu ortak', uyap: { son: saatOnce(2), dosya: getirdi('u-1') }, katilma: UA.iso(ekle(-900)) },
        { id: 'u-2', ad: KUL['u-2'], rol: 'avukat', eposta: 'kaan@demo-hukuk.test', unvan: 'Kıdemli avukat', uyap: { son: saatOnce(3), dosya: getirdi('u-2') }, katilma: UA.iso(ekle(-600)) },
        { id: 'u-3', ad: KUL['u-3'], rol: 'avukat', eposta: 'elif@demo-hukuk.test', unvan: 'Avukat', uyap: { son: saatOnce(26), dosya: getirdi('u-3') }, katilma: UA.iso(ekle(-6)) },
        { id: 'u-4', ad: KUL['u-4'], rol: 'stajyer', eposta: 'mert@demo-hukuk.test', unvan: 'Stajyer avukat', uyap: null, katilma: UA.iso(ekle(-120)) },
        { id: 'u-5', ad: KUL['u-5'], rol: 'sekreter', eposta: 'ayse@demo-hukuk.test', unvan: 'Büro sorumlusu', uyap: null, katilma: UA.iso(ekle(-700)) },
        { id: 'u-6', ad: KUL['u-6'], rol: 'muhasebe', eposta: 'muhasebe@demo-hukuk.test', unvan: 'Mali müşavir (dış)', uyap: null, katilma: UA.iso(ekle(-300)) },
      ],
      onaylar: [
        { id: 'o-1', dosyaId: 'demo-2', isteyenId: 'u-4', zaman: saatOnce(20), durum: 'bekliyor', hareket: { tur: 'gider', kategori: 'Mahkeme', tarih: UA.iso(ekle(-1)), aciklama: 'Ek bilirkişi raporu ücreti', tutar: 3200, odeyen: KUL['u-4'], odemeYontemi: 'Kredi kartı', yansit: true, belge: { ad: 'bilirkisi-makbuz.pdf' } } },
        { id: 'o-2', dosyaId: 'demo-7', isteyenId: 'u-5', zaman: saatOnce(6), durum: 'bekliyor', hareket: { tur: 'gider', kategori: 'Diğer', tarih: UA.iso(ekle(0)), aciklama: 'Haciz için çilingir ve nakliye', tutar: 2800, odeyen: KUL['u-5'], odemeYontemi: 'Nakit', yansit: true } },
      ],
      basvurular: [
        { id: 'b-1', ad: 'Kurgu Yazılım A.Ş.', tur: 'Kurum', konu: 'Eski çalışanına karşı alacak davası', kaynak: 'Web sitesi formu', tarih: UA.iso(ekle(-1)), asama: 'yeni', atananId: null, telefon: '0216 000 00 21', karsi: ['Onur Tasarı'] },
        { id: 'b-2', ad: 'Cem Sanal', tur: 'Kişi', konu: 'Kıdem ve ihbar tazminatı', kaynak: 'Telefon', tarih: UA.iso(ekle(0)), asama: 'yeni', atananId: null, telefon: '0538 000 00 22', karsi: ['Örnek Lojistik Ltd. Şti.'] },
        { id: 'b-3', ad: 'Gökhan Farazi', tur: 'Kişi', konu: 'Kira tespit davası', kaynak: 'Müvekkil tavsiyesi', tarih: UA.iso(ekle(-6)), asama: 'gorusme', atananId: 'u-3', karsi: ['Prototip Gayrimenkul A.Ş.'], not: 'İlk görüşme yapıldı; kira sözleşmesi ve dekontlar istendi.' },
        { id: 'b-4', ad: 'Prototip Turizm Ltd. Şti.', tur: 'Kurum', konu: 'Acente sözleşmesi incelemesi ve ihtarname', kaynak: 'Mevcut müvekkil tavsiyesi', tarih: UA.iso(ekle(-10)), asama: 'teklif', atananId: 'u-1', teklif: 20000, karsi: [] },
        { id: 'b-5', ad: 'Burak Numune', tur: 'Kişi', konu: 'Ayıplı mal: bedel iadesi', kaynak: 'Web sitesi formu', tarih: UA.iso(ekle(-32)), asama: 'kazanildi', atananId: 'u-3', teklif: 15000, dosyaId: 'demo-9', karsi: ['Örnek Elektronik A.Ş.'] },
        { id: 'b-6', ad: 'Sena Kurmaca', tur: 'Kişi', konu: 'Trafik kazası tazminatı', kaynak: 'Telefon', tarih: UA.iso(ekle(-20)), asama: 'kaybedildi', atananId: 'u-2', teklif: 40000, neden: 'Ücrette anlaşılamadı', karsi: [] },
      ],
    };
    elle.isler = [
      { id: 'is-1', is: 'Bilirkişi raporuna itiraz dilekçesinin taslağı', son: UA.iso(isGunu(4)), dosyaId: 'demo-1', atananId: 'u-4', atayanId: 'u-1', kaynak: 'Av. Deniz Demo atadı' },
      { id: 'is-2', is: 'Tanık listesini hazırla, müvekkille adresleri teyit et', son: UA.iso(isGunu(2)), dosyaId: 'demo-2', atananId: 'u-2', atayanId: 'u-2', kaynak: 'Kendine' },
      { id: 'is-3', is: 'Duruşma klasörünü hazırla (dilekçeler + tanık listesi)', son: UA.iso(isGunu(2)), dosyaId: 'demo-10', atananId: 'u-5', atayanId: 'u-2', kaynak: 'Av. Kaan Taslak atadı' },
      { id: 'is-4', is: 'Müvekkile masraf dökümünü gönder', son: UA.iso(isGunu(3)), dosyaId: 'demo-4', atananId: 'u-5', atayanId: 'u-2', kaynak: 'Av. Kaan Taslak atadı' },
      { id: 'is-5', is: 'Ödeme emri tebliğ edildi: haciz talebini hazırla', son: UA.iso(isGunu(6)), dosyaId: 'demo-7', atananId: 'u-4', atayanId: 'u-2', kaynak: 'Av. Kaan Taslak atadı' },
    ];
    const gz = (sa, kim, dosyaId, ne) => ({ zaman: saatOnce(sa), kim: KUL[kim] || kim, dosyaId, ne });
    elle.gecmis = [
      gz(150, 'u-1', null, `${KUL['u-3']} büroya katıldı (rol: Avukat)`),
      gz(140, 'u-1', 'demo-3', `Dosya devredildi: ${KUL['u-1']} → ${KUL['u-3']}`),
      gz(120, 'u-1', 'demo-5', `Ekibe eklendi: ${KUL['u-2']}`),
      gz(100, 'u-3', 'demo-6', 'Dosya gizli işaretlendi: yalnız sorumlu avukat, ekibi ve yönetici görür'),
      gz(72, 'u-2', 'demo-2', `Ekibe eklendi: ${KUL['u-4']}`),
      gz(30, 'Sistem', 'demo-5', `${KUL['u-2']} kendi UYAP'ını okudu; bu dosya ${KUL['u-1']}'nun UYAP'ında da var, tek kayıtta birleşti`),
      gz(26, 'u-3', 'demo-9', 'Başvurudan dosyaya dönüştü: Burak Numune (vekâlet alındı)'),
      gz(20, 'u-4', 'demo-2', 'Eşik üstü masraf onaya gönderildi: 3.200,00 TL, Ek bilirkişi raporu ücreti'),
      gz(18, 'u-1', 'demo-6', 'Gizli dosya açıldı (yönetici erişimi)'),
      gz(8, 'u-2', null, 'Yapay zekâ ile arama: yalnız soru gitti, adlar maskelendi'),
      gz(6, 'u-5', 'demo-7', 'Eşik üstü masraf onaya gönderildi: 2.800,00 TL, Haciz için çilingir ve nakliye'),
      gz(2, 'Sistem', null, `${KUL['u-1']} kendi UYAP'ını okudu: ${getirdi('u-1')} dosya`),
    ];
    return { db, elle };
  };
})(typeof window !== 'undefined' ? window : globalThis);
