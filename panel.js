// Urikem Legal — panel. Eklentide UYAP verisiyle, dışarıda (demo sayfası) uydurma verilerle çalışır.
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s) => document.querySelector(s);

  // ---------- ortam ----------
  const eklentide = typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local);
  let cercevede = false;
  try { cercevede = window.self !== window.top; } catch (_) { cercevede = true; }
  const indirmeVar = !cercevede; // yayınlanan demo sayfası dosya indirme ve yazdırmaya izin vermiyor

  // ---------- depolama ----------
  const bellek = {};
  const yerel = {
    get(keys) { const o = {}; for (const k of keys) { try { const v = localStorage.getItem('ua.' + k); if (v) o[k] = JSON.parse(v); } catch (_) { if (bellek[k]) o[k] = bellek[k]; } } return o; },
    set(obj) { for (const [k, v] of Object.entries(obj)) { bellek[k] = v; try { localStorage.setItem('ua.' + k, JSON.stringify(v)); } catch (_) {} } },
    remove(keys) { for (const k of keys) { delete bellek[k]; try { localStorage.removeItem('ua.' + k); } catch (_) {} } },
  };
  const al = async (keys) => (eklentide ? chrome.storage.local.get(keys) : yerel.get(keys));
  const koy = async (obj) => (eklentide ? chrome.storage.local.set(obj) : yerel.set(obj));
  const sil = async (keys) => (eklentide ? chrome.storage.local.remove(keys) : yerel.remove(keys));
  // Dekont, makbuz ve ses kayıtları: tarayıcının bu bilgisayardaki dosya deposunda (IndexedDB). Hiçbir yere gönderilmez.
  const dosyaDepo = (() => {
    let ac = null;
    const db = () => (ac = ac || new Promise((ok, red) => { const r = indexedDB.open('urikem-legal-dosyalar', 1); r.onupgradeneeded = () => r.result.createObjectStore('dosyalar'); r.onsuccess = () => ok(r.result); r.onerror = () => red(r.error); }));
    const islem = (mod, f) => db().then((d) => new Promise((ok, red) => { const t = d.transaction('dosyalar', mod); const r = f(t.objectStore('dosyalar')); t.oncomplete = () => ok(r && r.result); t.onerror = () => red(t.error); }));
    return {
      koy: (id, blob) => islem('readwrite', (st) => st.put(blob, id)),
      al: (id) => islem('readonly', (st) => st.get(id)),
      sil: (id) => islem('readwrite', (st) => st.delete(id)),
      hepsiniSil: () => islem('readwrite', (st) => st.clear()),
    };
  })();
  const dosyaAc = async (id, ad) => {
    const b = await dosyaDepo.al(id).catch(() => null);
    if (!b) return bildir('Dosya bu bilgisayarda bulunamadı.');
    const u = URL.createObjectURL(b);
    if (/^(image|application\/pdf|audio)/.test(b.type)) window.open(u, '_blank'); else { const a = document.createElement('a'); a.href = u; a.download = ad || 'belge'; a.click(); }
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  };
  // Excel için: noktalı virgülle ayrılmış, Türkçe karakterli CSV (Excel'de doğrudan açılır)
  const indir = (ad, metin, tur) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([metin], { type: tur })); a.download = ad; a.click(); };
  const csv = (satirlar) => '\ufeff' + satirlar.map((r) => r.map((h) => { const x = String(h ?? ''); return /[;"\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; }).join(';')).join('\r\n');
  const DEMO_SURUM = 5;
  const anahtar = () => (D.mod === 'demo' ? { db: 'demoDb', elle: 'demoElle' } : { db: 'db', elle: 'elle' });

  const D = {
    mod: 'demo', sayfa: 'ozet', gorunum: 'avukat', portalMuv: null, db: UA.bos(), elle: {},
    sorgu: '', evrakFiltre: 'yeni', paraFiltre: 'hepsi', acikSure: null, cekmece: null, modal: null, onay: null,
    gorusme: 'g-1', ozetAcik: false, bildirim: '', dokum: { bas: '', bit: '' },
  };
  const elleBos = () => ({ dosyalar: {}, sureler: {}, okundu: {}, muvekkiller: {}, gorusmeler: [], kronoloji: {}, isler: [], ayarlar: {}, gecmis: [] });
  // İşlem geçmişi: masraf, avans, süre, müvekkil ve paylaşım değişiklikleri kimin ne zaman yaptığıyla tutulur.
  const iz = (dosyaId, ne) => { const g = (D.elle.gecmis = D.elle.gecmis || []); g.push({ zaman: new Date().toISOString(), kim: D.elle.ayarlar?.avukatAdi || '', dosyaId: dosyaId || null, ne }); if (g.length > 5000) g.splice(0, g.length - 5000); };

  async function yukle() {
    const k = anahtar();
    const v = await al([k.db, k.elle, 'demoSurum', 'demoGun']);
    if (D.mod === 'demo' && (!v[k.db] || v.demoSurum !== DEMO_SURUM || v.demoGun !== UA.iso(new Date()))) {
      const demo = UA.demoOlustur(new Date());
      await koy({ demoDb: demo.db, demoElle: demo.elle, demoSurum: DEMO_SURUM, demoGun: UA.iso(new Date()) });
      v[k.db] = demo.db; v[k.elle] = demo.elle;
    }
    D.db = v[k.db] && v[k.db].surum ? UA.dbBuda(UA.dbDuzelt(v[k.db])) : UA.bos();
    D.elle = Object.assign(elleBos(), v[k.elle] || {});
    let elleDegisti = D.mod === 'canli' && UA.elleDuzelt(D.elle, D.db);
    if (D.mod === 'canli' && D.elle.ayarlar?.avukatAdi && UA.otoMuvekkil(D.db, D.elle, D.elle.ayarlar.avukatAdi)) elleDegisti = true;
    // Saklama süresi dolan görüşme ses kayıtlarını sil
    const gun = +D.elle.ayarlar?.sesSaklamaGun;
    if (D.mod === 'canli' && gun) for (const g of D.elle.gorusmeler || []) if (g.ses && Date.now() - Date.parse(g.tarih) > gun * 864e5) {
      await dosyaDepo.sil(g.ses.id).catch(() => {}); g.ses = null; iz(g.dosyaId, `Görüşme ses kaydı saklama süresi (${gun} gün) dolduğu için silindi`); elleDegisti = true;
    }
    if (elleDegisti) await koy({ [k.elle]: D.elle });
    const ek = await al(['sablonlar', 'sonSenkron', 'uyapSinyal', 'sonYakalama']);
    D.sablonlar = ek.sablonlar || {}; D.sonSenkron = ek.sonSenkron || null; D.uyapSinyal = ek.uyapSinyal || null; D.sonYakalama = ek.sonYakalama || null;
  }
  const kaydet = async () => { await koy({ [anahtar().elle]: D.elle }); ciz(); };
  const dosyaElle = (id) => (D.elle.dosyalar[id] = D.elle.dosyalar[id] || { hareketler: [] });
  const bildir = (m) => { D.bildirim = m; ciz(); setTimeout(() => { if (D.bildirim === m) { D.bildirim = ''; const b = $('#bildirim'); if (b) b.hidden = true; } }, 3500); };

  // ---------- hesaplar ----------
  const bugun = () => UA.gun(new Date());
  const gunFarki = (d) => Math.round((UA.gun(UA.tarihCoz(d) || d) - bugun()) / 86400000);
  const kalanMetin = (n) => (n < 0 ? `${-n} gün geçti` : n === 0 ? 'bugün' : n === 1 ? 'yarın' : `${n} gün`);
  const dosyaAdi = (id) => { const d = D.db.dosyalar[id]; return d ? `${kisaBirim(d.birimAdi)} ${d.dosyaNo || ''}`.trim() : 'Bilinmeyen dosya'; };
  const kisaBirim = (s) => String(s || '').replace(/ Mahkemesi$/, '').replace(/^İstanbul Anadolu /, 'İst. Anadolu ').replace(/^İstanbul /, 'İst. ');
  const evrakDosya = (e) => e.anaDosyaId || e.dosyaId;
  const tarihAraliginda = (d, z) => { if (!z) return true; const g = UA.gun(UA.tarihCoz(d) || d); return g >= z.bas && g <= z.bit; };

  // Her çizimde bir kez hesaplanır (840 dosya / binlerce evrakla her satırda yeniden hesaplamak paneli donduruyordu)
  let nesil = 0;
  const bellekte = (f) => { let n = -1, v; return () => (n === nesil ? v : ((n = nesil), (v = f()))); };
  const muvekkiller = bellekte(() => {
    const liste = Object.values(D.elle.muvekkiller || {}).map((m) => ({ ...m }));
    for (const [id, e] of Object.entries(D.elle.dosyalar)) {
      if (!e.muvekkil || liste.some((m) => m.id === e.muvekkilId || m.ad === e.muvekkil)) continue;
      liste.push({ id: 'ad:' + e.muvekkil, ad: e.muvekkil, tur: '', sanal: true });
    }
    for (const m of liste) m.dosyalar = Object.keys(D.db.dosyalar).filter((id) => { const e = D.elle.dosyalar[id] || {}; return e.muvekkilId === m.id || e.muvekkil === m.ad; });
    return liste.sort((a, b) => b.dosyalar.length - a.dosyalar.length || a.ad.localeCompare(b.ad, 'tr'));
  });
  const muvekkilBul = (id) => muvekkiller().find((m) => m.id === id);
  const durusmalar = bellekte(() => Object.values(D.db.durusmalar).filter((d) => d.tarihSaat && UA.gun(d.tarihSaat) >= bugun()).sort((a, b) => a.tarihSaat.localeCompare(b.tarihSaat)));
  const evraklar = bellekte(() => Object.values(D.db.evraklar).sort((a, b) => String(b.onayTarihi || b.ilkGorulme).localeCompare(String(a.onayTarihi || a.ilkGorulme))));
  const okunmamis = bellekte(() => evraklar().filter((e) => e.yeni && !D.elle.okundu[e.evrakId]));
  const dosyaGrubu = (f) => bellekte(() => { const o = {}; for (const e of f()) (o[evrakDosya(e)] = o[evrakDosya(e)] || []).push(e); return o; });
  const dosyaEvraki = dosyaGrubu(evraklar), dosyaOkunmamis = dosyaGrubu(okunmamis);
  const sonrakiDurusma = bellekte(() => { const o = {}; for (const d of durusmalar()) o[d.dosyaId] = o[d.dosyaId] || d; return o; });
  const sureler = () => Object.entries(D.elle.sureler).map(([id, s]) => ({ id, ...s, evrak: D.db.evraklar[id], kontrol: UA.sureKontrol(s.tebligTarihi, s.sure, s.sonGun, s.tabi), kalan: gunFarki(s.sonGun) }))
    .filter((s) => s.evrak).sort((a, b) => a.sonGun.localeCompare(b.sonGun));
  const suresizTebligat = bellekte(() => evraklar().filter((e) => UA.tebligatMi(e) && e.yeni && !D.elle.sureler[e.evrakId] && !D.elle.okundu[e.evrakId]));
  const paraBellek = bellekte(() => new Map());
  const paraOzet = (id) => { const m = paraBellek(); if (!m.has(id)) m.set(id, UA.paraOzet(D.db, D.elle.dosyalar, id, { buro: D.elle.ayarlar?.buro || [] })); return m.get(id); };
  const avansiBiten = () => Object.keys(D.db.dosyalar).map((id) => ({ id, p: paraOzet(id) })).filter((x) => x.p.hareketVar && x.p.bakiye < 0);
  const finans = (ids = Object.keys(D.db.dosyalar)) => ids.map(paraOzet).reduce((t, p) => ({
    masraf: t.masraf + p.toplamMasraf, tahsil: t.tahsil + p.avans + p.tahsilat - p.iade, bekleyen: t.bekleyen + p.bekleyen, kullanilabilir: t.kullanilabilir + p.kullanilabilir, belgesiz: t.belgesiz + p.belgesiz, buroda: t.buroda + p.buroda,
    avansYok: t.avansYok + p.avansKaydiYok, avansYokDosya: t.avansYokDosya + (p.avansKaydiYok ? 1 : 0),
  }), { masraf: 0, tahsil: 0, bekleyen: 0, kullanilabilir: 0, belgesiz: 0, buroda: 0, avansYok: 0, avansYokDosya: 0 });
  const acikMi = (id) => UA.normal(D.db.dosyalar[id]?.dosyaDurum).startsWith('açık');

  // ---------- ortak parçalar ----------
  const rozetler = (e) => [
    e.yeni && !D.elle.okundu[e.evrakId] ? '<span class="rozet r-yeni">Yeni</span>' : '',
    UA.tebligatMi(e) ? '<span class="rozet r-teb">Tebligat</span>' : UA.makbuzMu(e) ? '<span class="rozet r-gri">Makbuz</span>' : UA.onemliMi(e) ? '<span class="rozet r-gri">Önemli</span>' : '',
  ].join('');
  const bos = (m) => `<p class="bos">${m}</p>`;
  const zamanOnce = (iso) => {
    if (!iso) return 'henüz yok';
    const dk = Math.round((Date.now() - new Date(iso)) / 60000);
    return dk < 1 ? 'az önce' : dk < 60 ? `${dk} dk önce` : dk < 1440 ? `${Math.round(dk / 60)} sa önce` : `${Math.round(dk / 1440)} gün önce`;
  };
  const kart = (baslik, deger, alt, uyari, git) => `<div class="kart ${uyari ? 'uyari' : ''}"><div class="kart-bas">${baslik}</div><div class="deger">${deger}</div><div class="kucuk soluk">${alt}</div>${git ? `<button class="link kucuk" data-git="${git}">Gör →</button>` : ''}</div>`;
  const tutar = (n, cls = '') => `<span class="tutar ${n < 0 ? 'eksi' : ''} ${cls}">${UA.tl(n)}</span>`;
  const gTakvimLink = (baslik, bas, saatli, detay) => {
    const d = new Date(bas), p2 = (x) => String(x).padStart(2, '0');
    const f = (x) => `${x.getFullYear()}${p2(x.getMonth() + 1)}${p2(x.getDate())}`;
    let dates;
    if (saatli) { const s = (x) => `${f(x)}T${p2(x.getHours())}${p2(x.getMinutes())}00`; const e = new Date(d.getTime() + 3600000); dates = `${s(d)}/${s(e)}`; }
    else { const e = new Date(d); e.setDate(e.getDate() + 1); dates = `${f(d)}/${f(e)}`; }
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(baslik)}&dates=${dates}&details=${encodeURIComponent(detay || '')}&ctz=Europe/Istanbul`;
  };
  const kopyala = async (metin, bilgi) => {
    try { await navigator.clipboard.writeText(metin); bildir(bilgi || 'Kopyalandı.'); }
    catch (_) { D.modal = { tur: 'metin', baslik: 'Kopyalanacak metin', metin }; ciz(); }
  };
  const tsv = (satirlar) => satirlar.map((r) => r.map((h) => String(h ?? '').replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
  const sayiTsv = (n) => (n == null ? '' : Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  // ---------- özet ----------
  const OGRET = [
    ['search_phrase_detayli.ajx', 'Dosya Sorgula', 'Dosya Sorgulama İşlemleri → Dosya Sorgula: herhangi bir yargı türü ve birim seçip Durum "Açık" ile bir kez Sorgula. Diğer bütün mahkeme türlerini asistan kendisi bulur.'],
    ['avukat_durusma_sorgula_brd.ajx', 'Duruşma Sorgula', 'UYAP İşlemlerim → Duruşma Sorgula: herhangi bir tarih aralığıyla bir kez Sorgula.'],
    ['dosya_taraf_bilgileri_brd.ajx', 'Bir dosyada Taraflar', 'Herhangi bir dosyayı açıp Taraflar sekmesine bakın.'],
    ['list_dosya_evraklar.ajx', 'Aynı dosyada Evrak', 'Evrak → Tüm Evrak.'],
    ['dosya_tahsilat_reddiyat_bilgileri_brd.ajx', 'Aynı dosyada Tah./Red. Bilgileri', 'Tahsilat ve reddiyat sekmesi.'],
  ];
  function guncelleDugmesi(buyuk) {
    const sn = D.senkron;
    if (sn?.calisiyor) return `<div class="ilerleme ${buyuk ? 'buyuk' : ''}"><div class="kucuk">UYAP'tan okunuyor: ${esc(sn.mesaj || '')} (${sn.yapilan || 0}/${sn.toplam || '…'})</div><div class="cubuk"><span style="width:${sn.toplam ? Math.round(100 * sn.yapilan / sn.toplam) : 5}%"></span></div></div>`;
    return `<button class="${buyuk ? 'dugme' : 'ikincil'}" data-eylem="guncelle">UYAP'tan şimdi güncelle</button>`;
  }
  function baglantiDurumu() {
    if (!eklentide) return '';
    const sg = D.uyapSinyal, yk = D.sonYakalama;
    const yeni = (z, dk) => z && Date.now() - Date.parse(z) < dk * 60000;
    let sinif, metin;
    if (yk && yeni(yk.zaman, 30)) { sinif = 'uyumlu'; metin = `Eklenti UYAP sayfasında çalışıyor. Son okuduğu ekran ${zamanOnce(yk.zaman)}.`; }
    else if (sg && yeni(sg.zaman, 120)) { sinif = 'erken'; metin = `Eklenti UYAP sayfasında yüklü (${zamanOnce(sg.zaman)}), ama henüz bir ekran okumadı. UYAP'ta bir sorgu yapın; burası yeşile döner.`; }
    else { sinif = 'gec'; metin = 'Eklenti UYAP sayfasında çalışmıyor. UYAP sekmesini yenileyin (Cmd + R) ya da UYAP\'a yeniden girin. Eklenti, kendisi kurulmadan önce açılmış sayfaları göremez.'; }
    return `<div class="kontrol ${sinif} alt-bosluk"><b>UYAP bağlantısı:</b> ${metin}</div>`;
  }
  function kurulum() {
    const a = D.elle.ayarlar || {}, sb = D.sablonlar || {};
    const ogrenildi = OGRET.every(([u]) => (sb[u] || []).length);
    const adim = (tamam, baslik, aciklama) => `<li class="${tamam ? 'tamam' : ''}"><span class="adim-isaret" aria-hidden="true">${tamam ? '✓' : ''}</span><div class="ana"><b>${baslik}</b><div class="kucuk soluk">${aciklama}</div></div></li>`;
    return `${baglantiDurumu()}<div class="baslik"><div><h1>Hoş geldiniz</h1><div class="soluk">Asistanı bir kez kurun. Sonra UYAP açıkken tek düğmeyle bütün dosyalarınızı, duruşmalarınızı, evrakınızı ve masraflarınızı kendisi okur. Siz basmadan okumaz.</div></div></div>
      <div class="blok"><ol class="kurulum">
        ${adim(!!a.avukatAdi, '1. Adınızı girin', `Müvekkillerinizi Taraflar sekmesindeki vekil bilgisinden tanımak için. <button class="link" data-git="hatirlatma">Hatırlatmalar → UYAP'ta görünen adınız</button>`)}
        ${adim(ogrenildi, '2. Asistana UYAP\'ı bir kez gösterin (yaklaşık 5 dakika)', 'E-imzayla UYAP\'a girin ve aşağıdakileri birer kez yapın. Asistan, UYAP\'ın bu bilgileri nasıl getirdiğini öğrenir; bir daha yapmanız gerekmez.')}
      </ol>
      <ul class="ogret">${OGRET.map(([u, ad, ac]) => `<li class="${(sb[u] || []).length ? 'tamam' : ''}"><span class="adim-isaret kucuk-isaret" aria-hidden="true">${(sb[u] || []).length ? '✓' : ''}</span><div><b>${ad}</b><div class="kucuk soluk">${ac}</div></div></li>`).join('')}</ul>
      <ol class="kurulum" start="3">${adim(!!(D.sonSenkron && D.sonSenkron.durum === 'tamam'), '3. Hepsini okutun', `Asistan bütün açık dosyalarınızı tek tek okur. UYAP'ı yormamak için yavaş gider; dosya sayısına göre birkaç dakika sürer. UYAP sekmesi açık kalmalı.<div class="ust-bosluk">${ogrenildi || (sb['search_phrase_detayli.ajx'] || []).length ? guncelleDugmesi(true) : '<span class="kucuk soluk">2. adım bitince burada "UYAP\'tan şimdi güncelle" düğmesi çıkar.</span>'}</div>`)}</ol></div>
      <p class="kucuk soluk">Asistan UYAP'ta yalnızca okuma sorguları yapar: listeler ve dosya bilgileri. Göndermez, kaydetmez, ödemez. Bakım saatlerinde çalışmaz. Veriler yalnızca bu bilgisayarda saklanır.</p>`;
  }

  function ozet() {
    if (D.mod === 'canli' && !Object.keys(D.db.dosyalar).length) return kurulum();
    const dr = durusmalar(), hafta = dr.filter((d) => gunFarki(d.tarihSaat) <= 7);
    const yeni = okunmamis(), sr = sureler().filter((s) => s.kalan >= 0), f = finans();
    const sorunlu = sureler().filter((s) => s.kontrol && s.kontrol.durum === 'gec');
    const isler = (D.elle.isler || []).filter((i) => !i.bitti);
    return `
      <div class="baslik"><div><h1>Günaydın</h1><div class="soluk">${new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${Object.keys(D.db.dosyalar).length} dosya, ${muvekkiller().length} müvekkil${D.mod === 'canli' && D.sonSenkron && D.sonSenkron.durum === 'tamam' ? ` · UYAP'tan son okuma: ${zamanOnce(D.sonSenkron.zaman)}` : ''}</div></div>${D.mod === 'canli' && eklentide ? guncelleDugmesi(false) : ''}</div>
      ${D.mod === 'canli' ? baglantiDurumu() : ''}
      ${D.mod === 'canli' && D.sonSenkron?.durum === 'hata' ? `<div class="kontrol gec alt-bosluk"><b>Son okuma tamamlanamadı:</b> ${esc(D.sonSenkron.hata)}</div>` : ''}
      ${D.mod === 'canli' && !(D.sablonlar || {})['avukat_durusma_sorgula_brd.ajx'] ? '<div class="kontrol erken alt-bosluk"><b>Duruşmalar henüz okunamıyor.</b> UYAP\'ta UYAP İşlemlerim → Duruşma Sorgula ekranında bir kez Sorgula\'ya basın; sonra "güncelle".</div>' : ''}
      ${sorguKutusu(true)}
      <div class="kartlar">
        ${kart('7 gün içinde duruşma', hafta.length, hafta[0] ? `İlki ${UA.trTarih(hafta[0].tarihSaat)} ${UA.trSaat(hafta[0].tarihSaat)}` : 'Yok', false, 'durusma')}
        ${kart('Okunmamış yeni evrak', yeni.length, `${yeni.filter(UA.tebligatMi).length} tanesi tebligat`, false, 'evrak')}
        ${kart('Süresi işleyen iş', sr.length, sorunlu.length ? `${sorunlu.length} tanesinde tarih uyumsuz` : sr[0] ? `En yakını ${kalanMetin(sr[0].kalan)} sonra` : 'Yok', sorunlu.length > 0, 'evrak')}
        ${kart('Bekleyen masraf tahsilatı', UA.tl(f.bekleyen).replace(' TL', '<small> TL</small>'), `${avansiBiten().length} dosyada avans bitti`, f.bekleyen > 0, 'para')}
      </div>
      <div class="iki">
        <div>
          ${dikkat(sorunlu)}
          <div class="blok"><h2>Yaklaşan son günler</h2>${sr.length ? `<ul class="liste">${sr.map((s) => `
            <li><div class="tarih">${UA.trTarih(s.sonGun)}<div class="kucuk soluk">${kalanMetin(s.kalan)}</div></div>
            <div class="ana"><div>${esc(s.aciklama || s.evrak.tur)}</div><div class="kucuk soluk">${esc(dosyaAdi(evrakDosya(s.evrak)))}</div>
            ${s.kontrol && s.kontrol.durum === 'gec' ? '<span class="rozet r-kirmizi">Tarih hesaptan geç</span>' : s.kontrol && s.kontrol.durum === 'uyumlu' ? '<span class="rozet r-yesil">Kontrol edildi</span>' : ''}</div></li>`).join('')}</ul>` : bos('Son günü girilmiş bir iş yok.')}</div>
          ${isler.length ? `<div class="blok"><h2>Yapılacaklar</h2><ul class="liste">${isler.map((i) => `<li><input type="checkbox" id="is-${esc(i.id)}" data-eylem="is-bitti" data-id="${esc(i.id)}" aria-label="Tamamlandı"><div class="ana"><label for="is-${esc(i.id)}">${esc(i.is)}</label><div class="kucuk soluk">${esc(i.kaynak || '')}${i.son ? ' · son: ' + UA.trTarih(i.son) : ''}</div></div></li>`).join('')}</ul></div>` : ''}
        </div>
        <div>
          <div class="blok"><h2>Bu hafta duruşmalar</h2>${hafta.length ? `<ul class="liste">${hafta.map((d) => `
            <li class="tikla" data-eylem="dosya" data-id="${esc(d.dosyaId)}"><div class="tarih">${UA.trTarih(d.tarihSaat)}<div class="kucuk soluk">${UA.trSaat(d.tarihSaat)}</div></div>
            <div class="ana"><div>${esc(kisaBirim(d.birim))} <b>${esc(d.dosyaNo)}</b></div><div class="kucuk soluk">${esc(d.islem || '')} · ${esc(D.elle.dosyalar[d.dosyaId]?.muvekkil || '')}</div></div></li>`).join('')}</ul>` : bos('Bu hafta duruşma yok.')}</div>
          <div class="blok"><h2>Yeni gelen evrak</h2>${yeni.length ? `<ul class="liste">${yeni.slice(0, 6).map((e) => `
            <li><div class="tarih">${UA.trTarih(e.onayTarihi)}</div><div class="ana"><div>${rozetler(e)} ${esc(e.tur)}</div><div class="kucuk soluk">${esc(dosyaAdi(evrakDosya(e)))}</div></div></li>`).join('')}</ul>` : bos('Okunmamış yeni evrak yok.')}</div>
        </div>
      </div>`;
  }

  function dikkat(sorunlu) {
    const s = [];
    for (const x of sorunlu) s.push(`<li><span class="rozet r-kirmizi">Süre</span><div class="ana"><b>${esc(x.aciklama || x.evrak.tur)}</b>: girilen son gün (${UA.trTarih(x.sonGun)}) asistanın hesabından ${x.kontrol.fark} gün sonra. <button class="link" data-eylem="sure-ac" data-id="${esc(x.id)}">Hesabı gör</button></div></li>`);
    for (const e of suresizTebligat()) s.push(`<li><span class="rozet r-teb">Tebligat</span><div class="ana">${esc(dosyaAdi(evrakDosya(e)))}: <b>${esc(e.tur)}</b> geldi, son günü girilmedi. <button class="link" data-eylem="sure-ac" data-id="${esc(e.evrakId)}">Son günü gir</button></div></li>`);
    for (const b of avansiBiten()) s.push(`<li><span class="rozet r-kirmizi">Avans</span><div class="ana">${esc(D.elle.dosyalar[b.id]?.muvekkil || dosyaAdi(b.id))}: avans bitti, ${tutar(b.p.bekleyen)} tahsil edilecek. <button class="link" data-eylem="dosya" data-id="${esc(b.id)}">Dosyayı aç</button></div></li>`);
    return s.length ? `<div class="blok vurgulu"><h2>Dikkat edilecekler</h2><ul class="liste">${s.join('')}</ul></div>` : '';
  }

  // ---------- doğal dille sorgu ----------
  const sorguKutusu = (buyuk) => `<form class="sorgu ${buyuk ? 'buyuk' : ''}" data-form="sorgu" role="search">
      <label for="sorgu-${buyuk ? 'b' : 'k'}" class="gizli">Dosyalarınıza soru sorun</label>
      <input id="sorgu-${buyuk ? 'b' : 'k'}" name="q" autocomplete="off" placeholder="Sorun: gelecek hafta duruşması olan icra dosyalarım…" value="${esc(buyuk ? '' : D.sorgu)}">
      <button class="dugme">Sor</button>
    </form>${buyuk ? `<div class="oneriler">${UA.ORNEK_SORULAR.map((q) => `<button class="cip" data-sor="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}`;

  // ---------- yapay zekâyla sorgu yorumlama ----------
  // Kural tabanlı çözücü soruyu anlamazsa soru Claude'a gider; Claude YALNIZ bir süzgeç (JSON) döndürür,
  // arama bu bilgisayarda yapılır. Sorudaki müvekkil adları ve numaralar önce maskelenir; maskelenemeyen bir ad
  // kalırsa soru kendiliğinden gönderilmez, avukata sorulur.
  const SORGU_SISTEM = (ctx) => `Bir avukatın dosya yönetim programında arama kutusuna yazdığı Türkçe soruyu bir arama süzgecine çevirirsin. Yalnız geçerli JSON yaz; açıklama, kod bloğu ya da başka metin yazma.
Bugün: ${ctx.bugun}.
Süzgeç alanları (gerekmeyeni null ya da boş bırak):
{"konu": "durusma" | "tebligat" | "evrak" | "sure" | "para" | "muvekkil" | "dosya" | "ajanda",
 "zaman": {"bas": "YYYY-AA-GG", "bit": "YYYY-AA-GG"} | null,
 "tur": "icra" | "hukuk" | "ceza" | "idare" | null,
 "dosyaDurumlari": dosya durumunda geçmesi gereken küçük harfli ifadeler; BİRİ yeterli, ör. ["yargıtay", "istinaf"],
 "muvekkiller": soruda geçen müvekkil etiketleri, ör. ["[Müvekkil 3]"],
 "birimler": mahkeme adında geçmesi gereken küçük harfli kelimeler; BİRİ yeterli, ör. ["ticaret"],
 "dosyaNo": "YYYY/NNN" ya da soruda geçen dosya no etiketi | null,
 "evrakVar": dosyada bulunması gereken evrak türü kelimeleri, küçük harf, ör. ["bilirkişi raporu"],
 "evrakYok": dosyada bulunmaması gereken evrak türü kelimeleri, ör. ["itiraz"],
 "durusma": "var" (yaklaşan duruşması olan dosyalar) | "yok" (yaklaşan duruşması olmayan) | null,
 "durum": {"avansEksi": bool, "okunmamis": bool, "belgesiz": bool, "suresiz": bool, "uyumsuz": bool, "kapali": bool},
 "esikler": tutar ya da sayı şartları, ör. [{"alan": "masraf", "op": ">", "deger": 5000}]; alan: "masraf" (toplam masraf, TL) | "avans" (kullanılabilir avans, TL) | "tahsil" (müvekkilden tahsil edilecek, TL) | "bakiye" (dosya bakiyesi, TL; yalnız konu para) | "dosya" (dosya sayısı; yalnız konu muvekkil); op: ">" | ">=" | "<" | "<=",
 "sirala": "masraf" | "bakiye" | "tarih" | null, "limit": sayı | null,
 "anlasilan": "sorudan ne anladığının tek cümlelik Türkçe özeti"}
Konu anlamları: durusma = duruşmalar; tebligat = gelen tebligatlar; evrak = gelen evrak; sure = avukatın girdiği son günler; para = dosya masraf/avans; muvekkil = müvekkil listesi ve hesapları; dosya = dosya listesi; ajanda = bir tarih aralığındaki bütün işler.
Dosya türleri: ${ctx.turler.join(', ')}. Dosya durumları: ${ctx.durumlar.join(', ')}.
"Yargıtay'da", "istinafta", "karara çıkmış", "derdest", "kapanmış" gibi ifadeler dosya DURUMUDUR, mahkeme adı değildir: dosyaDurumlari'na yaz. "Açık dosya" = dosyaDurumlari ["açık"]. Mahkeme adı ancak "ticaret mahkemesi", "Kadıköy", "3. İş" gibi bir mahkemeyi kastediyorsa birimler'e yazılır.
Tutar ya da sayı şartı varsa ("5000 TL'den fazla", "10 binin altında", "3'ten çok dosyası olan") mutlaka esikler'e yaz; "fazla/üstünde" ">", "en az" ">=", "az/altında" "<", "en fazla" "<=". Müvekkil soruluyorsa konu muvekkil, dosya soruluyorsa konu para olur. "5 bin", "5.000", "5000 TL" hepsi 5000'dir.
Köşeli parantezli etiketler gizlenmiş adlardır; aynen kullan. Emin olmadığın alanı boş bırak.`;
  function sorguMaskele(soru) {
    const adlar = muvekkiller().map((m) => m.ad).filter((a) => a && !/\*{2,}/.test(a));
    const liste = adlar.map((a, i) => `[Müvekkil ${i + 1}] = ${a}`).join('\n');
    const h = UA.anonimlestir(soru, liste);
    return { ...h, supheli: supheliSuz(h.supheliler, h.anonim) };
  }
  function yzSuzgecCevir(j, soru) {
    const g = (x) => (x == null || x === '' ? null : x);
    const tarih = (x) => (x ? UA.gun(UA.tarihCoz(x)) : null);
    const r = { metin: soru, konu: ['durusma', 'tebligat', 'evrak', 'sure', 'para', 'muvekkil', 'dosya', 'ajanda'].includes(j.konu) ? j.konu : 'dosya',
      zaman: j.zaman && j.zaman.bas && j.zaman.bit ? { bas: tarih(j.zaman.bas), bit: tarih(j.zaman.bit), etiket: `${UA.trTarih(tarih(j.zaman.bas))} – ${UA.trTarih(tarih(j.zaman.bit))}` } : null,
      tur: g(j.tur), muvekkiller: [], birimler: (j.birimler || []).map(UA.normal).filter(Boolean), dosyaNo: g(j.dosyaNo),
      durum: Object.fromEntries(Object.entries(j.durum || {}).filter(([, v]) => v === true)),
      dosyaDurumlari: [...(j.dosyaDurumlari || []), ...(j.dosyaDurumu ? [j.dosyaDurumu] : [])].map(UA.normal).filter(Boolean), birimVeya: true, evrakVar: (j.evrakVar || []).map(UA.normal).filter(Boolean), evrakYok: (j.evrakYok || []).map(UA.normal).filter(Boolean),
      durusma: ['var', 'yok'].includes(j.durusma) ? j.durusma : null, sirala: g(j.sirala),
      esikler: (Array.isArray(j.esikler) ? j.esikler : []).filter((x) => x && ['masraf', 'avans', 'tahsil', 'bakiye', 'dosya'].includes(x.alan) && ['>', '>=', '<', '<='].includes(x.op) && Number.isFinite(+x.deger)).map((x) => ({ alan: x.alan, op: x.op, deger: +x.deger })), limit: +j.limit || null, anlasilan: g(j.anlasilan), yz: true };
    const adlar = new Set(muvekkiller().map((m) => m.ad));
    r.muvekkiller = (j.muvekkiller || []).filter((x) => adlar.has(x));
    r.hedefMuvekkil = r.konu === 'muvekkil' || r.sirala === 'masraf' && r.konu === 'muvekkil';
    return r;
  }
  async function yzSorguYorumla(soru, gonderOnayli) {
    const m = sorguMaskele(soru);
    if (m.supheli.length && !gonderOnayli) { D.sorguYz = { soru, bekliyor: false, onayGerek: true, maskeli: m.anonim, supheli: m.supheli }; return sonraCiz(); }
    D.sorguYz = { soru, bekliyor: true, maskeli: m.anonim }; sonraCiz();
    try {
      const ctx = { bugun: UA.iso(new Date()), turler: [...new Set(Object.values(D.db.dosyalar).map((d) => d.dosyaTur).filter(Boolean))], durumlar: [...new Set(Object.values(D.db.dosyalar).map((d) => String(d.dosyaDurum || '').replace(/\s*\(.*$/, '')).filter(Boolean))] };
      const ham = await yzUret(SORGU_SISTEM(ctx), m.anonim, 'low');
      const acik = UA.geriCevir(ham, m);
      const j = JSON.parse((acik.match(/\{[\s\S]*\}/) || [''])[0]);
      if (D.sorgu === soru) D.sorguYz = { soru, bekliyor: false, maskeli: m.anonim, filtre: yzSuzgecCevir(j, soru) };
    } catch (e) { if (D.sorgu === soru) D.sorguYz = { soru, bekliyor: false, maskeli: m.anonim, hata: e.message || 'Claude soruyu yorumlayamadı.' }; }
    sonraCiz();
  }

  function sorguSayfa() {
    const kural = UA.sorguCoz(D.sorgu, { muvekkilAdlari: muvekkiller().map((m) => m.ad) });
    // Kural yalnız konuyu yakalayıp başka hiçbir şart bulamadıysa ve soru kısa değilse (ya da "ama, henüz, olmayan, en çok" gibi
    // kuralların bilmediği bir yapı varsa) soruyu anlamamış sayılır ve Claude'a sorulur.
    const sartsiz = !kural.zaman && !kural.tur && !kural.muvekkiller.length && !kural.birimler.length && !kural.dosyaNo && !Object.keys(kural.durum).length && !(kural.esikler || []).length;
    const kelime = String(D.sorgu).trim().split(/\s+/).length;
    const karmasik = /\b(ama|fakat|henüz|hiç|olmayan|olmamış|etmediğim|etmediğimiz|yapmadığım|gelmeyen|en çok|en fazla|en az|kaç|hangi|neden|değil)\b/i.test(D.sorgu);
    const zayif = sartsiz && ((kural.konu === 'dosya' && kelime >= 2) || kelime >= 4 || karmasik);
    const yzS = D.sorguYz && D.sorguYz.soru === D.sorgu ? D.sorguYz : null;
    yzDurumTazele();
    const yzBagli = D.yzDurum?.hazir && D.yzDurum?.giris;
    // Yapay zekâ bağlıysa her soru Claude'a yorumlatılır (yalnız maskeli soru gider); kurallar yalnız bağlantı yoksa ya da Claude hata verirse kullanılır.
    if (yzBagli && !yzS) { const soru = D.sorgu; D.sorguYz = { soru, bekliyor: true }; setTimeout(() => yzSorguYorumla(soru), 0); }
    const yzBekle = !window.URIKEM_DEMO && (yzS?.bekliyor || yzS?.onayGerek || (D.yzDurum === undefined && !yzS));
    const r = yzS?.filtre || kural;
    const KONU = { durusma: 'duruşmalar', tebligat: 'tebligatlar', evrak: 'evrak', sure: 'son günler', para: 'masraf ve avans', muvekkil: 'müvekkiller', dosya: 'dosyalar', ajanda: 'o günlerin işleri' };
    const cipler = [`Konu: ${KONU[r.konu]}`];
    if (r.zaman) cipler.push(`Zaman: ${r.zaman.etiket} (${UA.trTarih(r.zaman.bas)} – ${UA.trTarih(r.zaman.bit)})`);
    if (r.tur) cipler.push(`Tür: ${r.tur}`);
    for (const m of r.muvekkiller) cipler.push(`Müvekkil: ${m}`);
    if (r.birimler.length) cipler.push(`Mahkeme: ${r.birimler.join(r.birimVeya ? ' ya da ' : ' ve ')}`);
    if (r.dosyaNo) cipler.push(`Dosya: ${r.dosyaNo}`);
    const DUR = { avansEksi: 'avansı biten', okunmamis: 'okunmamış', belgesiz: 'belgesi eksik', suresiz: 'son günü girilmemiş', uyumsuz: 'tarihi uyumsuz', kapali: 'kapalı' };
    for (const k of Object.keys(r.durum)) cipler.push(`Durum: ${DUR[k] || k}`);
    if (r.durusma) cipler.push(r.durusma === 'var' ? 'Yaklaşan duruşması olan' : 'Yaklaşan duruşması olmayan');
    if ((r.dosyaDurumlari || []).length) cipler.push(`Dosya durumu: ${r.dosyaDurumlari.join(' ya da ')}`);
    for (const x of r.evrakVar || []) cipler.push(`Evrak var: ${x}`);
    for (const x of r.evrakYok || []) cipler.push(`Evrak yok: ${x}`);
    const ESIK_AD = { masraf: 'Toplam masraf', avans: 'Kullanılabilir avans', tahsil: 'Tahsil edilecek', bakiye: 'Bakiye', dosya: 'Dosya sayısı' };
    for (const x of r.esikler || []) cipler.push(`${ESIK_AD[x.alan]} ${x.op} ${x.alan === 'dosya' ? x.deger : UA.tl(x.deger)}`);
    const esikUyar = (deger) => (r.esikler || []).every((x) => { const v = deger[x.alan]; if (v == null) return true; return x.op === '>' ? v > x.deger : x.op === '>=' ? v >= x.deger : x.op === '<' ? v < x.deger : v <= x.deger; });
    if (r.sirala) cipler.push(`Sıra: ${{ masraf: 'en çok masraf', bakiye: 'bakiye', tarih: 'tarih' }[r.sirala] || r.sirala}${r.limit ? ', ilk ' + r.limit : ''}`);

    const dosyaUyar = (id) => {
      const d = D.db.dosyalar[id]; if (!d) return false;
      const e = D.elle.dosyalar[id] || {};
      if (r.tur === 'icra' && !UA.normal(d.dosyaTur).includes('icra')) return false;
      if (r.tur === 'hukuk' && UA.normal(d.dosyaTur).includes('icra')) return false;
      if ((r.tur === 'ceza' || r.tur === 'idare') && !UA.normal(d.dosyaTur).includes(r.tur)) return false;
      if (r.durusma === 'var' && !sonrakiDurusma()[id]) return false;
      if (r.durusma === 'yok' && sonrakiDurusma()[id]) return false;
      if ((r.dosyaDurumlari || []).length && !r.dosyaDurumlari.some((x) => UA.normal(d.dosyaDurum).includes(x))) return false;
      if ((r.evrakVar || []).length || (r.evrakYok || []).length) {
        const metin = (dosyaEvraki()[id] || []).map((x) => UA.normal(`${x.tur} ${x.tip || ''} ${x.aciklama || ''}`)).join(' | ');
        if (!(r.evrakVar || []).every((k) => metin.includes(k))) return false;
        if ((r.evrakYok || []).some((k) => metin.includes(k))) return false;
      }
      if (r.muvekkiller.length && !r.muvekkiller.includes(e.muvekkil)) return false;
      if (r.birimler.length && !(r.birimVeya ? r.birimler.some : r.birimler.every).call(r.birimler, (b) => UA.normal(d.birimAdi).includes(b))) return false;
      if (r.dosyaNo && d.dosyaNo !== r.dosyaNo) return false;
      return true;
    };
    let govde = '', sayi = 0;
    const durusmaListe = (z) => { const l = durusmalar().filter((d) => dosyaUyar(d.dosyaId) && tarihAraliginda(d.tarihSaat, z)); sayi += l.length; return l.length ? `<div class="blok"><h2>Duruşmalar (${l.length})</h2><ul class="liste">${l.map((d) => `<li class="tikla" data-eylem="dosya" data-id="${esc(d.dosyaId)}"><div class="tarih">${UA.trTarih(d.tarihSaat)}<div class="kucuk soluk">${UA.trSaat(d.tarihSaat)}</div></div><div class="ana"><div>${esc(kisaBirim(d.birim))} <b>${esc(d.dosyaNo)}</b></div><div class="kucuk soluk">${esc(d.islem || '')} · ${esc(D.elle.dosyalar[d.dosyaId]?.muvekkil || '')}</div></div></li>`).join('')}</ul></div>` : ''; };
    const sureListe = (z) => {
      let l = sureler().filter((s) => dosyaUyar(evrakDosya(s.evrak)) && (z ? tarihAraliginda(s.sonGun, z) : s.kalan >= 0));
      if (r.durum.uyumsuz) l = l.filter((s) => s.kontrol?.durum === 'gec');
      sayi += l.length;
      return l.length ? `<div class="blok"><h2>Son günler (${l.length})</h2><ul class="liste">${l.map((s) => `<li class="tikla" data-eylem="sure-ac" data-id="${esc(s.id)}"><div class="tarih">${UA.trTarih(s.sonGun)}<div class="kucuk soluk">${kalanMetin(s.kalan)}</div></div><div class="ana"><div>${esc(s.aciklama || s.evrak.tur)} ${s.kontrol?.durum === 'gec' ? '<span class="rozet r-kirmizi">Tarih hesaptan geç</span>' : ''}</div><div class="kucuk soluk">${esc(dosyaAdi(evrakDosya(s.evrak)))}</div></div></li>`).join('')}</ul></div>` : '';
    };
    const evrakListe = (filtre, z, baslik) => { const l = evraklar().filter((e) => filtre(e) && dosyaUyar(evrakDosya(e)) && tarihAraliginda(e.onayTarihi, z)); sayi += l.length; return l.length ? `<div class="blok"><h2>${baslik} (${l.length})</h2><ul class="liste">${l.map((e) => evrakSatiri(e)).join('')}</ul></div>` : ''; };

    if (r.konu === 'durusma') govde = durusmaListe(r.zaman || { bas: bugun(), bit: new Date(bugun().getTime() + 30 * 864e5) });
    else if (r.konu === 'sure' && r.durum.suresiz) { const l = suresizTebligat().filter((e) => dosyaUyar(evrakDosya(e))); sayi = l.length; govde = l.length ? `<div class="blok"><h2>Son günü girilmemiş tebligatlar (${l.length})</h2><ul class="liste">${l.map((e) => evrakSatiri(e)).join('')}</ul></div>` : ''; }
    else if (r.konu === 'sure') govde = sureListe(r.zaman);
    else if (r.konu === 'tebligat') govde = evrakListe(UA.tebligatMi, r.zaman || { bas: new Date(bugun().getTime() - 30 * 864e5), bit: bugun() }, 'Tebligatlar');
    else if (r.konu === 'evrak') govde = evrakListe((e) => (r.durum.okunmamis ? e.yeni && !D.elle.okundu[e.evrakId] : true) && (!(r.evrakVar || []).length || r.evrakVar.some((k) => UA.normal(`${e.tur} ${e.aciklama || ''}`).includes(k))), r.zaman, r.durum.okunmamis ? 'Okunmamış evrak' : 'Evrak');
    else if (r.konu === 'ajanda') { govde = durusmaListe(r.zaman) + sureListe(r.zaman) + evrakListe(() => true, r.zaman, 'Gelen evrak'); }
    else if (r.konu === 'para' && r.durum.belgesiz) {
      const l = Object.keys(D.db.dosyalar).filter(dosyaUyar).flatMap((id) => paraOzet(id).hareketler.filter((h) => h.tur === 'gider' && !h.belge).map((h) => ({ id, h })));
      sayi = l.length;
      govde = l.length ? `<div class="tablo"><table><thead><tr><th>Tarih</th><th>Dosya</th><th>Masraf</th><th class="sayi">Tutar</th></tr></thead><tbody>${l.map(({ id, h }) => `<tr class="tikla" data-eylem="dosya" data-id="${esc(id)}"><td>${UA.trTarih(UA.tarihCoz(h.tarih))}</td><td>${esc(dosyaAdi(id))}<div class="kucuk soluk">${esc(D.elle.dosyalar[id]?.muvekkil || '')}</div></td><td>${esc(h.aciklama)}<div class="kucuk soluk">${esc(h.kategori || '')}</div></td><td class="sayi">${UA.tl(h.tutar)}</td></tr>`).join('')}</tbody></table></div>` : '';
    } else if (r.konu === 'para' || r.konu === 'muvekkil') {
      if (r.hedefMuvekkil || r.konu === 'muvekkil') {
        let l = muvekkiller().filter((m) => !r.muvekkiller.length || r.muvekkiller.includes(m.ad)).map((m) => { const ids = m.dosyalar.filter(dosyaUyar); return { m, ids, f: finans(ids) }; }).filter((x) => x.ids.length);
        l = l.filter(({ ids, f }) => esikUyar({ masraf: f.masraf, avans: f.kullanilabilir, tahsil: f.bekleyen, dosya: ids.length }));
        if (r.durum.avansEksi) l = l.filter((x) => x.f.bekleyen > 0);
        if (r.sirala === 'masraf') l.sort((a, b) => b.f.masraf - a.f.masraf); else if (r.sirala === 'bakiye') l.sort((a, b) => b.f.bekleyen - a.f.bekleyen);
        if (r.limit) l = l.slice(0, r.limit);
        sayi = l.length;
        govde = l.length ? `<div class="tablo"><table><thead><tr><th>Müvekkil</th><th class="sayi">Dosya</th><th class="sayi">Toplam masraf</th><th class="sayi">Kullanılabilir avans</th><th class="sayi">Tahsil edilecek</th></tr></thead><tbody>${l.map(({ m, ids, f }) => `<tr class="tikla" data-eylem="muvekkil" data-id="${esc(m.id)}"><td><b>${esc(m.ad)}</b></td><td class="sayi">${ids.length}</td><td class="sayi">${UA.tl(f.masraf)}</td><td class="sayi">${UA.tl(f.kullanilabilir)}</td><td class="sayi ${f.bekleyen ? 'eksi' : ''}">${UA.tl(f.bekleyen)}</td></tr>`).join('')}</tbody></table></div>` : '';
      } else {
        let l = Object.keys(D.db.dosyalar).filter(dosyaUyar).map((id) => ({ id, p: paraOzet(id) })).filter((x) => x.p.hareketVar);
        if ((r.esikler || []).length) l = l.filter(({ p }) => esikUyar({ masraf: p.toplamMasraf, avans: p.kullanilabilir, tahsil: p.bekleyen, bakiye: p.hesapAcik ? p.bakiye : null }));
        if (r.durum.avansEksi) l = l.filter((x) => x.p.bakiye < 0);
        if (r.sirala === 'masraf') l = l.filter((x) => x.p.toplamMasraf > 0).sort((a, b) => b.p.toplamMasraf - a.p.toplamMasraf);
        if (r.limit) l = l.slice(0, r.limit);
        sayi = l.length;
        govde = l.length ? paraTablosu(l) : '';
      }
    } else {
      let l = Object.values(D.db.dosyalar).filter((d) => dosyaUyar(d.dosyaId) && (!r.durum.kapali || /kapal/i.test(d.dosyaDurum || '')));
      if (r.limit) l = l.slice(0, r.limit);
      sayi = l.length;
      govde = l.length ? dosyaTablosu(l) : '';
    }
    if (yzBekle) return `<div class="baslik"><div><h1>Sorgu</h1><div class="soluk">“${esc(D.sorgu)}”</div></div></div>
      ${sorguKutusu(false)}
      ${yzS?.onayGerek ? `<div class="kontrol erken alt-bosluk">Soruda maskelenemeyen bir ad olabilir: <b>${yzS.supheli.map((x) => esc(x.deger)).join(', ')}</b>. Claude'a şu hâliyle gidecek: “${esc(yzS.maskeli)}”. <button class="dugme" data-eylem="sorgu-yz-gonder">Yine de Claude'a sor</button> <button class="ikincil" data-eylem="sorgu-kural">Claude'a sorma, kurallarla ara</button></div>`
        : `<div class="kontrol erken alt-bosluk">${yzS ? 'Claude soruyu yorumluyor… (birkaç saniye). Claude\'a yalnız soru gider, adlar maskelenir; arama bu bilgisayarda yapılır.' : 'Yapay zekâ bağlantısı kontrol ediliyor…'}</div>`}`;
    return `<div class="baslik"><div><h1>Sorgu</h1><div class="soluk">“${esc(D.sorgu)}”</div></div></div>
      ${sorguKutusu(false)}
      ${D.mod !== 'demo' && zayif && !yzBagli ? `<div class="kontrol erken alt-bosluk">Bu soruyu kurallarla anlayamadım. Claude ile yorumlamak için yapay zekâ köprüsünü açın (<code>urikem-yz/yz-baslat.command</code>).${D.yzDurum?.hata ? ` <span class="kucuk soluk">Hata: ${esc(D.yzDurum.hata)}</span>` : ''}</div>` : ''}
      ${yzS?.kuralla ? '<div class="kontrol erken alt-bosluk">Claude\'a sorulmadı; kurallarla anlaşılan sonuç gösteriliyor. Kurallar tutar şartlarını ve karmaşık soruları anlamayabilir.</div>' : ''}
      ${yzS?.hata ? `<div class="kontrol gec alt-bosluk">Claude soruyu yorumlayamadı: ${esc(yzS.hata)} Kurallarla anlaşılan sonuç gösteriliyor.</div>` : ''}
      ${r.yz && r.anlasilan ? `<div class="kontrol uyumlu alt-bosluk"><b>Claude'un anladığı:</b> ${esc(r.anlasilan)} <span class="kucuk soluk">(Claude'a yalnız soru gitti: “${esc(yzS.maskeli)}”; arama bu bilgisayarda yapıldı.)</span></div>` : ''}
      <div class="anlasilan"><span class="kucuk soluk">${r.yz ? 'Süzgeç:' : 'Asistanın anladığı:'}</span> ${cipler.map((c) => `<span class="cip sabit">${esc(c)}</span>`).join('')} <span class="kucuk soluk">· ${sayi} sonuç</span>${yzBagli && !yzS?.bekliyor && !r.yz ? ' <button class="link" data-eylem="sorgu-yz">Claude ile yorumla</button>' : ''}</div>
      ${govde || bos('Bu soruya uyan kayıt bulunamadı. Soruyu farklı sözcüklerle deneyin ya da aşağıdaki örneklerden birini seçin.')}
      <div class="oneriler">${UA.ORNEK_SORULAR.map((q) => `<button class="cip" data-sor="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <p class="kucuk soluk">${yzBagli ? 'Sorular Claude ile yorumlanır: yalnız soru, adlar maskelenerek gider; Claude bir süzgeç döndürür, arama ve sonuçlar bu bilgisayarda kalır.' : 'Yapay zekâ bağlı değil; sorular bu bilgisayarda kurallarla çözülüyor. Kurallar basit soruları anlar; tutar şartlı ya da karmaşık sorular için yapay zekâ köprüsünü açın.'}</p>`;
  }

  // ---------- duruşmalar ----------
  function durusmaSayfa() {
    const dr = durusmalar();
    let son = '';
    const satirlar = dr.map((d) => {
      const g = UA.trTarih(d.tarihSaat);
      const ayrac = g !== son ? `<tr class="gun-ayrac"><td colspan="5">${new Date(d.tarihSaat).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${kalanMetin(gunFarki(d.tarihSaat))}</td></tr>` : '';
      son = g;
      const baslik = `Duruşma: ${kisaBirim(d.birim)} ${d.dosyaNo}`;
      return ayrac + `<tr><td>${UA.trSaat(d.tarihSaat)}</td><td class="tikla" data-eylem="dosya" data-id="${esc(d.dosyaId)}">${esc(kisaBirim(d.birim))}<br><b>${esc(d.dosyaNo)}</b></td><td>${esc(d.islem || '')}<div class="kucuk soluk">${esc(d.sonuc || '')}</div></td><td class="kucuk">${esc(D.elle.dosyalar[d.dosyaId]?.muvekkil || '')}</td>
        <td><a class="ikincil kucuk" target="_blank" rel="noopener" href="${gTakvimLink(baslik, d.tarihSaat, true, d.islem || '')}">Takvime ekle</a></td></tr>`;
    }).join('');
    return `<div class="baslik"><div><h1>Duruşmalar</h1><div class="soluk">Son okuma: ${zamanOnce(D.db.senkron.durusmalar)}. UYAP tek sorguda en fazla 30 günü veriyor; asistan pencereleri birleştirir.</div></div>
      ${indirmeVar && dr.length ? '<button class="ikincil" data-eylem="ics">Tümünü takvime aktar (.ics)</button>' : ''}</div>
      ${dr.length ? `<div class="tablo"><table><thead><tr><th>Saat</th><th>Mahkeme / dosya</th><th>İşlem</th><th>Müvekkil</th><th></th></tr></thead><tbody>${satirlar}</tbody></table></div>` : bos('Kayıtlı duruşma yok. UYAP\'ta UYAP İşlemlerim → Duruşma Sorgula ekranını bir kez çalıştırın.')}`;
  }

  // ---------- evrak ve süre ----------
  function sureFormu(e) {
    const s = D.elle.sureler[e.evrakId] || {};
    const tabi = s.tabi == null ? '' : s.tabi ? 'evet' : 'hayir';
    return `<form class="form" data-form="sure" data-id="${esc(e.evrakId)}">
      <label>Tebliğ tarihi<input type="date" name="teblig" id="teblig-${esc(e.evrakId)}" required value="${esc(s.tebligTarihi || '')}"></label>
      <label>Süre<span class="yan"><input type="number" name="miktar" id="miktar-${esc(e.evrakId)}" min="1" max="365" required class="dar" value="${esc(s.sure?.miktar || '')}">
        <select name="birim" id="birim-${esc(e.evrakId)}">${['gün', 'hafta', 'ay'].map((b) => `<option ${s.sure?.birim === b ? 'selected' : ''}>${b}</option>`).join('')}</select></span></label>
      <fieldset><legend>Adli tatile tabi mi?</legend><span class="yan"><label class="secim"><input type="radio" name="tabi" value="evet" required ${tabi === 'evet' ? 'checked' : ''}> Evet</label><label class="secim"><input type="radio" name="tabi" value="hayir" ${tabi === 'hayir' ? 'checked' : ''}> Hayır</label></span></fieldset>
      <label>Son gün (sizin hesabınız)<input type="date" name="songun" id="songun-${esc(e.evrakId)}" required value="${esc(s.sonGun || '')}"></label>
      <label class="genis">Ne için?<input name="aciklama" id="aciklama-${esc(e.evrakId)}" placeholder="ör. istinaf, itiraz, tanık listesi" value="${esc(s.aciklama || '')}"></label>
      <span class="form-son"><button type="button" class="ikincil" data-eylem="sure-kapat">Vazgeç</button><button class="dugme">Kaydet ve kontrol et</button></span>
      <div class="kucuk soluk genis">Asistan son günü sizin yerinize önermez. Siz girersiniz, asistan Kartı Avukat Ajandası'nın hesap motoruyla karşılaştırır ve farkı adım adım gösterir.</div>
    </form>`;
  }

  function kontrolKutusu(id) {
    const s = D.elle.sureler[id];
    if (!s) return '';
    const k = UA.sureKontrol(s.tebligTarihi, s.sure, s.sonGun, s.tabi);
    if (!k) return '';
    const bas = k.durum === 'uyumlu' ? `Girdiğiniz son gün (${UA.trTarih(s.sonGun)}) asistanın hesabıyla aynı.`
      : k.durum === 'gec' ? `Dikkat: girdiğiniz son gün (${UA.trTarih(s.sonGun)}) asistanın hesabından ${k.fark} gün SONRA. Süre kaçabilir, kontrol edin.`
      : `Girdiğiniz son gün (${UA.trTarih(s.sonGun)}) asistanın hesabından ${-k.fark} gün önce. Güvenli taraftasınız.`;
    return `<div class="kontrol ${k.durum}"><b>${bas}</b><ol>${k.adimlar.map((a) => `<li>${esc(a)}</li>`).join('')}</ol><div class="kucuk">${esc(k.sinirlar)}</div></div>`;
  }

  function evrakSatiri(e, dosyaGoster = true) {
    const s = D.elle.sureler[e.evrakId];
    const takvim = s ? `<a class="link kucuk" target="_blank" rel="noopener" href="${gTakvimLink(`SON GÜN: ${s.aciklama || e.tur} · ${dosyaAdi(evrakDosya(e))}`, UA.tarihCoz(s.sonGun), false, 'Urikem Legal hatırlatması')}">Takvime ekle</a>` : '';
    return `<li id="evrak-${esc(e.evrakId)}"><div class="tarih">${UA.trTarih(e.onayTarihi)}</div><div class="ana">
      <div>${rozetler(e)} <b>${esc(e.tur)}</b> <span class="soluk">${esc(e.aciklama && e.aciklama !== e.tur ? '· ' + e.aciklama : '')}</span></div>
      ${dosyaGoster ? `<div class="kucuk soluk">${esc(dosyaAdi(evrakDosya(e)))} · ${esc(D.elle.dosyalar[evrakDosya(e)]?.muvekkil || '')}</div>` : ''}
      ${s && D.acikSure !== e.evrakId ? `<div class="kucuk ust-bosluk">Son gün: <b>${UA.trTarih(s.sonGun)}</b> (${kalanMetin(gunFarki(s.sonGun))}) · ${esc(s.aciklama || '')} · ${takvim}</div>${kontrolKutusu(e.evrakId)}` : ''}
      ${D.acikSure === e.evrakId ? sureFormu(e) : ''}
      </div><div class="satir-dugmeler">
      ${UA.tebligatMi(e) || s ? `<button class="ikincil" data-eylem="sure-ac" data-id="${esc(e.evrakId)}">${s ? 'Süreyi düzenle' : 'Son günü gir'}</button>` : ''}
      ${e.yeni && !D.elle.okundu[e.evrakId] ? `<button class="ikincil" data-eylem="okundu" data-id="${esc(e.evrakId)}">Okundu</button>` : ''}
      </div></li>`;
  }

  function evrakSayfa() {
    const f = D.evrakFiltre, hepsi = evraklar();
    const liste = f === 'yeni' ? okunmamis() : f === 'teb' ? hepsi.filter((e) => UA.tebligatMi(e) || D.elle.sureler[e.evrakId]) : hepsi;
    const btn = (k, ad, n) => `<button data-filtre="${k}" aria-pressed="${f === k}">${ad} (${n})</button>`;
    return `<div class="baslik"><div><h1>Evrak ve tebligat</h1><div class="soluk">Son okuma: ${zamanOnce(D.db.senkron.evraklar)}. Yeni evrak, UYAP'taki listeyle bir önceki okuma karşılaştırılarak bulunur.</div></div>
      <div class="filtre">${btn('yeni', 'Okunmamış', okunmamis().length)}${btn('teb', 'Tebligatlar', hepsi.filter(UA.tebligatMi).length)}${btn('hepsi', 'Tümü', hepsi.length)}</div></div>
      <div class="blok">${liste.length ? `<ul class="liste">${liste.map((e) => evrakSatiri(e)).join('')}</ul>` : bos(f === 'yeni' ? 'Okunmamış yeni evrak yok.' : 'Evrak yok.')}</div>`;
  }

  // ---------- müvekkiller ----------
  function muvekkilSayfa() {
    const l = muvekkiller();
    return `<div class="baslik"><div><h1>Müvekkiller</h1><div class="soluk">${l.length} müvekkil. Her müvekkilin dosyaları ve hesabı tek kartta.</div></div><button class="dugme" data-eylem="yeni-muvekkil">Müvekkil ekle</button></div>
      ${D.modal?.tur === 'yeni-muvekkil' ? '' : ''}
      <div class="muv-izgara">${l.map((m) => { const f = finans(m.dosyalar); const sonraki = durusmalar().find((d) => m.dosyalar.includes(d.dosyaId)); return `
        <button class="muv-kart" data-eylem="muvekkil" data-id="${esc(m.id)}">
          <span class="muv-ust"><span class="avatar" aria-hidden="true">${esc(m.ad.slice(0, 1))}</span><span><b>${esc(m.ad)}</b><span class="kucuk soluk blok-satir">${esc(m.tur || 'Müvekkil')} · ${m.dosyalar.length} dosya</span></span></span>
          <span class="muv-rakam"><span><span class="kucuk soluk blok-satir">Kullanılabilir avans</span>${tutar(f.kullanilabilir)}</span><span><span class="kucuk soluk blok-satir">Tahsil edilecek</span>${f.bekleyen ? tutar(-f.bekleyen) : tutar(0)}</span></span>
          <span class="kucuk soluk">${sonraki ? `Sonraki duruşma: ${UA.trTarih(sonraki.tarihSaat)}` : 'Yaklaşan duruşma yok'}${m.dosyalar.some((id) => D.elle.dosyalar[id]?.paylas) ? ' · <span class="rozet r-yesil">Portal açık</span>' : ''}</span>
        </button>`; }).join('')}</div>`;
  }

  function muvekkilCekmece(id) {
    const m = muvekkilBul(id);
    if (!m) return '';
    const f = finans(m.dosyalar);
    const kr = (D.elle.kronoloji[m.id] || []).slice().sort((a, b) => a.tarih.localeCompare(b.tarih));
    return `<div class="cekmece" role="dialog" aria-label="Müvekkil kartı"><button class="ikincil kapat" data-eylem="kapat">Kapat</button>
      <h1>${esc(m.ad)}</h1><div class="soluk alt-bosluk">${esc(m.tur || 'Müvekkil')}${m.kayit ? ' · Kayıt ' + UA.trTarih(UA.tarihCoz(m.kayit)) : ''}</div>
      <div class="blok"><h2>İletişim</h2>
        ${[['Yetkili', m.yetkili], ['Telefon', m.telefon], ['E-posta', m.eposta], ['Vergi no', m.vergiNo]].filter(([, v]) => v).map(([a, v]) => `<div class="ozet-satir"><span class="soluk">${a}</span><span class="secilebilir">${esc(v)}</span></div>`).join('') || bos('İletişim bilgisi girilmemiş.')}
      </div>
      <div class="kartlar uc">
        ${kart('Toplam masraf', UA.tl(f.masraf), 'UYAP + elle girilen')}
        ${kart('Kullanılabilir avans', UA.tl(f.kullanilabilir), 'Dosyalardaki toplam')}
        ${kart('Tahsil edilecek', UA.tl(f.bekleyen), 'Avansı aşan masraf', f.bekleyen > 0)}
      </div>
      <div class="blok"><h2>Dosyaları</h2>${m.dosyalar.length ? dosyaTablosu(m.dosyalar.map((x) => D.db.dosyalar[x]), true) : bos('Dosya yok.')}</div>
      <div class="blok"><h2>Müvekkil geçmişi</h2>${kr.length ? `<ol class="kronoloji">${kr.map((k) => `<li><span class="tarih">${UA.trTarih(UA.tarihCoz(k.tarih))}</span><span>${esc(k.olay)}<span class="kucuk soluk blok-satir">Kaynak: ${esc(k.kaynak)}</span></span></li>`).join('')}</ol>` : bos('Henüz kayıt yok.')}</div>
      ${m.sanal ? '' : `<button class="ikincil" data-eylem="portal-onizle" data-id="${esc(m.id)}">Müvekkil portalını bu müvekkil gibi görüntüle</button>`}
    </div>`;
  }

  // ---------- dosyalar ----------
  function dosyaTablosu(liste, kisa) {
    const dr = durusmalar();
    return `<div class="tablo"><table><thead><tr><th>Mahkeme / dosya</th><th>Tür</th>${kisa ? '' : '<th>Müvekkil</th>'}<th>Sonraki duruşma</th><th>Evrak</th><th class="sayi">Avans bakiyesi</th></tr></thead><tbody>${liste.filter(Boolean).map((d) => {
      const sonraki = sonrakiDurusma()[d.dosyaId];
      const yeni = (dosyaOkunmamis()[d.dosyaId] || []).length;
      const p = paraOzet(d.dosyaId), e = D.elle.dosyalar[d.dosyaId] || {};
      return `<tr class="tikla" data-eylem="dosya" data-id="${esc(d.dosyaId)}"><td>${esc(kisaBirim(d.birimAdi))}<br><b>${esc(d.dosyaNo)}</b></td><td>${esc(d.dosyaTur || '')}<div class="kucuk soluk">${esc(d.dosyaDurum || '')}</div></td>
        ${kisa ? '' : `<td>${esc(e.muvekkil || '—')}</td>`}<td>${sonraki ? `${UA.trTarih(sonraki.tarihSaat)} ${UA.trSaat(sonraki.tarihSaat)}` : '<span class="soluk">—</span>'}</td>
        <td>${yeni ? `<span class="rozet r-yeni">${yeni} yeni</span>` : ''}</td><td class="sayi ${p.bakiye < 0 ? 'eksi' : ''}">${p.hareketVar ? UA.tl(p.bakiye) : '<span class="soluk">—</span>'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  const dosyaSayfa = () => `<div class="baslik"><div><h1>Dosyalar</h1><div class="soluk">Son okuma: ${zamanOnce(D.db.senkron.dosyalar)}. Dosya no, mahkeme, tür ve durum UYAP'tan gelir.</div></div></div>
    ${Object.keys(D.db.dosyalar).length ? dosyaTablosu(Object.values(D.db.dosyalar).sort((a, b) => String(a.birimAdi).localeCompare(String(b.birimAdi), 'tr'))) : bos('Henüz dosya yok. UYAP\'ta Dosya Sorgula ekranını çalıştırın.')}`;

  // ---------- masraf ve avans ----------
  function paraTablosu(l) {
    return `<div class="tablo"><table><thead><tr><th>Dosya / müvekkil</th><th class="sayi">Alınan avans</th><th class="sayi">Masraf (yansıtılan)</th><th class="sayi">Tahsilat − iade</th><th class="sayi">Bakiye</th><th>Durum</th></tr></thead><tbody>${l.map(({ id, p }) => `
      <tr class="tikla" data-eylem="dosya" data-id="${esc(id)}" data-bolum="para"><td>${esc(dosyaAdi(id))}<div class="kucuk soluk">${esc(D.elle.dosyalar[id]?.muvekkil || '')}</div></td>
      <td class="sayi">${p.hesapAcik ? UA.tl(p.avans) : '<span class="soluk">—</span>'}</td><td class="sayi">${UA.tl(p.yansitilan)}</td><td class="sayi">${p.hesapAcik ? UA.tl(p.tahsilat - p.iade) : '<span class="soluk">—</span>'}</td><td class="sayi ${p.hesapAcik && p.bakiye < 0 ? 'eksi' : ''}">${p.hesapAcik ? `<b>${UA.tl(p.bakiye)}</b>` : '<span class="soluk">—</span>'}</td>
      <td>${!p.hesapAcik ? '<span class="rozet r-gri">Avans girilmedi</span>' : p.bakiye < 0 ? `<span class="rozet r-kirmizi">${UA.tl(p.bekleyen)} tahsil edilecek</span>` : '<span class="rozet r-yesil">Avans yeterli</span>'}${p.belgesiz ? ` <span class="rozet r-teb">${p.belgesiz} belgesiz</span>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function paraSayfa() {
    // Varsayılan: açık dosyalar. Kapalı/karara çıkmış dosyaların eski ödemeleri ayrı süzgeçte.
    const kapsam = Object.keys(D.db.dosyalar).filter((id) => D.paraFiltre === 'kapali' ? !acikMi(id) : acikMi(id) || paraOzet(id).hesapAcik);
    const f = finans(kapsam);
    let l = kapsam.map((id) => ({ id, p: paraOzet(id) })).filter((x) => x.p.hesapAcik || x.p.yansitilan > 0);
    if (D.paraFiltre === 'bekleyen') l = l.filter((x) => x.p.bekleyen > 0);
    if (D.paraFiltre === 'belgesiz') l = l.filter((x) => x.p.belgesiz > 0);
    if (D.paraFiltre === 'avanssiz') l = l.filter((x) => x.p.avansKaydiYok > 0);
    l.sort((a, b) => (b.p.hesapAcik - a.p.hesapAcik) || (a.p.hesapAcik ? a.p.bakiye - b.p.bakiye : b.p.yansitilan - a.p.yansitilan));
    const btn = (k, ad) => `<button data-pfiltre="${k}" aria-pressed="${D.paraFiltre === k}">${ad}</button>`;
    return `<div class="baslik"><div><h1>Masraf ve avans</h1><div class="soluk">Mahkeme ve icra masrafları UYAP'tan kendiliğinden gelir. Noter, resmî kurum ve ulaşım giderleri elle eklenir.</div></div>
      <span class="yan"><button class="ikincil" data-eylem="excel-para">${indirmeVar ? 'Excel olarak indir' : 'Excel\'e kopyala'}</button>${indirmeVar ? '<button class="ikincil" data-eylem="yazdir">PDF olarak kaydet</button>' : ''}</span></div>
      <div class="kartlar">
        ${kart('Avukatın ödediği masraf', UA.tl(f.masraf), D.paraFiltre === 'kapali' ? 'kapalı dosyalar' : `açık dosyalar · ${UA.tl(f.buroda)} büro üstlendi`)}
        ${kart('Tahsil edilen', UA.tl(f.tahsil), 'Avans + tahsilat − iade')}
        ${kart('Bekleyen tahsilat', UA.tl(f.bekleyen), f.bekleyen ? `${avansiBiten().length} dosya` : 'avans girilen dosyalarda', f.bekleyen > 0)}
        ${kart('Kullanılabilir avans', UA.tl(f.kullanilabilir), `${f.belgesiz} masrafın belgesi eksik`, false)}
      </div>
      ${f.avansYok ? `<div class="bant bilgi alt-bosluk">${f.avansYokDosya} dosyada avukat adına ödenmiş <b>${UA.tl(f.avansYok)}</b> masraf var ama müvekkilden alınan avans girilmemiş. Bu yüzden bu dosyalar için "bekleyen tahsilat" hesaplanmıyor. Dosyayı açıp aldığınız avansı girdiğinizde hesaba katılır.</div>` : ''}
      <div class="filtre alt-bosluk">${btn('hepsi', 'Açık dosyalar')}${btn('bekleyen', 'Bekleyen tahsilat')}${btn('avanssiz', 'Avans girilmemiş')}${btn('belgesiz', 'Belgesi eksik')}${btn('kapali', 'Kapalı dosyalar')}</div>
      ${l.length ? paraTablosu(l) : bos('Bu filtreye uyan dosya yok.')}
      <p class="kucuk soluk">Masraf sayılan: UYAP'ta ödeyeni sizin adınız olan harç, gider/delil avansı, depo bedeli gibi ödemeler. Müvekkilin kendi yatırdıkları, teminatlar (iade edilir) ve icrada borçludan yapılan tahsilatlar masrafa girmez. İstinaf/Yargıtay dosyasında görünen ilk derece ödemeleri iki kez sayılmaz.<br>Bakiye = alınan avans + masraf tahsilatları − iadeler − müvekkile yansıtılan masraflar. Eksi bakiye müvekkilden tahsil edilecek tutardır.</p>`;
  }

  const SINIF_ROZET = (s) => s.once ? ' <span class="rozet r-gri">Dosyayı almadan önce</span>' : s.baskaDosya ? ' <span class="rozet r-gri">İlgili dosyanın ödemesi, burada sayılmaz</span>' : s.sinif === 'teminat' ? ' <span class="rozet r-gri">Teminat · iade edilir</span>' : s.sinif === 'borc' ? ' <span class="rozet r-gri">Borçludan tahsilat</span>' : s.kim === 'muvekkil' ? ' <span class="rozet r-gri">Müvekkil ödedi</span>' : '';
  function paraBileseni(id, portal) {
    const p = paraOzet(id), e = dosyaElle(id), uy = D.db.para[id];
    const satir = (ad, v, cls = '') => `<div class="ozet-satir ${cls}"><span>${ad}</span>${tutar(v)}</div>`;
    const ozetHtml = `<div class="blok"><h2>Hesap özeti</h2>
      ${satir('Müvekkilden alınan avans', p.avans)}${p.tahsilat ? satir('Masraf tahsilatları', p.tahsilat) : ''}${p.iade ? satir('Avans iadesi', -p.iade) : ''}
      ${satir('Müvekkile yansıtılan masraflar', -p.yansitilan)}
      ${satir(p.bakiye >= 0 ? 'Kullanılabilir avans' : 'Müvekkilden tahsil edilecek', p.bakiye, 'toplam')}
      ${!portal && p.buroda ? `<div class="kucuk soluk">Büronun üstlendiği (müvekkile yansıtılmayan) masraf: ${UA.tl(p.buroda)}</div>` : ''}
      ${!portal ? `<div class="ozet-satir"><span>Vekâlet ücreti</span><form data-form="vekalet" data-id="${esc(id)}" class="yan"><label class="gizli" for="vek-${esc(id)}">Vekâlet ücreti</label><input id="vek-${esc(id)}" type="number" step="0.01" min="0" name="ucret" value="${esc(e.vekaletUcreti || '')}" class="orta" placeholder="0,00"><button class="ikincil">Kaydet</button></form></div>
      ${p.vekalet ? satir('Kapanışta müvekkilden istenecek (ücret − bakiye)', p.kapanistaIstenecek, 'toplam') : ''}` : ''}
      ${p.iadeEdilebilir ? `<div class="kucuk soluk ust-bosluk">UYAP veznesinde henüz harcanmamış ${UA.tl(p.iadeEdilebilir)} gider avansı var. Dava bitince kullanılmayanı iade edilir.</div>` : ''}
    </div>`;
    const devralmaHtml = !portal && uy ? `<form class="yan alt-bosluk" data-form="devralma" data-id="${esc(id)}"><label>Dosyayı aldığım tarih<input type="date" name="tarih" id="dev-${esc(id)}" value="${esc(e.devralma || '')}"></label><button class="ikincil">Kaydet</button>
      <span class="kucuk soluk">${e.devralma ? 'Bu tarihten önceki ödemeler hesaba girmez.' : p.devralmaOtomatik ? `Girilmedi: adınıza ilk ödemenin tarihi (${UA.trTarih(UA.tarihCoz(p.devralmaOtomatik))}) kabul ediliyor; ondan önce başkalarının yaptığı ödemeler hesaba girmez.` : 'Dosyayı başka avukattan aldıysanız girin; önceki ödemeler hesaba girmez.'}${p.onceki ? ` Önceki dönem: ${UA.tl(p.onceki)}.` : ''}</span></form>` : '';
    const uyapHtml = `<div class="blok"><h2>UYAP'tan gelen masraflar <span class="kucuk soluk">(Tah./Red. Bilgileri, ${uy ? zamanOnce(uy.guncelleme) : 'henüz okunmadı'})</span></h2>${devralmaHtml}
      ${uy ? `<div class="tablo"><table><thead><tr>${portal ? '' : '<th>Bizim</th><th>Yansıt</th>'}<th>Tarih</th><th>Kalem</th>${portal ? '' : '<th>Ödeyen</th>'}<th class="sayi">Tutar</th></tr></thead><tbody>
        ${p.uyapSatirlar.filter((s) => !portal || (s.bizim && s.yansit)).map((s) => `<tr>${portal ? '' : `<td><input type="checkbox" data-eylem="satir-sec" data-id="${esc(id)}" data-kayit="${esc(s.kayitId)}" ${s.bizim ? 'checked' : ''} aria-label="Bizim ödememiz"></td>
          <td><input type="checkbox" data-eylem="uyap-yansit" data-id="${esc(id)}" data-kayit="${esc(s.kayitId)}" ${s.yansit ? 'checked' : ''} ${s.bizim ? '' : 'disabled'} aria-label="Müvekkile yansıt"></td>`}
          <td>${UA.trTarih(s.tarih)}</td><td>${esc(s.kalem)}<div class="kucuk soluk">${esc(s.kategori)}${s.makbuzNo ? ' · makbuz ' + esc(s.makbuzNo) : ''}</div>${portal ? '' : SINIF_ROZET(s)}</td>${portal ? '' : `<td class="kucuk">${esc(s.odeyen)}<div class="soluk">${{ avukat: 'siz', muvekkil: 'müvekkil', baskasi: 'başkası', bilinmiyor: '' }[s.kim] || ''}</div></td>`}
          <td class="sayi">${UA.tl(s.tutar)}</td></tr>`).join('')}
      </tbody></table></div>${portal ? '' : '<div class="kucuk soluk">Yalnız ödeyeni sizin adınız olan masraflar otomatik "bizim" işaretlenir. Müvekkilin kendi ödediği, teminat ve borçludan tahsilat satırları hesaba girmez. Gerekirse kutucukla değiştirebilirsiniz.</div>'}`
      : bos('UYAP\'ta bu dosyanın Tah./Red. Bilgileri sekmesini bir kez açın.')}
    </div>`;
    const red = (uy && uy.reddiyatlar) || [];
    const redHtml = !portal && red.length ? `<div class="blok"><h2>Vezneden yapılan ödemeler (reddiyat) <span class="kucuk soluk">UYAP Tah./Red. Bilgileri</span></h2>
      <div class="tablo"><table><thead><tr><th>Tarih</th><th>Kime / açıklama</th><th class="sayi">Tutar</th></tr></thead><tbody>
      ${red.map((s) => `<tr><td>${s.tarih ? UA.trTarih(s.tarih) : '<span class="soluk">—</span>'}</td><td>${esc(s.odeyen || '')}<div class="kucuk soluk">${esc(s.kalem || '')}${s.makbuzNo ? ' · makbuz ' + esc(s.makbuzNo) : ''}</div></td><td class="sayi">${UA.tl(s.tutar)}</td></tr>`).join('')}
      <tr class="toplam"><td colspan="2"><b>Toplam</b></td><td class="sayi"><b>${UA.tl(red.reduce((t, s) => t + (+s.tutar || 0), 0))}</b></td></tr></tbody></table></div>
      ${uy.toplam ? `<div class="kucuk soluk">UYAP toplamları: tahsilat ${UA.tl(uy.toplam.tahsilat)}, reddiyat ${UA.tl(uy.toplam.reddiyat)}, kalan ${UA.tl(uy.toplam.kalan)}</div>` : ''}</div>` : '';
    const hareketler = p.hareketler.filter((h) => !portal || h.tur !== 'gider' || h.yansit !== false);
    const harHtml = `<div class="blok"><h2>${portal ? 'Ödemeler ve diğer masraflar' : 'Elle girilen hareketler'}</h2>
      ${hareketler.length ? `<div class="tablo"><table><thead><tr><th>Tarih</th><th>Tür</th><th>Açıklama</th>${portal ? '' : '<th>Belge</th>'}<th class="sayi">Tutar</th>${portal ? '' : '<th></th>'}</tr></thead><tbody>
        ${hareketler.map((h) => `<tr><td>${UA.trTarih(UA.tarihCoz(h.tarih))}</td><td>${{ avans: '<span class="rozet r-yesil">Avans</span>', gider: '<span class="rozet r-gri">Masraf</span>', tahsilat: '<span class="rozet r-yesil">Tahsilat</span>', iade: '<span class="rozet r-teb">İade</span>' }[h.tur]}${h.tur === 'gider' && h.yansit === false && !portal ? ' <span class="rozet r-gri">Büroda</span>' : ''}</td>
          <td>${esc(h.aciklama)}<div class="kucuk soluk">${esc([h.kategori, h.odemeYontemi, h.odeyen].filter(Boolean).join(' · '))}</div></td>
          ${portal ? '' : `<td class="kucuk">${h.belge ? (h.belge.id ? `<button class="link" data-eylem="belge-ac" data-b="${esc(h.belge.id)}" data-ad="${esc(h.belge.ad)}">📎 ${esc(h.belge.ad)}</button>` : `📎 ${esc(h.belge.ad)} <span class="soluk">(dosyası saklanmamış)</span>`) : h.tur === 'gider' ? `<label class="link">Belge ekle<input type="file" class="gizli" data-eylem="belge" data-id="${esc(id)}" data-h="${esc(h.id)}" accept=".pdf,.jpg,.jpeg,.png"></label>` : ''}</td>`}
          <td class="sayi">${UA.tl(h.tutar)}</td>${portal ? '' : `<td><button class="link" data-eylem="hareket-sil" data-id="${esc(id)}" data-h="${esc(h.id)}">Sil</button></td>`}</tr>`).join('')}</tbody></table></div>` : bos('Kayıt yok.')}
      ${portal ? '' : `<form class="form" data-form="hareket" data-id="${esc(id)}">
        <label>Tür<select name="tur" id="htur-${esc(id)}"><option value="gider">Masraf</option><option value="avans">Avans alındı</option><option value="tahsilat">Masraf tahsilatı</option><option value="iade">Avans iadesi</option></select></label>
        <label>Kategori<select name="kategori" id="hkat-${esc(id)}">${UA.KATEGORI.map((k) => `<option ${k === 'Noter / resmî kurum' ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label>Tarih<input type="date" name="tarih" id="htar-${esc(id)}" required value="${UA.iso(new Date())}"></label>
        <label>Tutar (TL)<input type="number" name="tutar" id="htut-${esc(id)}" step="0.01" min="0" required class="orta"></label>
        <label class="genis">Açıklama<input name="aciklama" id="hack-${esc(id)}" required placeholder="ör. Noter — ihtarname"></label>
        <label>Ödeyen<input name="odeyen" id="hode-${esc(id)}" list="buro-kisileri" value="${esc(D.elle.ayarlar?.avukatAdi || '')}" class="orta"></label>
        <label>Ödeme yöntemi<select name="odemeYontemi" id="hyon-${esc(id)}"><option>Kredi kartı</option><option>Havale</option><option>Nakit</option></select></label>
        <label class="secim"><input type="checkbox" name="yansit" id="hyan-${esc(id)}" checked> Müvekkile yansıt</label>
        <label>Dekont / makbuz<input type="file" name="belge" id="hbel-${esc(id)}" accept=".pdf,.jpg,.jpeg,.png"></label>
        <span class="form-son"><button class="dugme">Ekle</button></span>
      </form>`}
    </div>`;
    return ozetHtml + uyapHtml + redHtml + harHtml;
  }

  // ---------- dosya çekmecesi ----------
  function dosyaCekmece(id) {
    const d = D.db.dosyalar[id] || {}, e = dosyaElle(id);
    const taraf = D.db.taraflar[id] || [];
    const dr = durusmalar().filter((x) => x.dosyaId === id);
    const ev = dosyaEvraki()[id] || [];
    return `<div class="cekmece" role="dialog" aria-label="Dosya ayrıntısı"><button class="ikincil kapat" data-eylem="kapat">Kapat</button>
      <h1>${esc(d.dosyaNo || '')}</h1><div class="soluk">${esc(d.birimAdi || '')} · ${esc(d.dosyaTur || '')} · ${esc(d.dosyaDurum || '')}</div>
      <div class="cekmece-ust">
        ${e.muvekkilId || e.muvekkil ? `<button class="cip" data-eylem="muvekkil" data-id="${esc(e.muvekkilId || 'ad:' + e.muvekkil)}">Müvekkil: ${esc(e.muvekkil)}</button>` : ''}
        <label class="anahtar"><input type="checkbox" data-eylem="paylas" data-id="${esc(id)}" ${e.paylas ? 'checked' : ''}> Müvekkil portalında paylaş</label>
        <form class="yan" data-form="sorumlu" data-id="${esc(id)}"><label>Sorumlu avukat<input name="sorumlu" id="sor-${esc(id)}" list="buro-kisileri" value="${esc(e.sorumlu || '')}" class="orta" placeholder="${esc(D.elle.ayarlar?.avukatAdi || '')}"></label><button class="ikincil">Kaydet</button></form>
      </div>
      <datalist id="buro-kisileri">${[D.elle.ayarlar?.avukatAdi, ...(D.elle.ayarlar?.buro || [])].filter(Boolean).map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="blok"><h2>Taraflar</h2>${taraf.some((t) => /\*{2,}/.test(t.adi || '')) ? '<div class="kucuk soluk alt-bosluk">Yıldızlı adları UYAP böyle gönderiyor (kişi adlarını bu dosyada gizliyor); asistan açamaz.</div>' : ''}${taraf.length ? `<ul class="liste">${taraf.map((t) => `<li><div class="ana"><b>${esc(t.adi)}</b> <span class="soluk">${esc(t.rol || '')}</span>${t.vekil ? `<div class="kucuk soluk">Vekil: ${esc(t.vekil)}</div>` : ''}</div>
          ${UA.normal(e.muvekkil) === UA.normal(t.adi) ? '<span class="rozet r-yesil">Müvekkil</span>' : `<button class="link" data-eylem="muvekkil-sec" data-id="${esc(id)}" data-ad="${esc(t.adi)}">Müvekkil olarak işaretle</button>`}</li>`).join('')}</ul>`
        : bos('UYAP\'ta bu dosyanın Taraflar sekmesini bir kez açın.')}</div>
      ${d.icra ? `<div class="blok"><h2>İcra özeti</h2>
        <div class="ozet-satir"><span>Takip</span><span>${esc(d.icra.takibinTuru || '')} · ${esc(d.icra.takibinYolu || '')}</span></div>
        <div class="ozet-satir"><span>Alacak</span>${tutar(d.icra.alacak)}</div><div class="ozet-satir"><span>Faiz</span>${tutar(d.icra.faiz)}</div>
        <div class="ozet-satir"><span>Takip sonrası masraf</span>${tutar(d.icra.takipSonrasiMasraf)}</div><div class="ozet-satir"><span>Vekâlet ücreti (UYAP)</span>${tutar(d.icra.vekaletUcreti)}</div>
        <div class="ozet-satir toplam"><span>Yapılmış tahsilat</span>${tutar(d.icra.tahsilat)}</div></div>` : ''}
      <div class="blok"><h2>Duruşmalar</h2>${dr.length ? `<ul class="liste">${dr.map((x) => `<li><div class="tarih">${UA.trTarih(x.tarihSaat)}<div class="kucuk soluk">${UA.trSaat(x.tarihSaat)}</div></div><div class="ana">${esc(x.islem || '')}</div></li>`).join('')}</ul>` : bos('Önümüzdeki 30 günde duruşma görünmüyor.')}</div>
      <div id="bolum-para">${paraBileseni(id, false)}</div>
      <div class="blok"><h2>Evrak</h2>${ev.length ? `<ul class="liste">${ev.map((x) => evrakSatiri(x, false)).join('')}</ul>` : bos('UYAP\'ta bu dosyanın Evrak sekmesini bir kez açın.')}</div>
      ${(() => { const g = (D.elle.gecmis || []).filter((x) => x.dosyaId === id).slice(-20).reverse(); return `<div class="blok"><h2>İşlem geçmişi</h2>${g.length ? `<ul class="liste">${g.map((x) => `<li><div class="tarih">${UA.trTarih(x.zaman)}<div class="kucuk soluk">${UA.trSaat(x.zaman)}</div></div><div class="ana">${esc(x.ne)}<div class="kucuk soluk">${esc(x.kim || '')}</div></div></li>`).join('')}</ul>` : bos('Bu dosyada henüz elle yapılmış bir değişiklik yok.')}</div>`; })()}
    </div>`;
  }

  // ---------- görüşmeler ----------
  // ---------- ses kaydı (yalnız bu bilgisayarda) ----------
  let kayit = null; // { g, rec, parcalar, bas, akis }
  async function kayitBaslat(g) {
    try {
      const akis = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(akis);
      const parcalar = [];
      rec.ondataavailable = (e) => e.data && e.data.size && parcalar.push(e.data);
      rec.onstop = async () => {
        akis.getTracks().forEach((t) => t.stop());
        const blob = new Blob(parcalar, { type: rec.mimeType || 'audio/webm' }), sn = Math.round((Date.now() - kayit.bas) / 1000), sid = 'ses-' + g.id;
        kayit = null;
        g = (D.elle.gorusmeler || []).find((x) => x.id === g.id) || g; // panel bu arada yeniden yüklendiyse güncel kaydı kullan
        try { await dosyaDepo.koy(sid, blob); g.ses = { id: sid, boyut: blob.size, sn }; g.sure = `${Math.floor(sn / 60)} dk ${sn % 60} sn`; iz(g.dosyaId, `Görüşme ses kaydı alındı (${g.sure})`); bildir('Ses kaydı bu bilgisayarda saklandı.'); }
        catch (_) { bildir('Ses kaydı saklanamadı.'); }
        kaydet();
      };
      rec.start(1000);
      kayit = { g, rec, parcalar, bas: Date.now(), akis };
      ciz();
    } catch (e) { bildir('Mikrofon açılamadı. Chrome\'un mikrofon iznini verin ya da görüşme metnini elle girin.'); }
  }
  function kayitDurdur() { if (kayit && kayit.rec.state !== 'inactive') kayit.rec.stop(); }
  // Çizimden sonra ses oynatıcılarına dosyayı bağla
  async function sesleriBagla() {
    for (const el of document.querySelectorAll ? document.querySelectorAll('audio[data-ses]:not([src])') : []) {
      const b = await dosyaDepo.al(el.dataset.ses).catch(() => null);
      if (b) el.src = URL.createObjectURL(b);
    }
  }

  // Görüşme kaydı şimdilik menüde yok (Berk, 2026-11-23): ses→metin ve konuşmacı ayırma ayrı bir teknik iş, öncelik değil.
  // Geri açmak için panel.html menüsüne data-sayfa="gorusme" düğmesini eklemek yeter.
  function gorusmeSayfa() {
    const l = D.elle.gorusmeler || [];
    const g = l.find((x) => x.id === D.gorusme) || l[0];
    const muvAd = (mid) => muvekkilBul(mid)?.ad || '—';
    const DURUM = { transkript: '<span class="rozet r-teb">Özet bekliyor</span>', onaylandi: '<span class="rozet r-yesil">Onaylandı</span>', bekliyor: D.mod === 'demo' ? '<span class="rozet r-gri">Metne çevriliyor</span>' : '<span class="rozet r-gri">Metin bekliyor</span>' };
    let detay = '';
    if (g) {
      detay = `<div class="blok"><div class="baslik kucuk-baslik"><div><h2>${esc(muvAd(g.muvekkilId))} · ${UA.trTarih(UA.tarihCoz(g.tarih))}</h2><div class="kucuk soluk">${esc(dosyaAdi(g.dosyaId))} · ${esc(g.sure || '')}</div></div>${DURUM[g.durum] || ''}</div>
        <div class="riza"><b>Açık rıza:</b> ${g.riza?.alindi ? `alındı (${esc(g.riza.zaman)}) · ${esc(g.riza.yontem)}` : 'alınmadı — kayıt başlatılamaz'}</div>
        ${kayit && kayit.g.id === g.id ? `<div class="kontrol gec ust-bosluk"><b>● Kayıt sürüyor</b> (başlangıç ${new Date(kayit.bas).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}) <button class="dugme" data-eylem="kayit-dur">Kaydı durdur</button></div>` : ''}
        ${g.ses ? `<div class="ust-bosluk"><audio controls data-ses="${esc(g.ses.id)}" style="width:100%"></audio><div class="yan kucuk soluk">Ses kaydı yalnız bu bilgisayarda (${Math.round(g.ses.boyut / 1024)} KB). <button class="link" data-eylem="ses-ac" data-b="${esc(g.ses.id)}">Ayrı aç</button> <button class="link" data-eylem="ses-sil" data-id="${esc(g.id)}">Ses kaydını sil</button></div></div>` : ''}
        ${g.durum === 'bekliyor' && D.mod === 'demo' ? bos('Üründe ses kaydı konuşma tanıma servisiyle metne çevrilir. Bu demoda örnek görüşmeyi açarak akışın devamını görebilirsiniz.') : g.durum === 'bekliyor' ? `
        <form class="ust-bosluk" data-form="transkript" data-id="${esc(g.id)}"><label class="dikey">Görüşme metni<textarea name="metin" id="tr-${esc(g.id)}" rows="10" placeholder="Her satıra bir konuşma:&#10;Avukat: …&#10;Müvekkil: …"></textarea></label>
          <p class="kucuk soluk">Otomatik yazıya çevirme henüz yok: tarayıcının hazır çevirisi sesi dışarıya (Google'a) gönderdiği için kullanılmıyor. Kaydı dinleyip metni buraya yazın ya da yapıştırın.</p>
          <button class="dugme">Metni kaydet</button></form>` : `
        <details ${D.ozetAcik ? '' : 'open'}><summary>Transkript (${(g.transkript || []).length} konuşma)</summary><div class="transkript">${(g.transkript || []).map(([k, s]) => `<p><b>${esc(k)}:</b> ${esc(s)}</p>`).join('')}</div></details>
        ${g.durum === 'transkript' && !g.ozet && D.mod !== 'demo' ? ozetElleFormu(g) : ''}
        ${g.durum === 'transkript' && !D.ozetAcik && D.anonimAdim !== g.id && D.mod === 'demo' ? `<button class="dugme ust-bosluk" data-eylem="anonim-onizle" data-id="${esc(g.id)}">Özeti ve kronolojiyi çıkar</button>` : ''}
        ${g.durum === 'transkript' && !D.ozetAcik && D.anonimAdim === g.id ? anonimKutusu(g) : ''}
        ${(D.ozetAcik || g.durum === 'onaylandi') && g.ozet ? ozetFormu(g) : ''}`}
      </div>`;
    }
    const muvSec = D.mod === 'demo' ? muvekkiller().filter((m) => !m.sanal) : muvekkiller();
    return `<div class="baslik"><div><h1>Görüşmeler</h1><div class="soluk">Rıza alınmadan kayıt başlamaz. Özet, avukat onaylamadan müvekkil geçmişine girmez.</div></div></div>
      <div class="gorusme-duzen">
        <div>
          <div class="blok"><h2>Kayıtlar</h2><ul class="liste">${l.map((x) => `<li class="tikla ${x.id === g?.id ? 'secili' : ''}" data-eylem="gorusme-sec" data-id="${esc(x.id)}"><div class="ana"><b>${esc(muvAd(x.muvekkilId))}</b><div class="kucuk soluk">${UA.trTarih(UA.tarihCoz(x.tarih))} · ${esc(x.sure || '')}</div></div>${DURUM[x.durum] || ''}</li>`).join('') || bos('Görüşme yok.')}</ul></div>
          <form class="blok" data-form="gorusme"><h2>Yeni görüşme</h2>
            <label class="dikey">Müvekkil<select name="muvekkil" id="g-muv" required>${muvSec.map((m) => `<option value="${esc(m.id)}">${esc(m.ad)}</option>`).join('')}</select></label>
            ${D.mod === 'demo' ? '' : `<label class="dikey">Dosya (isteğe bağlı)<input name="dosya-ara" id="g-dosya-ara" list="g-dosyalar" placeholder="Boşsa müvekkilin ilk dosyası"></label><datalist id="g-dosyalar">${Object.keys(D.db.dosyalar).filter(acikMi).map((x) => `<option value="${esc(dosyaAdi(x))}">`).join('')}</datalist>`}
            <label class="secim ust-bosluk"><input type="checkbox" name="riza" id="g-riza" required> Müvekkil aydınlatma metnini okudu ve kayda açık rıza verdi</label>
            ${D.mod === 'demo' ? '' : '<label class="secim"><input type="checkbox" name="ses" id="g-ses" checked> Sesi bu bilgisayarda kaydet (mikrofon izni istenir)</label>'}
            <button class="dugme ust-bosluk" ${kayit ? 'disabled' : ''}>Kaydı başlat</button>
            <p class="kucuk soluk">Rıza kutusu işaretlenmeden kayıt başlamaz. Rızanın zamanı ve yöntemi kayda eklenir. Ses kaydı hiçbir yere gönderilmez${D.elle.ayarlar?.sesSaklamaGun ? `; ${D.elle.ayarlar.sesSaklamaGun} gün sonra kendiliğinden silinir` : ''}.</p>
          </form>
        </div>
        <div>${detay || bos('Soldan bir görüşme seçin.')}</div>
      </div>`;
  }

  // Yapay zekâya gidecek her metin önce Kartı anonimleştirme kurallarıyla bu bilgisayarda maskelenir.
  // Bir dosyanın kişilerinden anonimleştirme listesi: [Müvekkil], [Karşı taraf A…], [Avukat] + elle eklenen adlar.
  function kisiListesi(dosyaId, muvAd, ekler = []) {
    const taraf = (D.db.taraflar[dosyaId] || []).filter((t) => t.adi && !/\*{2,}/.test(t.adi)); // UYAP'ın yıldızladığı adlar zaten gizli
    const ad = (s) => { const p = String(s).trim().split(/\s+/); return p.length > 1 && p[0].length >= 3 && !/a\.ş|ltd|şti/i.test(s) ? `${s}; ${p[0]}` : s; };
    const satir = [];
    if (muvAd) satir.push(`[Müvekkil] = ${ad(muvAd)}`);
    let i = 0;
    for (const t of taraf) if (UA.normal(t.adi) !== UA.normal(muvAd)) satir.push(`[Karşı taraf ${String.fromCharCode(65 + (i++ % 26))}${i > 26 ? Math.ceil(i / 26) : ''}] = ${ad(t.adi)}`);
    const avk = D.elle.ayarlar?.avukatAdi || (D.elle.dosyalar[dosyaId]?.bizimAdlar || [])[0];
    if (avk) { const yalin = String(avk).replace(/^\s*av\.?\s*/i, '').trim(); satir.push(`[Avukat] = Av. ${yalin}; ${yalin}`); }
    ekler.forEach((x, k) => satir.push(/^\s*\[[^\]]+\]\s*=/.test(x) ? x : `[Kişi ${k + 1}] = ${ad(x)}`));
    return satir.join('\n');
  }
  const anonimListe = (g) => kisiListesi(g.dosyaId, muvekkilBul(g.muvekkilId)?.ad);
  const anonimHazirla = (g) => UA.anonimlestir((g.transkript || []).map(([k, x]) => `${k}: ${x}`).join('\n'), anonimListe(g));
  // "Gözden kaçmış olabilir" uyarısından, yalnız hukuk/UYAP terimlerinden oluşan ifadeleri çıkar (Dava Dosyası, Tebliğ Mazbatası…).
  const HUKUK_TERIM = new Set('dosya dosyası dosyasi bilgileri bilgisi dava davası davasi dilekçe dilekçesi tebliğ tebliği tebligat mazbata mazbatası tutanak tutanağı tutanagi inceleme ön karar kararı ara rapor raporu bilirkişi bilirkişinin duruşma duruşması duruşmasi tahkikat hukuk asliye ticaret iş icra ceza idare vergi sulh mahkeme mahkemesi dairesi daire genel kurul yargıtay danıştay bölge adliye istinaf temyiz cevap replik düplik beyan itiraz istem talep sonuç açıklamalar deliller tanık listesi liste ihtarname vekalet vekâlet vekaletname harç gider avans masraf makbuz tahsilat reddiyat müzekkere yazı cevabı tensip zaptı zabıt keşif ihale satış haciz ödeme emri takip talebi kesin süre uyap e-tebliğ kapalı açık taşınmaz tasinmaz şerh serh ekleme eklenmesi kaldırma evrakı evraki evrak nüfus nufus kayıt kayit örneği ornegi örnegi taşıt tasit mahrumiyet bankadan banka gelen giden dönüş donus yazısı yazisi sorgu sorgusu sonucu kurum talep talebi tensip muhtıra muhtira icra icrası bilgi bilgileri adres araştırma arastirma tapu sgk emniyet trafik maaş maas menkul gayrimenkul kıymet kiymet takdir rapor raporu tutanak tutanağı tutanagi tebliğ tebligi mazbatası mazbatasi'.split(' '));
  // Kartı'nın kuralı cümle başındaki büyük harfli ikilileri atlar ("…yapıldı. Ayşe Demir de…"); onları da uyarıya ekle.
  const CUMLE_BASI_GENEL = new Set('bu şu o bir her hiç ancak ayrıca ayrica fakat ama ve veya ile ki çünkü cunku zira dolayısıyla dolayisiyla buna göre gore sayın sayin yukarıda yukarida aşağıda asagida müvekkil müvekkilimiz davacı davalı davali davaci karşı taraf vekil vekili sonuç sonuc saygılarımızla tarih imza ek ekler not sonra önce once daha bey hanım hanim efendi konu tanık tanik şahit sahit bilirkişi bilirkisi mahkeme hakim hâkim savcı savci borçlu borclu alacaklı alacakli muris mirasçı mirasci vekil vekili sayın'.split(' '));
  const cumleBasiAdlar = (t) => [...String(t || '').replace(/\[[^\]\n]{1,40}\]/g, (x) => ' '.repeat(x.length)).matchAll(/(?:^|[.!?:]\s+|\n\s*)([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}[ \t]+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,})(?=[\s,.;:!?)]|$)/g)]
    .map((m) => m[1]).filter((x) => !x.toLocaleLowerCase('tr-TR').split(/\s+/).some((w) => CUMLE_BASI_GENEL.has(w)))
    .map((deger) => ({ tur: 'Cümle başında ad olabilir', deger }));
  const supheliSuz = (l, metin, beyaz) => {
    const bilinen = (beyaz || []).map(UA.normal).filter(Boolean);
    const hepsi = [...(l || []), ...cumleBasiAdlar(metin)].filter((x) => { const k = UA.normal(x.deger); return !bilinen.some((b) => b.includes(k)); }), gor = new Set();
    return hepsi.filter((x) => { const k = UA.normal(x.deger); if (gor.has(k)) return false; gor.add(k); return true; })
      .filter((x) => !String(x.deger).toLocaleLowerCase('tr-TR').split(/[\s.,;:/-]+/).filter(Boolean).every((w) => HUKUK_TERIM.has(w)));
  };
  const isaretle = (t) => esc(t).replace(/\[[^\]\n]{1,40}\]/g, (x) => `<mark>${x}</mark>`).replace(/\n/g, '<br>');

  function anonimKutusu(g) {
    const h = anonimHazirla(g);
    return `<div class="anonim-kutu ust-bosluk">
      <h3>Yapay zekâya gidecek metin</h3>
      <div class="kucuk soluk">Metin bu bilgisayarda, Kartı Anonimleştirme Aracı'nın kurallarıyla maskelendi: ${h.sayi} yer etiketlendi (ad ve unvan, TC kimlik, telefon, IBAN, e-posta, adres, dosya no…). Gerçek değerler bilgisayardan çıkmaz.</div>
      <div class="transkript anonim ust-bosluk">${isaretle(h.anonim)}</div>
      ${supheliSuz(h.supheliler, h.anonim).length ? `<div class="kontrol erken"><b>Gözden kaçmış olabilecekler:</b> ${supheliSuz(h.supheliler, h.anonim).map((x) => `${esc(x.deger)} (${esc(x.tur.toLocaleLowerCase('tr-TR'))})`).join(', ')}. Bunlar bir kişiye aitse göndermeyin.</div>` : '<div class="kontrol uyumlu">Metinde kalmış bir ad ya da numara bulunamadı.</div>'}
      <label class="secim ust-bosluk"><input type="checkbox" id="anonim-onay-${esc(g.id)}" data-eylem="anonim-onay" ${D.anonimOnay ? 'checked' : ''}> Metni okudum, kişisel veri kalmadı</label>
      <div class="yan ust-bosluk"><button class="dugme" data-eylem="yz-gonder" data-id="${esc(g.id)}" ${D.anonimOnay ? '' : 'disabled'}>Anonim metni gönder</button><button class="ikincil" data-eylem="anonim-iptal">Vazgeç</button></div>
    </div>`;
  }

  function ozetElleFormu(g) {
    return `<form class="ust-bosluk blok" data-form="ozet-elle" data-id="${esc(g.id)}"><h3>Özet ve kronoloji</h3>
      <p class="kucuk soluk">Yapay zekâ ile özetleme henüz bağlı değil; bağlandığında yalnız bu bilgisayarda anonimleştirilmiş metin gidecek. Şimdilik özeti siz çıkarın, onaydan sonra müvekkil geçmişine girer.</p>
      <label class="dikey">Olaylar (her satır: tarih ve olay, ör. 12.03.2025 İş akdi feshedildi)<textarea name="olaylar" id="oe-ol-${esc(g.id)}" rows="4"></textarea></label>
      <label class="dikey">Talepler<textarea name="talepler" id="oe-ta-${esc(g.id)}" rows="2"></textarea></label>
      <label class="dikey">Önemli beyanlar<textarea name="beyanlar" id="oe-be-${esc(g.id)}" rows="2"></textarea></label>
      <label class="dikey">Takip edilecek işler (her satır: iş ve son tarih)<textarea name="isler" id="oe-is-${esc(g.id)}" rows="2"></textarea></label>
      <button class="dugme">Özeti hazırla</button></form>`;
  }

  function ozetFormu(g) {
    const o = g.ozet, onayli = g.durum === 'onaylandi';
    return `<form data-form="ozet-onay" data-id="${esc(g.id)}" class="ozet">
      <div class="kucuk soluk alt-bosluk">${onayli ? 'Bu özet onaylandı ve müvekkil geçmişine eklendi.' : D.mod !== 'demo' ? 'Özeti kontrol edin. Kronolojiye girmeyecek olayların işaretini kaldırabilir, tarihleri düzeltebilirsiniz.' : 'Yapay zekâ yalnızca anonim metni gördü; dönen özetteki etiketler bu bilgisayarda gerçek adlara çevrildi. Demoda örnek özet gösteriliyor. Metinleri düzeltebilir, kronolojiye girmeyecek olayların işaretini kaldırabilirsiniz.'}</div>
      ${onayli || D.mod !== 'demo' ? '' : (() => { const h = anonimHazirla(g); const metin = [...o.kisiler, ...o.olaylar.map((x) => `${x.tarih}: ${x.olay}`), ...o.talepler, ...o.beyanlar, ...o.isler.map((x) => x.is)].join('\n'); const a = UA.anonimlestir(metin, h.liste, h.esleme); return `<details class="alt-bosluk"><summary class="kucuk">Yapay zekânın gördüğü ve döndürdüğü hâli</summary><div class="transkript anonim">${isaretle(a.anonim)}</div></details>`; })()}
      <h3>Kişiler</h3><ul>${o.kisiler.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
      <h3>Olaylar ve tarihler</h3>
      ${o.olaylar.map((x, i) => `<div class="olay"><input type="checkbox" name="al-${i}" id="al-${esc(g.id)}-${i}" ${onayli ? 'disabled' : ''} checked aria-label="Kronolojiye ekle"><input type="date" name="t-${i}" id="t-${esc(g.id)}-${i}" value="${esc(x.tarih)}" ${onayli ? 'disabled' : ''}><input name="o-${i}" id="o-${esc(g.id)}-${i}" value="${esc(x.olay)}" class="genis-giris" ${onayli ? 'disabled' : ''} aria-label="Olay"></div>`).join('')}
      <h3>Talepler</h3><ul>${o.talepler.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
      <h3>Önemli beyanlar</h3><ul>${o.beyanlar.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
      <h3>Takip edilecek işler</h3><ul>${o.isler.map((k) => `<li>${esc(k.is)} <span class="soluk">· son: ${UA.trTarih(UA.tarihCoz(k.son))}</span></li>`).join('')}</ul>
      ${onayli ? '' : '<button class="dugme ust-bosluk">Onayla ve müvekkil geçmişine ekle</button>'}
    </form>`;
  }

  // ---------- yapay zekâ bağlantısı ----------
  // DENEME: istek bu bilgisayardaki köprüye (urikem-yz/kopru.mjs) gider, köprü oturum açılmış Claude Code'u çağırır.
  // Satılan üründe burası Claude API'ye bağlanacak; panelin geri kalanı değişmez.
  const YZ_ADRES = 'http://127.0.0.1:47811';
  let yzDurumBellek = null;
  async function yzDurum(tazele) {
    if (!tazele && yzDurumBellek && Date.now() - yzDurumBellek.zaman < 30000) return yzDurumBellek.deger;
    let deger;
    try { const r = await fetch(YZ_ADRES + '/durum', { signal: AbortSignal.timeout(8000) }); deger = r.ok ? await r.json() : { hazir: false, hata: `Köprü ${r.status} döndü` }; }
    catch (e) { deger = { hazir: false, hata: e && e.name === 'TimeoutError' ? 'köprü 8 saniyede cevap vermedi' : String(e && e.message || e) }; }
    yzDurumBellek = { zaman: Date.now(), deger };
    return deger;
  }
  // Panel açıkken köprü sonradan açılabilir: bağlı değilse en geç 10 saniyede bir yeniden sor
  let yzSonSoru = 0, yzSoruluyor = false;
  function yzDurumTazele() {
    const bagli = D.yzDurum?.hazir && D.yzDurum?.giris;
    if (bagli || yzSoruluyor || (D.yzDurum !== undefined && Date.now() - yzSonSoru < 10000)) return;
    yzSonSoru = Date.now(); yzSoruluyor = true;
    yzDurum(true).finally(() => { yzSoruluyor = false; }).then((x) => { const degisti = JSON.stringify(x) !== JSON.stringify(D.yzDurum); D.yzDurum = x; if (degisti) sonraCiz(); });
  }
  // Dilekçe ya da arama sayfası açıkken bağlantı yoksa 10 saniyede bir kendiliğinden yeniden dene
  setInterval(() => { if (D.mod !== 'demo' && ['dilekce', 'sorgu'].includes(D.sayfa) && !(D.yzDurum?.hazir && D.yzDurum?.giris)) yzDurumTazele(); }, 10000);
  async function yzUret(sistem, metin, efor = 'high') {
    const r = await fetch(YZ_ADRES + '/uret', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sistem, metin, efor }), signal: AbortSignal.timeout(6 * 60 * 1000) });
    const j = await r.json().catch(() => ({ hata: 'Köprüden geçersiz cevap.' }));
    if (!r.ok || j.hata) throw new Error(j.hata || 'Yapay zekâ cevap vermedi.');
    return j.metin;
  }

  // ---------- dilekçe ----------
  // Akış: dosya + ne yazılacağı → UYAP bilgileriyle istek hazırlanır → bilgisayarda anonimleştirilir →
  // avukat maskeli metni görüp onaylar → Claude yazar → etiketler bilgisayarda gerçek adlara çevrilir →
  // atıflar "doğrulanmadı" diye işaretlenir → avukat düzeltip kopyalar, Word olarak indirir ya da dosyaya kaydeder.
  const DILEKCE_TURLERI = ['Cevap dilekçesi', 'Cevaba cevap (replik) dilekçesi', 'Beyan dilekçesi', 'Bilirkişi raporuna itiraz', 'Tanık listesi', 'İstinaf başvuru dilekçesi', 'Temyiz dilekçesi', 'İcra takibine itiraz', 'İhtarname', 'Diğer'];
  const DILEKCE_SISTEM = `Türk hukukunda deneyimli bir avukatın yanında çalışan, dilekçe yazan bir yardımcısın. Türkçe yazarsın.
Kurallar:
- Metindeki köşeli parantezli etiketler ([Müvekkil], [Karşı taraf A], [Avukat], [Kişi 1], [TCKN-1], [DOSYA NO-1] gibi) gizlenmiş kişisel bilgilerdir. Onları aynen, değiştirmeden kullan; açmaya, tahmin etmeye ya da yeni etiket uydurmaya çalışma.
- Dilekçeyi mahkemeye sunulabilecek düzende yaz: mahkeme başlığı, dosya numarası, taraflar ve vekilleri, konu, açıklamalar (numaralı paragraflar), hukuki nedenler, deliller, sonuç ve istem, tarih ve imza yeri.
- Kanun maddesi anabilirsin. Yargıtay, Danıştay ya da bölge adliye mahkemesi kararı anarsan yalnız gerçekten var olduğundan emin olduklarını an ve her birinin sonuna [DOĞRULANMALI] yaz. Karar künyesi uydurma.
- Süre hesabı yapma, son gün yazma.
- Bilmediğin olgular için uydurma; [...] ile boş bırak ve avukatın tamamlaması gerektiğini belirt.
- Markdown biçimlendirmesi (**, #, ---, tablo) kullanma; düz metin yaz, başlıkları BÜYÜK HARFLE yaz. Metin doğrudan Word'e ve UYAP'a aktarılacak.
- Avukatın dikkat etmesi gereken bir usul sorunu görürsen dilekçenin başına köşeli parantez içinde kısa bir "AVUKAT NOTU" ekle; dilekçenin kendisine sohbet ekleme.`;
  const REVIZE_SISTEM = `Türk hukukunda deneyimli bir avukatın yanında çalışan bir yardımcısın. Avukatın yazdığı dilekçeyi gözden geçirip daha açık, eksiksiz ve usule uygun hâle getirirsin. Türkçe yazarsın.
Kurallar:
- Köşeli parantezli etiketleri ([Müvekkil], [Karşı taraf A], [TCKN-1] gibi) aynen koru; açmaya ya da yeni etiket uydurmaya çalışma.
- Avukatın olgularını ve taleplerini değiştirme; dili, düzeni, eksik bölümleri ve tutarsızlıkları düzelt.
- Karar künyesi uydurma; yeni andığın her yargı kararının sonuna [DOĞRULANMALI] yaz. Süre hesabı yapma.
- Markdown biçimlendirmesi (**, #, tablo) kullanma; düz metin yaz, başlıkları BÜYÜK HARFLE yaz.
- Önce düzeltilmiş dilekçenin tamamını yaz. Sonra tek başına "---" satırı koy ve altına "Yapılan değişiklikler ve avukatın kontrol etmesi gerekenler" başlığıyla kısa maddeler yaz.`;

  function dilekceIstegi(did, v) {
    const d = D.db.dosyalar[did] || {}, e = D.elle.dosyalar[did] || {};
    const taraf = D.db.taraflar[did] || [];
    const ev = (dosyaEvraki()[did] || []).slice(0, 12);
    const dr = durusmalar().filter((x) => x.dosyaId === did).slice(0, 2);
    const satir = ['DOSYA BİLGİLERİ (UYAP)', `Mahkeme: ${d.birimAdi || '—'}`, `Dosya: ${d.dosyaNo || '—'}`, `Dosya türü: ${d.dosyaTur || '—'} · Durum: ${d.dosyaDurum || '—'}`];
    if (d.davaTurleri) satir.push(`Dava türü: ${d.davaTurleri}`);
    if (taraf.length) { satir.push('Taraflar:'); for (const t of taraf) satir.push(`- ${t.rol || 'Taraf'}: ${t.adi}${/kurum|tüzel|tuzel|şirket/i.test(t.kisiKurum || '') ? ' (tüzel kişi)' : /kişi|kisi|gerçek/i.test(t.kisiKurum || '') ? ' (gerçek kişi)' : ''}${UA.normal(t.adi) === UA.normal(e.muvekkil) ? ' (müvekkilimiz)' : ''}${t.vekil ? ` — vekili: ${t.vekil}` : ''}`); }
    const numarasiz = (t) => String(t || '').replace(/\b\d{10,}\b/g, '').replace(/\s{2,}/g, ' ').trim();
    if (ev.length) { satir.push('Dosyadaki son evrak:'); for (const x of ev) { const ac = numarasiz(x.aciklama); satir.push(`- ${UA.trTarih(x.onayTarihi)} ${x.tur}${ac && ac !== x.tur ? ' — ' + ac : ''}`); } }
    if (dr.length) satir.push('Yaklaşan duruşma: ' + dr.map((x) => `${UA.trTarih(x.tarihSaat)} ${x.islem || ''}`).join('; '));
    satir.push('', v.mod === 'revize' ? 'İSTEK: Aşağıdaki dilekçeyi gözden geçir ve düzelt.' : `İSTEK: ${v.tur} yaz.`);
    if (v.talimat) satir.push('Avukatın notları:', v.talimat);
    if (v.mod === 'revize') satir.push('', 'MEVCUT DİLEKÇE:', v.mevcut || '');
    // Karşı taraf vekilleri de maskelensin
    const vekiller = [...new Set(taraf.map((t) => t.vekil).filter(Boolean).flatMap((x) => String(x).split(/,|;| ve /)).map((x) => x.replace(/^\s*av\.?\s*/i, '').trim()).filter((x) => x.length > 4 && !/\*{2,}/.test(x) && UA.normal(x) !== UA.normal(D.elle.ayarlar?.avukatAdi || '')))];
    const ekler = [...(v.ekler || []), ...vekiller.map((x, i) => `[Vekil ${i + 1}] = ${x}`)];
    const beyaz = [d.birimAdi, String(d.birimAdi || '').replace(/ (Mahkemesi|Dairesi)$/i, ''), d.dosyaTur, d.davaTurleri, ...ev.map((x) => x.tur), ...ev.map((x) => x.tip)].filter(Boolean);
    return { metin: satir.join('\n'), liste: kisiListesi(did, e.muvekkil, ekler), beyaz };
  }
  // Karar künyesi geçen satırları bul (… 2019/1234 E., 2020/5678 K. …); satırın tamamını göster, uzunsa kısalt.
  const atifBul = (t) => [...new Set(String(t).split('\n').filter((x) => /\b\d{4}\s*\/\s*\d+\s*E\.?[^\n]*?\d{4}\s*\/\s*\d+\s*K\.?/.test(x)).map((x) => { x = x.trim(); return x.length > 220 ? x.slice(0, 217) + '…' : x; }))];

  function dilekceSayfa() {
    const k = (D.dilekce = D.dilekce || { mod: 'yeni', tur: DILEKCE_TURLERI[0] });
    yzDurumTazele();
    const yz = D.yzDurum;
    const did = k.dosya && Object.keys(D.db.dosyalar).find((x) => dosyaAdi(x) === k.dosya);
    const kayitli = did ? ((D.elle.dilekceler || {})[did] || []) : [];
    const dosyaSecenek = Object.keys(D.db.dosyalar).sort((x, y) => (acikMi(y) - acikMi(x)) || dosyaAdi(x).localeCompare(dosyaAdi(y), 'tr')).map((x) => `<option value="${esc(dosyaAdi(x))}">`).join('');
    const yzSatir = yz?.hazir && yz.giris ? `<div class="kontrol uyumlu alt-bosluk"><b>Yapay zekâ bağlı:</b> ${esc(yz.kaynak || 'Claude')}. Claude'a yalnız maskelenmiş metin gider.</div>`
      : yz?.hazir ? '<div class="kontrol erken alt-bosluk"><b>Claude Code oturumu kapalı.</b> Terminalde <code>claude auth login</code> ile giriş yapın, sonra bu sayfayı yenileyin.</div>'
      : D.mod === 'demo' ? '<div class="kontrol erken alt-bosluk"><b>Demo:</b> burada gerçek yapay zekâ çağrılmaz; akışı göstermek için örnek bir dilekçe üretilir.</div>'
      : `<div class="kontrol gec alt-bosluk"><b>Yapay zekâ köprüsüne bağlanılamadı.</b> <code>urikem-yz/yz-baslat.command</code> dosyasına çift tıklayıp pencereyi açık bırakın; panel birkaç saniye içinde kendisi bağlanır ya da <button class="link" data-eylem="yz-yenile">şimdi yeniden deneyin</button>.${yz?.hata ? `<div class="kucuk soluk ust-bosluk">Hata: ${esc(yz.hata)}</div>` : ''}</div>`;
    const h = k.hazirlik;
    return `<div class="baslik"><div><h1>Dilekçe</h1><div class="soluk">Dosyanın UYAP bilgileriyle dilekçe taslağı yazdırın ya da kendi dilekçenizi gözden geçirtin. Müvekkil bilgileri gönderilmeden önce bu bilgisayarda maskelenir; siz onaylamadan hiçbir şey gönderilmez.</div></div></div>
      ${yzSatir}
      <div class="iki">
        <form class="blok" data-form="dilekce"><h2>1. Ne yazılsın?</h2>
          <fieldset><legend class="gizli">İşlem</legend><span class="yan"><label class="secim"><input type="radio" name="mod" value="yeni" ${k.mod !== 'revize' ? 'checked' : ''}> Yeni taslak</label><label class="secim"><input type="radio" name="mod" value="revize" ${k.mod === 'revize' ? 'checked' : ''}> Dilekçemi gözden geçir</label></span></fieldset>
          <label class="dikey">Dosya<input name="dosya" id="dl-dosya" list="dl-dosyalar" required value="${esc(k.dosya || '')}" placeholder="Mahkeme ve dosya no ile arayın"><datalist id="dl-dosyalar">${dosyaSecenek}</datalist></label>
          <label class="dikey">Dilekçe türü<select name="tur" id="dl-tur">${DILEKCE_TURLERI.map((t) => `<option ${t === k.tur ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="dikey">Notlarınız: olaylar, talepler, dayanaklar<textarea name="talimat" id="dl-talimat" rows="6" placeholder="ör. Davacı fazla mesai alacağı istiyor; müvekkil şirket fazla mesai yaptırmadığını, puantajların imzalı olduğunu savunuyor. Zamanaşımı itirazı da eklensin.">${esc(k.talimat || '')}</textarea></label>
          <label class="dikey">Gözden geçirilecek dilekçe (yalnız "Dilekçemi gözden geçir" için)<textarea name="mevcut" id="dl-mevcut" rows="6">${esc(k.mevcut || '')}</textarea></label>
          <label class="dikey">Ayrıca gizlenecek adlar<textarea name="ekler" id="dl-ekler" rows="2" placeholder="Her satıra bir ad: tanık, şirket, yer…">${esc((k.ekler || []).join('\n'))}</textarea></label>
          <button class="dugme">Gönderilecek metni hazırla</button>
        </form>
        <div>
          ${h ? `<div class="blok"><div class="baslik kucuk-baslik"><h2>2. Claude'a gidecek metin</h2><span class="kucuk soluk">${h.sonuc.sayi} yer maskelendi</span></div>
            <details ${k.cevap ? '' : 'open'}><summary class="kucuk">Maskeli metni göster</summary><div class="transkript anonim">${isaretle(h.sonuc.anonim)}</div></details>
            ${supheliSuz(h.sonuc.supheliler, h.sonuc.anonim, h.beyaz).length ? `<div class="kontrol erken ust-bosluk"><b>Gözden kaçmış olabilecekler:</b> ${supheliSuz(h.sonuc.supheliler, h.sonuc.anonim, h.beyaz).map((x) => esc(x.deger)).join(', ')}. Bir kişiye aitse "Ayrıca gizlenecek adlar"a ekleyip yeniden hazırlayın.</div>` : '<div class="kontrol uyumlu ust-bosluk">Metinde kalmış bir ad ya da numara bulunamadı.</div>'}
            ${k.cevap ? '' : `<label class="secim ust-bosluk"><input type="checkbox" data-eylem="dl-onay" id="dl-onay" ${k.onay ? 'checked' : ''}> Metni okudum, kişisel veri kalmadı</label>
            <div class="yan ust-bosluk"><button class="dugme" data-eylem="dl-gonder" ${k.onay && !k.bekliyor ? '' : 'disabled'}>${k.bekliyor ? 'Claude yazıyor… (1–3 dakika)' : 'Claude\'a gönder'}</button></div>`}
            ${k.hata ? `<div class="kontrol gec ust-bosluk">${esc(k.hata)}</div>` : ''}
          </div>` : bos('Formu doldurup "Gönderilecek metni hazırla"ya basın. Claude\'a gidecek maskeli metni burada görüp onaylarsınız.')}
          ${k.cevap != null ? `<div class="blok"><div class="baslik kucuk-baslik"><h2>3. Dilekçe</h2>${k.demoCikti ? '<span class="rozet r-gri">Demo örneği</span>' : ''}</div>
            ${k.atiflar?.length ? `<div class="kontrol gec alt-bosluk"><b>Doğrulanmamış ${k.atiflar.length} karar atfı var.</b> Yapay zekâ gerçekte olmayan karar numarası yazabilir. Her birini esas ve karar numarasıyla Yargıtay Karar Arama (karararama.yargitay.gov.tr) ya da UYAP Emsal (emsal.uyap.gov.tr) üzerinde arayın; bulamazsanız ya da karar o yönde değilse o cümleyi silin.<ul>${k.atiflar.map((x) => `<li class="kucuk">${esc(x)}</li>`).join('')}</ul></div>` : ''}
            ${k.kalanEtiket?.length ? `<div class="kontrol erken alt-bosluk">Çevrilemeyen etiketler: ${k.kalanEtiket.map(esc).join(', ')}. Bunları elle doldurun.</div>` : ''}
            <label class="dikey">Düzenleyebilirsiniz<textarea id="dl-cikti" data-eylem="dl-duzenle" rows="22">${esc(k.cevap)}</textarea></label>
            <div class="yan ust-bosluk"><button class="dugme" data-eylem="dl-kopyala">Kopyala</button>${indirmeVar ? '<button class="ikincil" data-eylem="dl-word">Word olarak indir</button>' : ''}${did ? '<button class="ikincil" data-eylem="dl-kaydet">Dosyaya taslak olarak kaydet</button>' : ''}<button class="ikincil" data-eylem="dl-yeni">Yeni dilekçe</button></div>
            <p class="kucuk soluk">Bu bir taslaktır. Olguları, talepleri, kanun maddelerini ve atıfları kontrol etmeden kullanmayın.</p></div>` : ''}
          ${kayitli.length ? `<div class="blok"><h2>Bu dosyanın taslakları</h2><ul class="liste">${kayitli.slice().reverse().map((x) => `<li><div class="tarih">${UA.trTarih(x.tarih)}<div class="kucuk soluk">${UA.trSaat(x.tarih)}</div></div><div class="ana">${esc(x.tur)}<div class="kucuk soluk">${esc(String(x.metin).slice(0, 90))}…</div></div><button class="link" data-eylem="dl-ac" data-id="${esc(x.id)}">Aç</button></li>`).join('')}</ul></div>` : ''}
        </div>
      </div>`;
  }
  function dilekceDemoCikti(h, v) {
    return `[Mahkeme başlığı — dosyadaki mahkeme]\nDOSYA NO: [DOSYA NO-1]\n\nDAVALI: [Müvekkil]\nVEKİLİ: Av. [Avukat]\nDAVACI: [Karşı taraf A]\n\nKONU: ${v.mod === 'revize' ? 'Dilekçenin gözden geçirilmiş hâli.' : v.tur + '.'}\n\nAÇIKLAMALAR:\n1. [Karşı taraf A] tarafından açılan davada ileri sürülen iddialar kabul edilmemektedir.\n2. ${v.talimat ? String(v.talimat).slice(0, 300) : '[Avukatın notlarına göre doldurulacak olgular]'}\n3. Yargıtay 9. Hukuk Dairesi'nin 2019/1234 E., 2020/5678 K. sayılı kararı da bu yöndedir. [DOĞRULANMALI]\n\nHUKUKİ NEDENLER: 4857 sayılı İş Kanunu, HMK ve ilgili mevzuat.\nDELİLLER: Puantaj kayıtları, bordrolar, tanık beyanları, bilirkişi incelemesi ve her türlü yasal delil.\n\nSONUÇ VE İSTEM: Yukarıda açıklanan nedenlerle davanın reddine, yargılama giderleri ile vekâlet ücretinin karşı tarafa yükletilmesine karar verilmesini saygıyla arz ve talep ederiz.\n\n[Tarih]\nDavalı [Müvekkil] Vekili\nAv. [Avukat]`;
  }
  const markdownSil = (t) => String(t).replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/^\s*-{3,}\s*$/gm, '');
  function dilekceSonucIsle(k, ham) {
    ham = markdownSil(ham);
    k.cevapHam = ham;
    k.cevap = UA.geriCevir(ham, k.hazirlik.sonuc).replace(/\bAv\.\s*Av\.\s*/g, 'Av. ');
    k.kalanEtiket = [...new Set((k.cevap.match(/\[(?:Müvekkil|Avukat|Karşı taraf [A-Z]\d*|Kişi \d+|Vekil \d+|[A-ZÇĞİÖŞÜ-]+-\d+)\]/g) || []))];
    k.atiflar = atifBul(k.cevap);
  }

  // ---------- hatırlatmalar ----------
  function epostaMetni() {
    const t = (d) => UA.trTarih(d).slice(0, 5);
    const dr = durusmalar().filter((d) => gunFarki(d.tarihSaat) <= 7);
    const sr = sureler().filter((s) => s.kalan >= 0 && s.kalan <= 14);
    const yeni = okunmamis(), suresiz = suresizTebligat(), biten = avansiBiten();
    const b = [`Urikem Legal — Günlük özet (${UA.trTarih(new Date())})`, ''];
    b.push('DURUŞMALAR (7 GÜN)'); b.push(...(dr.length ? dr.map((d) => `• ${t(d.tarihSaat)} ${UA.trSaat(d.tarihSaat)} — ${kisaBirim(d.birim)} ${d.dosyaNo} — ${d.islem || ''}`) : ['• Yok'])); b.push('');
    b.push('SON GÜNÜ YAKLAŞAN İŞLER (son gün sizin girdiğiniz)'); b.push(...(sr.length ? sr.map((s) => `• ${t(s.sonGun)} (${kalanMetin(s.kalan)}) — ${s.aciklama || s.evrak.tur} — ${dosyaAdi(evrakDosya(s.evrak))}${s.kontrol?.durum === 'gec' ? '  ⚠ KONTROL: girilen tarih hesaptan ' + s.kontrol.fark + ' gün sonra' : ''}`) : ['• Yok'])); b.push('');
    if (suresiz.length) { b.push('SON GÜNÜ GİRİLMEMİŞ TEBLİGATLAR'); b.push(...suresiz.map((e) => `• ${dosyaAdi(evrakDosya(e))} — ${e.tur} (${t(e.onayTarihi)})`)); b.push(''); }
    b.push(`YENİ EVRAK (${yeni.length})`); b.push(...(yeni.length ? yeni.map((e) => `• ${dosyaAdi(evrakDosya(e))} — ${e.tur}`) : ['• Yok'])); b.push('');
    if (biten.length) { b.push('AVANSI BİTEN DOSYALAR'); b.push(...biten.map((x) => `• ${D.elle.dosyalar[x.id]?.muvekkil || dosyaAdi(x.id)} — ${UA.tl(x.p.bekleyen)} tahsil edilecek`)); b.push(''); }
    b.push('Bu özet UYAP\'ta son okunan bilgilere dayanır. Süreleri kendiniz de kontrol edin.');
    return b.join('\n');
  }

  function hatirlatmaSayfa() {
    const a = Object.assign({ eposta: '', ortakEposta: '', saat: '08:00', kademeler: [7, 3, 1], gunlukOzet: true, ortagaBildir: true }, D.elle.ayarlar || {});
    const plan = [];
    for (const s of sureler().filter((x) => x.kalan >= 0)) {
      for (const k of a.kademeler) { const g = UA.tarihCoz(s.sonGun); g.setDate(g.getDate() - k); if (UA.gun(g) >= bugun()) plan.push({ zaman: g, ne: `${k} gün kala: ${s.aciklama || s.evrak.tur}`, dosya: dosyaAdi(evrakDosya(s.evrak)), kime: a.eposta }); }
      if (a.ortagaBildir) plan.push({ zaman: UA.tarihCoz(s.sonGun), ne: `Son gün sabahı, tamamlandı işaretlenmediyse: ${s.aciklama || s.evrak.tur}`, dosya: dosyaAdi(evrakDosya(s.evrak)), kime: `${a.eposta}, ${a.ortakEposta}` });
    }
    plan.sort((x, y) => x.zaman - y.zaman);
    const m = epostaMetni();
    return `<div class="baslik"><div><h1>Hatırlatmalar</h1><div class="soluk">Sabah özeti, son güne 7-3-1 gün kala uyarı ve takvim kaydı.</div></div></div>
      <div class="iki">
        <div>
          <form class="blok" data-form="ayarlar"><h2>Ayarlar</h2>
            <label class="dikey">UYAP'ta görünen adınız<input name="avukatAdi" id="a-ad" value="${esc(a.avukatAdi || '')}" placeholder="ör. Ayşe Yılmaz"><span class="kucuk soluk">Müvekkillerinizi Taraflar sekmesindeki vekil bilgisinden tanımak için.</span></label>
            <label class="dikey">Büromuzda ödeme yapanlar<textarea name="buro" id="a-buro" rows="3" placeholder="Her satıra bir ad: ortak avukat, stajyer, sekreter…">${esc((a.buro || []).join('\n'))}</textarea><span class="kucuk soluk">UYAP'ta ödeyeni bu adlardan biri olan masraflar da büronun masrafı sayılır.</span></label>
            <label class="dikey">Hatırlatmaların gideceği adres<input type="email" name="eposta" id="a-eposta" value="${esc(a.eposta)}" placeholder="avukat@buro.com"></label>
            <label class="dikey">Sorumlu ortak (son gün sabahı)<input type="email" name="ortakEposta" id="a-ortak" value="${esc(a.ortakEposta)}" placeholder="ortak@buro.com"></label>
            <label class="dikey">Sabah özeti saati<input type="time" name="saat" id="a-saat" value="${esc(a.saat)}"></label>
            <fieldset><legend>Son güne kaç gün kala uyarılsın?</legend><span class="yan">${[14, 7, 3, 1].map((k) => `<label class="secim"><input type="checkbox" name="k-${k}" ${a.kademeler.includes(k) ? 'checked' : ''}> ${k} gün</label>`).join('')}</span></fieldset>
            <label class="secim"><input type="checkbox" name="gunlukOzet" id="a-ozet" ${a.gunlukOzet ? 'checked' : ''}> Her iş günü sabah özeti gönder</label>
            <label class="secim"><input type="checkbox" name="ortagaBildir" id="a-ortaga" ${a.ortagaBildir ? 'checked' : ''}> Son gün sabahı iş tamamlanmadıysa ortağa da bildir</label>
            <button class="dugme ust-bosluk">Kaydet</button>
          </form>
          <div class="blok"><h2>Planlanan uyarılar (${plan.length})</h2>${plan.length ? `<ul class="liste">${plan.slice(0, 12).map((x) => `<li><div class="tarih">${UA.trTarih(x.zaman)}<div class="kucuk soluk">${esc(a.saat)}</div></div><div class="ana"><div>${esc(x.ne)}</div><div class="kucuk soluk">${esc(x.dosya)} → ${esc(x.kime)}</div></div></li>`).join('')}</ul>` : bos('Son günü girilmiş iş olmadığı için planlı uyarı yok.')}</div>
        </div>
        <div>
          <div class="blok"><h2>Yarın sabahki özet e-postası</h2><div class="kucuk soluk alt-bosluk">Kime: ${esc(a.eposta || '—')} · ${esc(a.saat)}</div><pre class="eposta" id="eposta-metni">${esc(m)}</pre>
            <div class="yan"><button class="dugme" data-eylem="eposta-kopyala">Metni kopyala</button><a class="ikincil" href="mailto:${esc(a.eposta)}?subject=${encodeURIComponent('Urikem Legal — günlük özet')}&body=${encodeURIComponent(m)}">E-posta uygulamasında aç</a></div>
            <p class="kucuk soluk">Ürün sürümünde bu e-posta sunucudan her sabah kendiliğinden gönderilir. Prototip, metni kopyalamanızı ya da e-posta uygulamanızda açmanızı sağlar.</p>
          </div>
          ${eklentide ? `<div class="blok"><h2>Bilgisayar bildirimi</h2><p class="kucuk soluk">Chrome açıkken her sabah ${esc(a.saat)}'de bu bilgisayarda bildirim gelir: bugünkü ve yarınki duruşmalar, son güne ${a.kademeler.join(', ')} gün kalan işler, son günü girilmemiş tebligatlar.</p><button class="ikincil" data-eylem="bildirim-dene">Bildirimi şimdi dene</button></div>` : ''}
        </div>
      </div>`;
  }

  // ---------- müvekkil portalı ----------
  function portal() {
    const l = muvekkiller().filter((m) => !m.sanal);
    const m = l.find((x) => x.id === D.portalMuv) || l.find((x) => x.dosyalar.some((id) => D.elle.dosyalar[id]?.paylas)) || l[0];
    if (!m) return bos('Portal için müvekkil yok.');
    const paylasilan = m.dosyalar.filter((id) => D.elle.dosyalar[id]?.paylas);
    const f = finans(paylasilan);
    const dk = D.dokum;
    const hareketSatirlari = paylasilan.flatMap((id) => {
      const p = paraOzet(id);
      const a = p.uyapSatirlar.filter((s) => s.bizim && s.yansit).map((s) => ({ tarih: UA.tarihCoz(s.tarih), dosya: dosyaAdi(id), ac: s.kalem, tur: 'Masraf', tutar: -(+s.tutar || 0) }));
      const b = p.hareketler.filter((h) => h.tur !== 'gider' || h.yansit !== false).map((h) => ({ tarih: UA.tarihCoz(h.tarih), dosya: dosyaAdi(id), ac: h.aciklama, tur: UA.HAREKET[h.tur], tutar: h.tur === 'avans' || h.tur === 'tahsilat' ? +h.tutar : -(+h.tutar) }));
      return [...a, ...b];
    }).filter((x) => (!dk.bas || x.tarih >= UA.tarihCoz(dk.bas)) && (!dk.bit || x.tarih <= UA.tarihCoz(dk.bit))).sort((a, b) => a.tarih - b.tarih);
    let yuru = 0;
    return `<div class="portal">
      <div class="portal-bas"><div><div class="kucuk soluk">Müvekkil portalı · avukatınızın paylaştığı bilgiler</div><h1>Merhaba, ${esc(m.ad)}</h1></div>
        <label class="dikey dar-sec">Müvekkil (önizleme)<select data-eylem="portal-muv" id="portal-muv">${l.map((x) => `<option value="${esc(x.id)}" ${x.id === m.id ? 'selected' : ''}>${esc(x.ad)}</option>`).join('')}</select></label></div>
      ${paylasilan.length ? `
      <div class="kartlar uc">
        ${kart('Ödediğiniz avans ve tahsilatlar', UA.tl(f.tahsil), 'İadeler düşülmüş')}
        ${kart('Kullanılabilir avansınız', UA.tl(f.kullanilabilir), 'Masraflar düşüldükten sonra')}
        ${kart('Ödemeniz gereken', UA.tl(f.bekleyen), f.bekleyen ? 'Avansı aşan masraflar' : 'Bekleyen ödeme yok', f.bekleyen > 0)}
      </div>
      <h2 class="ust-bosluk">Dosyalarınız</h2>
      ${paylasilan.map((id) => { const d = D.db.dosyalar[id]; const sonraki = durusmalar().find((x) => x.dosyaId === id); const sonEvrak = evraklar().filter((e) => evrakDosya(e) === id).slice(0, 3); return `
        <div class="blok"><div class="baslik kucuk-baslik"><div><h2>${esc(d.birimAdi)} · ${esc(d.dosyaNo)}</h2><div class="kucuk soluk">${esc(d.dosyaTur)} · ${esc(d.dosyaDurum)}</div></div>${sonraki ? `<span class="rozet r-yeni">Duruşma ${UA.trTarih(sonraki.tarihSaat)} ${UA.trSaat(sonraki.tarihSaat)}</span>` : ''}</div>
        <div class="kucuk soluk">Son gelişmeler: ${sonEvrak.map((e) => `${UA.trTarih(e.onayTarihi)} ${esc(e.tur)}`).join(' · ') || '—'}</div></div>`; }).join('')}
      <div class="blok"><div class="baslik kucuk-baslik"><h2>Hesap dökümü</h2>
        <form class="yan" data-form="dokum"><label>Başlangıç<input type="date" name="bas" id="dk-bas" value="${esc(dk.bas)}"></label><label>Bitiş<input type="date" name="bit" id="dk-bit" value="${esc(dk.bit)}"></label><button class="ikincil">Uygula</button></form></div>
        ${hareketSatirlari.length ? `<div class="tablo"><table><thead><tr><th>Tarih</th><th>Dosya</th><th>Açıklama</th><th class="sayi">Tutar</th><th class="sayi">Bakiye</th></tr></thead><tbody>${hareketSatirlari.map((x) => { yuru += x.tutar; return `<tr><td>${UA.trTarih(x.tarih)}</td><td class="kucuk">${esc(x.dosya)}</td><td>${esc(x.ac)}<div class="kucuk soluk">${esc(x.tur)}</div></td><td class="sayi">${tutar(x.tutar)}</td><td class="sayi">${tutar(yuru)}</td></tr>`; }).join('')}</tbody></table></div>` : bos('Bu aralıkta hareket yok.')}
        <div class="yan ust-bosluk"><button class="ikincil" data-eylem="excel-dokum">${indirmeVar ? 'Excel olarak indir' : 'Excel\'e kopyala'}</button>${indirmeVar ? '<button class="ikincil" data-eylem="yazdir">Yazdır / PDF</button>' : ''}</div>
      </div>` : bos('Avukatınız henüz bir dosya paylaşmadı. Dosya çekmecesindeki "Müvekkil portalında paylaş" anahtarıyla açılır.')}
      <p class="kucuk soluk">Müvekkil yalnızca avukatın paylaştığı dosyaları ve müvekkile yansıtılan masrafları görür. Büronun iç notları, karşı tarafın ödemeleri ve büroda kalan masraflar portalda görünmez.</p>
    </div>`;
  }

  // ---------- çizim ----------
  const SAYFALAR = { ozet, sorgu: sorguSayfa, durusma: durusmaSayfa, evrak: evrakSayfa, muvekkil: muvekkilSayfa, dosya: dosyaSayfa, para: paraSayfa, gorusme: gorusmeSayfa, dilekce: dilekceSayfa, hatirlatma: hatirlatmaSayfa };
  function ciz() {
    nesil++;
    document.body.dataset.ekran = D.gorunum;
    document.querySelectorAll('[data-gorunum]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.gorunum === D.gorunum)));
    document.querySelectorAll('[data-mod]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mod === D.mod)));
    const modKutu = $('#mod-kutu'); if (modKutu) modKutu.hidden = !eklentide;
    const ust = $('#ust-sorgu'); if (ust && document.activeElement !== ust.querySelector('input')) ust.querySelector('input').value = D.sayfa === 'sorgu' ? D.sorgu : '';
    const bosVeri = !Object.keys(D.db.dosyalar).length && !Object.keys(D.db.durusmalar).length;
    $('#bant').innerHTML = D.mod === 'demo'
      ? '<div class="bant demo"><b>Demo.</b> Bütün kişi, şirket, dosya numarası ve tutarlar uydurmadır. Gerçek kullanımda dosya, duruşma, evrak ve mahkeme masrafları UYAP\'tan kendiliğinden gelir.</div>'
      : bosVeri ? '<div class="bant bilgi"><b>Henüz veri yok.</b> Özet sayfasındaki kurulum adımlarını izleyin.</div>'
      : '<div class="bant bilgi">Veriler yalnızca bu bilgisayarda. Asistan UYAP\'ta yalnızca okuma yapar; gönderme, kaydetme, ödeme gibi hiçbir işlem yapmaz.</div>';
    const yeniSay = okunmamis().length + suresizTebligat().length * 0, bitenSay = avansiBiten().length, gorSay = (D.elle.gorusmeler || []).filter((g) => g.durum === 'transkript').length;
    document.querySelectorAll('[data-sayfa]').forEach((b) => {
      b.setAttribute('aria-current', b.dataset.sayfa === D.sayfa ? 'page' : 'false');
      const n = { evrak: yeniSay, para: bitenSay, gorusme: gorSay }[b.dataset.sayfa] || 0;
      const s = b.querySelector('.sayac'); if (s) { s.textContent = n; s.hidden = !n; }
    });
    const s = D.db.senkron;
    $('#senkron').innerHTML = `<b>UYAP'tan son okuma</b>${[['Dosyalar', s.dosyalar], ['Duruşmalar', s.durusmalar], ['Evrak', s.evraklar], ['Masraf', s.para]].map(([a, z]) => `<div><span>${a}</span><span>${zamanOnce(z)}</span></div>`).join('')}
      ${D.mod === 'demo' ? '<button class="ikincil" data-eylem="demo-sifirla">Demoyu baştan kur</button>' : D.onay === 'veri-sil' ? '<div class="onay">Bu bilgisayardaki bütün veriler silinsin mi? <button class="dugme tehlike" data-eylem="veri-sil-evet">Sil</button> <button class="ikincil" data-eylem="onay-iptal">Vazgeç</button></div>' : '<button class="ikincil" data-eylem="yedek-al">Yedek al</button><label class="ikincil yedek-yukle">Yedek yükle<input type="file" accept=".json" class="gizli" data-eylem="yedek-yukle"></label><button class="ikincil" data-eylem="veri-sil">Verileri bu bilgisayardan sil</button>'}`;
    $('#icerik').innerHTML = D.gorunum === 'portal' ? portal() : SAYFALAR[D.sayfa]();
    const k = $('#kaplama');
    if (D.cekmece && D.gorunum === 'avukat') { k.hidden = false; k.className = 'kaplama sag'; k.innerHTML = D.cekmece.tur === 'muvekkil' ? muvekkilCekmece(D.cekmece.id) : dosyaCekmece(D.cekmece.id); }
    else if (D.modal) { k.hidden = false; k.className = 'kaplama orta'; k.innerHTML = modalCiz(); }
    else { k.hidden = true; k.innerHTML = ''; }
    const b = $('#bildirim'); b.hidden = !D.bildirim; b.textContent = D.bildirim;
    sesleriBagla();
  }

  function modalCiz() {
    const m = D.modal;
    if (m.tur === 'metin') return `<div class="modal" role="dialog" aria-label="${esc(m.baslik)}"><button class="ikincil kapat" data-eylem="kapat">Kapat</button><h2>${esc(m.baslik)}</h2><p class="kucuk soluk">Tarayıcı panoya kopyalamaya izin vermedi. Metni seçip kopyalayın (Cmd/Ctrl + C).</p><textarea readonly rows="14" id="kopya-alan">${esc(m.metin)}</textarea></div>`;
    if (m.tur === 'yeni-muvekkil') return `<div class="modal" role="dialog" aria-label="Müvekkil ekle"><button class="ikincil kapat" data-eylem="kapat">Kapat</button><h2>Müvekkil ekle</h2>
      <form data-form="muvekkil-ekle" class="dikey-form"><label class="dikey">Ad soyad / unvan<input name="ad" id="m-ad" required></label><label class="dikey">Tür<select name="tur" id="m-tur"><option>Kişi</option><option>Kurum</option></select></label>
      <label class="dikey">Telefon<input name="telefon" id="m-tel"></label><label class="dikey">E-posta<input type="email" name="eposta" id="m-eposta"></label><button class="dugme">Kaydet</button></form></div>`;
    return '';
  }

  // ---------- olaylar ----------
  const kapat = () => { D.cekmece = null; D.modal = null; };
  document.addEventListener('click', async (ev) => {
    if (ev.target.id === 'kaplama') { kapat(); return ciz(); }
    const t = ev.target.closest('[data-mod],[data-sayfa],[data-git],[data-filtre],[data-pfiltre],[data-eylem],[data-sor],[data-gorunum]');
    if (!t || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'button')) return;
    if (t.dataset.gorunum) { D.gorunum = t.dataset.gorunum; kapat(); window.scrollTo(0, 0); return ciz(); }
    if (t.dataset.mod) { if (t.dataset.mod === D.mod) return; D.mod = t.dataset.mod; await koy({ mod: D.mod }); kapat(); await yukle(); return ciz(); }
    if (t.dataset.sayfa || t.dataset.git) { D.sayfa = t.dataset.sayfa || t.dataset.git; D.gorunum = 'avukat'; kapat(); window.scrollTo(0, 0); return ciz(); }
    if (t.dataset.sor) { D.sorgu = t.dataset.sor; D.sayfa = 'sorgu'; D.gorunum = 'avukat'; kapat(); window.scrollTo(0, 0); return ciz(); }
    if (t.dataset.filtre) { D.evrakFiltre = t.dataset.filtre; return ciz(); }
    if (t.dataset.pfiltre) { D.paraFiltre = t.dataset.pfiltre; return ciz(); }
    const id = t.dataset.id;
    switch (t.dataset.eylem) {
      case 'dosya': D.cekmece = { tur: 'dosya', id }; D.modal = null; ciz(); if (t.dataset.bolum === 'para') $('#bolum-para')?.scrollIntoView(); return;
      case 'muvekkil': D.cekmece = { tur: 'muvekkil', id }; D.modal = null; return ciz();
      case 'kapat': kapat(); return ciz();
      case 'yeni-muvekkil': D.modal = { tur: 'yeni-muvekkil' }; return ciz();
      case 'okundu': D.elle.okundu[id] = new Date().toISOString(); return kaydet();
      case 'sure-ac': D.acikSure = id; if (!D.cekmece) { D.sayfa = 'evrak'; D.evrakFiltre = 'teb'; } ciz(); document.getElementById('evrak-' + id)?.scrollIntoView({ block: 'center' }); return;
      case 'sure-kapat': D.acikSure = null; return ciz();
      case 'muvekkil-sec': { const e = dosyaElle(id); e.muvekkil = t.dataset.ad; const m = Object.values(D.elle.muvekkiller || {}).find((x) => x.ad === t.dataset.ad); e.muvekkilId = m ? m.id : undefined; e.otoMuvekkil = false; iz(id, `Müvekkil olarak işaretlendi: ${t.dataset.ad}`); return kaydet(); }
      case 'hareket-sil': { const e = dosyaElle(id), h = e.hareketler.find((x) => x.id === t.dataset.h); e.hareketler = e.hareketler.filter((x) => x.id !== t.dataset.h); if (h) { iz(id, `Silindi: ${UA.HAREKET[h.tur]} ${UA.tl(h.tutar)} — ${h.aciklama}`); if (h.belge?.id) dosyaDepo.sil(h.belge.id).catch(() => {}); } return kaydet(); }
      case 'portal-onizle': D.portalMuv = id; D.gorunum = 'portal'; kapat(); window.scrollTo(0, 0); return ciz();
      case 'gorusme-sec': D.gorusme = id; D.ozetAcik = false; D.anonimAdim = null; D.anonimOnay = false; return ciz();
      case 'ozet-cikar': D.ozetAcik = true; return ciz();
      case 'anonim-onizle': D.anonimAdim = id; D.anonimOnay = false; return ciz();
      case 'anonim-iptal': D.anonimAdim = null; D.anonimOnay = false; return ciz();
      case 'yz-gonder': if (!D.anonimOnay) return; D.anonimAdim = null; D.anonimOnay = false; D.ozetAcik = true; bildir('Yalnızca anonim metin gönderildi. Özet geldi; etiketler gerçek adlara çevrildi.'); return;
      case 'is-bitti': return;
      case 'excel-para': {
        const s = [['Dosya', 'Durum', 'Müvekkil', 'Sorumlu', 'Avukatın ödediği masraf', 'Alınan avans', 'Masraf (yansıtılan)', 'Büroda kalan masraf', 'Tahsilat', 'İade', 'Bakiye', 'Vekâlet ücreti', 'Kapanışta istenecek']];
        for (const did of Object.keys(D.db.dosyalar)) { const p = paraOzet(did), e = D.elle.dosyalar[did] || {}; if (!p.hesapAcik && !p.yansitilan) continue; s.push([dosyaAdi(did), D.db.dosyalar[did]?.dosyaDurum || '', e.muvekkil || '', e.sorumlu || '', sayiTsv(p.uyapOdeme + p.gider), p.hesapAcik ? sayiTsv(p.avans) : '', sayiTsv(p.yansitilan), sayiTsv(p.buroda), p.hesapAcik ? sayiTsv(p.tahsilat) : '', p.hesapAcik ? sayiTsv(p.iade) : '', p.hesapAcik ? sayiTsv(p.bakiye) : 'avans girilmedi', sayiTsv(p.vekalet), sayiTsv(p.kapanistaIstenecek)]); }
        if (indirmeVar) { indir(`masraf-avans-${UA.iso(new Date())}.csv`, csv(s), 'text/csv;charset=utf-8'); return bildir('Excel dosyası indirildi.'); }
        return kopyala(tsv(s), 'Tablo kopyalandı. Excel\'de bir hücreye tıklayıp yapıştırın.');
      }
      case 'excel-dokum': {
        const rows = [...document.querySelectorAll('.portal table tbody tr')].map((tr) => [...tr.children].map((td) => td.innerText.replace(/\n/g, ' ')));
        if (indirmeVar) { indir(`hesap-dokumu-${UA.iso(new Date())}.csv`, csv([['Tarih', 'Dosya', 'Açıklama', 'Tutar', 'Bakiye'], ...rows]), 'text/csv;charset=utf-8'); return bildir('Hesap dökümü indirildi.'); }
        return kopyala(tsv([['Tarih', 'Dosya', 'Açıklama', 'Tutar', 'Bakiye'], ...rows]), 'Hesap dökümü kopyalandı. Excel\'e yapıştırın.');
      }
      case 'belge-ac': return dosyaAc(t.dataset.b, t.dataset.ad);
      case 'yz-yenile': D.yzDurum = await yzDurum(true); return ciz();
      case 'sorgu-yz': return yzSorguYorumla(D.sorgu);
      case 'sorgu-yz-gonder': return yzSorguYorumla(D.sorgu, true);
      case 'sorgu-kural': D.sorguYz = { soru: D.sorgu, bekliyor: false, kuralla: true }; return ciz();
      case 'dl-gonder': {
        const k = D.dilekce; if (!k?.hazirlik || !k.onay || k.bekliyor) return;
        k.bekliyor = true; k.hata = null; ciz();
        const yz = D.yzDurum = await yzDurum(true);
        try {
          let ham;
          if (!yz.hazir && D.mod === 'demo') { await new Promise((r) => setTimeout(r, 1200)); ham = dilekceDemoCikti(k.hazirlik, k); k.demoCikti = true; }
          else ham = await yzUret(k.mod === 'revize' ? REVIZE_SISTEM : DILEKCE_SISTEM, k.hazirlik.sonuc.anonim, 'high');
          dilekceSonucIsle(k, ham);
          if (k.did) iz(k.did, `Yapay zekâyla dilekçe ${k.mod === 'revize' ? 'gözden geçirildi' : 'taslağı yazıldı'}: ${k.tur} (yalnız maskeli metin gönderildi)`), kaydet();
        } catch (e) { k.hata = e.message; }
        k.bekliyor = false; return ciz();
      }
      case 'dl-kopyala': { const t = $('#dl-cikti')?.value ?? D.dilekce?.cevap; return kopyala(t || '', 'Dilekçe kopyalandı.'); }
      case 'dl-word': {
        const t = $('#dl-cikti')?.value ?? D.dilekce?.cevap ?? '';
        const html = `<html><head><meta charset="utf-8"><title>Dilekçe</title></head><body style="font-family:'Times New Roman';font-size:12pt;line-height:1.5">${t.split('\n').map((x) => `<p style="margin:0 0 6pt">${esc(x) || '&nbsp;'}</p>`).join('')}</body></html>`;
        indir(`dilekce-${UA.iso(new Date())}.doc`, html, 'application/msword'); return bildir('Word dosyası indirildi.');
      }
      case 'dl-kaydet': {
        const k = D.dilekce; if (!k?.did) return;
        const t = $('#dl-cikti')?.value ?? k.cevap;
        const l = ((D.elle.dilekceler = D.elle.dilekceler || {})[k.did] = D.elle.dilekceler[k.did] || []);
        l.push({ id: 'dl-' + Date.now(), tarih: new Date().toISOString(), tur: k.tur, mod: k.mod, metin: t });
        iz(k.did, `Dilekçe taslağı kaydedildi: ${k.tur}`); bildir('Taslak dosyaya kaydedildi.'); return kaydet();
      }
      case 'dl-ac': { const k = D.dilekce; const x = ((D.elle.dilekceler || {})[k?.did] || []).find((y) => y.id === id); if (x) { k.cevap = x.metin; k.atiflar = atifBul(x.metin); k.kalanEtiket = []; k.demoCikti = false; } return ciz(); }
      case 'dl-yeni': D.dilekce = { mod: 'yeni', tur: DILEKCE_TURLERI[0] }; return ciz();
      case 'ses-ac': return dosyaAc(t.dataset.b, 'gorusme.webm');
      case 'kayit-dur': return kayitDurdur();
      case 'ses-sil': { const g = D.elle.gorusmeler.find((x) => x.id === id); if (!g?.ses) return; await dosyaDepo.sil(g.ses.id).catch(() => {}); g.ses = null; iz(g.dosyaId, 'Görüşme ses kaydı silindi'); bildir('Ses kaydı bu bilgisayardan silindi.'); return kaydet(); }
      case 'yazdir': return window.print();
      case 'eposta-kopyala': return kopyala(epostaMetni(), 'E-posta metni kopyalandı.');
      case 'ics': {
        const p2 = (x) => String(x).padStart(2, '0'), f = (d) => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`;
        const ev2 = durusmalar().map((d) => { const b = new Date(d.tarihSaat); return `BEGIN:VEVENT\r\nUID:${d.id}@avukat-asistani\r\nDTSTAMP:${f(new Date())}\r\nDTSTART:${f(b)}\r\nDTEND:${f(new Date(b.getTime() + 3600000))}\r\nSUMMARY:Duruşma: ${kisaBirim(d.birim)} ${d.dosyaNo}\r\nDESCRIPTION:${d.islem || ''}\r\nBEGIN:VALARM\r\nTRIGGER:-P1D\r\nACTION:DISPLAY\r\nDESCRIPTION:Yarın duruşma\r\nEND:VALARM\r\nEND:VEVENT`; });
        const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Urikem Legal//TR\r\n${ev2.join('\r\n')}\r\nEND:VCALENDAR`;
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'durusmalar.ics'; a.click(); return;
      }
      case 'demo-sifirla': { const d = UA.demoOlustur(new Date()); await koy({ demoDb: d.db, demoElle: d.elle, demoSurum: DEMO_SURUM, demoGun: UA.iso(new Date()) }); await yukle(); D.ozetAcik = false; bildir('Demo baştan kuruldu.'); return; }
      case 'veri-sil': D.onay = 'veri-sil'; return ciz();
      case 'guncelle': {
        if (!eklentide) return bildir('Bu düğme yalnız Chrome eklentisinde çalışır.');
        const sekmeler = await chrome.tabs.query({ url: 'https://avukat.uyap.gov.tr/*' });
        if (!sekmeler.length) return bildir('Önce e-imzayla UYAP Avukat Portalı\'na girin; sekme açık kalsın.');
        D.senkron = { calisiyor: true, yapilan: 0, toplam: 0, mesaj: 'Başlıyor' }; ciz();
        // Okuma UYAP sekmesinde yürür; Chrome arka plandaki sekmeyi yavaşlattığı için o sekmeyi öne getir.
        try { await chrome.tabs.update(sekmeler[0].id, { active: true }); await chrome.windows.update(sekmeler[0].windowId, { focused: true }); } catch (_) {}
        try { await chrome.tabs.sendMessage(sekmeler[0].id, { tur: 'oku' }); }
        catch (_) { D.senkron = null; bildir('UYAP sekmesine ulaşılamadı. UYAP sekmesini bir kez yenileyip tekrar deneyin.'); }
        return;
      }
      case 'yedek-al': {
        const metin = JSON.stringify({ uygulama: 'urikem-legal', surum: 1, tarih: new Date().toISOString(), db: D.db, elle: D.elle });
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([metin], { type: 'application/json' })); a.download = `urikem-legal-yedek-${UA.iso(new Date())}.json`; a.click(); return bildir('Yedek indirildi. Dekont ve ses dosyaları bu yedeğe dahil değil; onlar bu bilgisayarda kalır.');
      }
      case 'bildirim-dene': try { await chrome.runtime.sendMessage({ tur: 'bildirim-dene' }); bildir('Bildirim gönderildi. Gelmediyse sistem bildirim izinlerini kontrol edin.'); } catch (_) { bildir('Bildirim gönderilemedi.'); } return;
      case 'onay-iptal': D.onay = null; return ciz();
      case 'veri-sil-evet': D.onay = null; await sil(['db', 'elle']); await dosyaDepo.hepsiniSil().catch(() => {}); await yukle(); return bildir('Veriler bu bilgisayardan silindi.');
    }
  });

  document.addEventListener('change', (ev) => {
    const t = ev.target, id = t.dataset.id;
    if (t.dataset.eylem === 'satir-sec') { const e = dosyaElle(id); e.satirSecimi = e.satirSecimi || {}; e.satirSecimi[t.dataset.kayit] = t.checked; iz(id, `UYAP masraf satırı (makbuz ${t.dataset.kayit}) ${t.checked ? '"bizim" işaretlendi' : '"bizim" işareti kaldırıldı'}`); return kaydet(); }
    if (t.dataset.eylem === 'uyap-yansit') { const e = dosyaElle(id); e.uyapYansit = e.uyapYansit || {}; e.uyapYansit[t.dataset.kayit] = t.checked; iz(id, `UYAP masraf satırı ${t.checked ? 'müvekkile yansıtılacak' : 'büroda kalacak'}`); return kaydet(); }
    if (t.dataset.eylem === 'paylas') { dosyaElle(id).paylas = t.checked; iz(id, t.checked ? 'Dosya müvekkil portalında paylaşıldı' : 'Dosya portaldan kaldırıldı'); bildir(t.checked ? 'Dosya müvekkil portalında paylaşıldı.' : 'Dosya portaldan kaldırıldı.'); return kaydet(); }
    if (t.dataset.eylem === 'portal-muv') { D.portalMuv = t.value; return ciz(); }
    if (t.dataset.eylem === 'anonim-onay') { D.anonimOnay = t.checked; return ciz(); }
    if (t.dataset.eylem === 'dl-onay') { if (D.dilekce) D.dilekce.onay = t.checked; return ciz(); }
    if (t.dataset.eylem === 'dl-duzenle') { if (D.dilekce) { D.dilekce.cevap = t.value; D.dilekce.atiflar = atifBul(t.value); } return; }
    if (t.dataset.eylem === 'is-bitti') { const i = (D.elle.isler || []).find((x) => x.id === id); if (i) i.bitti = true; return kaydet(); }
    if (t.dataset.eylem === 'yedek-yukle' && t.files[0]) {
      t.files[0].text().then(async (metin) => {
        try { const y = JSON.parse(metin); if (!['urikem-legal', 'avukat-asistani'].includes(y.uygulama) || !y.db?.surum) throw new Error(); await koy({ db: y.db, elle: y.elle || {} }); await yukle(); bildir('Yedek yüklendi.'); }
        catch (_) { bildir('Bu dosya bir Urikem Legal yedeği değil.'); }
      });
      return;
    }
    if (t.dataset.eylem === 'belge' && t.files[0]) {
      const h = dosyaElle(id).hareketler.find((x) => x.id === t.dataset.h), f = t.files[0], bid = 'b-' + Date.now();
      if (!h) return;
      dosyaDepo.koy(bid, f).then(() => { h.belge = { id: bid, ad: f.name, boyut: f.size, tur: f.type }; iz(id, `Belge eklendi: ${f.name} (${h.aciklama})`); bildir('Belge bu bilgisayarda saklandı.'); return kaydet(); }).catch(() => bildir('Belge saklanamadı.'));
      return;
    }
  });

  document.addEventListener('submit', (ev) => {
    const f = ev.target.closest('form[data-form]');
    if (!f) return;
    ev.preventDefault();
    const fd = new FormData(f), v = Object.fromEntries([...fd.entries()].filter(([, x]) => typeof x === 'string'));
    const id = f.dataset.id;
    switch (f.dataset.form) {
      case 'sorgu': if (!v.q.trim()) return; document.activeElement?.blur?.(); D.sorgu = v.q.trim(); D.sayfa = 'sorgu'; D.gorunum = 'avukat'; kapat(); return ciz();
      case 'sure':
        D.elle.sureler[id] = { tebligTarihi: v.teblig, sure: { miktar: +v.miktar, birim: v.birim }, tabi: v.tabi === 'evet', sonGun: v.songun, aciklama: v.aciklama.trim() };
        D.elle.okundu[id] = D.elle.okundu[id] || new Date().toISOString(); D.acikSure = null;
        { const ev = D.db.evraklar[id]; iz(ev ? evrakDosya(ev) : null, `Son gün girildi: ${UA.trTarih(UA.tarihCoz(v.songun))} — ${v.aciklama.trim() || ev?.tur || ''}`); }
        return kaydet();
      case 'hareket': {
        const belge = fd.get('belge'), bid = belge && belge.name ? 'b-' + Date.now() : null;
        const h = { id: 'h-' + Date.now(), tur: v.tur, kategori: v.tur === 'gider' ? v.kategori : undefined, tarih: v.tarih, aciklama: v.aciklama.trim(), tutar: +v.tutar,
          odeyen: (v.odeyen || '').trim() || undefined, odemeYontemi: v.odemeYontemi, yansit: v.tur === 'gider' ? fd.get('yansit') === 'on' : undefined,
          belge: bid ? { id: bid, ad: belge.name, boyut: belge.size, tur: belge.type } : undefined };
        dosyaElle(id).hareketler.push(h);
        iz(id, `Eklendi: ${UA.HAREKET[h.tur]} ${UA.tl(h.tutar)} — ${h.aciklama}${h.odeyen ? ' (ödeyen: ' + h.odeyen + ')' : ''}`);
        if (bid) dosyaDepo.koy(bid, belge).catch(() => bildir('Belge saklanamadı.'));
        bildir('Hareket eklendi.'); return kaydet();
      }
      case 'vekalet': dosyaElle(id).vekaletUcreti = v.ucret === '' ? null : +v.ucret; iz(id, `Vekâlet ücreti: ${v.ucret === '' ? 'silindi' : UA.tl(+v.ucret)}`); bildir('Vekâlet ücreti kaydedildi.'); return kaydet();
      case 'dilekce': {
        const ekler = String(v.ekler || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
        const did = Object.keys(D.db.dosyalar).find((x) => dosyaAdi(x) === String(v.dosya || '').trim());
        if (!did) return bildir('Dosya bulunamadı. Listeden bir dosya seçin.');
        if (v.mod === 'revize' && !String(v.mevcut || '').trim()) return bildir('Gözden geçirilecek dilekçeyi yapıştırın.');
        const k = { mod: v.mod, dosya: v.dosya, did, tur: v.tur, talimat: v.talimat, mevcut: v.mevcut, ekler };
        const ist = dilekceIstegi(did, k);
        try { k.hazirlik = { sonuc: UA.anonimlestir(ist.metin, ist.liste), beyaz: ist.beyaz }; } catch (e) { return bildir('Metin maskelenemedi: ' + e.message); }
        D.dilekce = k; return ciz();
      }
      case 'devralma': dosyaElle(id).devralma = v.tarih || null; iz(id, v.tarih ? `Dosyayı alma tarihi: ${UA.trTarih(UA.tarihCoz(v.tarih))}` : 'Dosyayı alma tarihi silindi (ilk ödeme kullanılacak)'); bildir('Kaydedildi.'); return kaydet();
      case 'sorumlu': dosyaElle(id).sorumlu = (v.sorumlu || '').trim() || null; iz(id, `Sorumlu avukat: ${(v.sorumlu || '').trim() || '—'}`); bildir('Sorumlu avukat kaydedildi.'); return kaydet();
      case 'transkript': {
        const g = D.elle.gorusmeler.find((x) => x.id === id); if (!g) return;
        g.transkript = String(v.metin || '').split(/\n+/).map((x) => x.trim()).filter(Boolean).map((x) => { const m = x.match(/^([^:]{1,30}):\s*(.+)$/); return m ? [m[1].trim(), m[2].trim()] : ['', x]; });
        if (!g.transkript.length) return;
        g.durum = 'transkript'; iz(g.dosyaId, 'Görüşme metni girildi'); return kaydet();
      }
      case 'ozet-elle': {
        const g = D.elle.gorusmeler.find((x) => x.id === id); if (!g) return;
        const satirlar = (k) => String(v[k] || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
        const tarihAyir = (x) => { const m = x.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})|(\d{4})-(\d{2})-(\d{2})/); const t = m ? (m[4] ? `${m[4]}-${m[5]}-${m[6]}` : `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`) : null; return [t, (m ? x.replace(m[0], '') : x).replace(/^[\s:–—-]+|[\s:–—-]+$/g, '')]; };
        g.ozet = {
          kisiler: [muvekkilBul(g.muvekkilId)?.ad].filter(Boolean),
          olaylar: satirlar('olaylar').map((x) => { const [t, o] = tarihAyir(x); return { tarih: t || UA.iso(UA.tarihCoz(g.tarih) || new Date()), olay: o }; }),
          talepler: satirlar('talepler'), beyanlar: satirlar('beyanlar'),
          isler: satirlar('isler').map((x) => { const [t, o] = tarihAyir(x); return { is: o, son: t || '' }; }),
        };
        D.ozetAcik = true; return kaydet();
      }
      case 'ayarlar':
        D.elle.ayarlar = { avukatAdi: (v.avukatAdi || '').trim(), buro: String(v.buro || '').split(/\n+/).map((x) => x.trim()).filter(Boolean), sesSaklamaGun: D.elle.ayarlar?.sesSaklamaGun || null, eposta: v.eposta, ortakEposta: v.ortakEposta, saat: v.saat, kademeler: [14, 7, 3, 1].filter((k) => fd.get('k-' + k) === 'on'), gunlukOzet: fd.get('gunlukOzet') === 'on', ortagaBildir: fd.get('ortagaBildir') === 'on' };
        if (D.mod === 'canli' && D.elle.ayarlar.avukatAdi) UA.otoMuvekkil(D.db, D.elle, D.elle.ayarlar.avukatAdi);
        if (eklentide && chrome.runtime?.sendMessage) chrome.runtime.sendMessage({ tur: 'alarm-kur' }).catch(() => {});
        iz(null, 'Ayarlar değişti'); bildir('Ayarlar kaydedildi.'); return kaydet();
      case 'dokum': D.dokum = { bas: v.bas, bit: v.bit }; return ciz();
      case 'muvekkil-ekle': {
        const mid = 'm-' + Date.now();
        D.elle.muvekkiller[mid] = { id: mid, ad: v.ad.trim(), tur: v.tur, telefon: v.telefon, eposta: v.eposta, kayit: UA.iso(new Date()) };
        D.modal = null; bildir('Müvekkil eklendi.'); return kaydet();
      }
      case 'gorusme': {
        if (fd.get('riza') !== 'on') return;
        const gid = 'g-' + Date.now();
        const secilen = v['dosya-ara'] && Object.keys(D.db.dosyalar).find((x) => dosyaAdi(x) === v['dosya-ara'].trim());
        const g = { id: gid, muvekkilId: v.muvekkil, dosyaId: secilen || (muvekkilBul(v.muvekkil)?.dosyalar || [])[0], tarih: new Date().toISOString(), sure: '', riza: { alindi: true, zaman: new Date().toLocaleString('tr-TR'), yontem: 'Aydınlatma metni okundu, kutucukla onaylandı' }, durum: 'bekliyor' };
        D.elle.gorusmeler.unshift(g);
        D.gorusme = gid; D.ozetAcik = false; iz(g.dosyaId, 'Görüşme başladı, açık rıza kayda alındı');
        if (D.mod === 'canli' && fd.get('ses') === 'on') kayitBaslat(g);
        bildir('Rıza kaydedildi.'); return kaydet();
      }
      case 'ozet-onay': {
        const g = D.elle.gorusmeler.find((x) => x.id === id);
        if (!g) return;
        const kaynak = `Görüşme · ${UA.trTarih(UA.tarihCoz(g.tarih))} (avukat onaylı)`;
        const liste = (D.elle.kronoloji[g.muvekkilId] = D.elle.kronoloji[g.muvekkilId] || []);
        g.ozet.olaylar.forEach((o, i) => {
          o.tarih = v['t-' + i] || o.tarih; o.olay = (v['o-' + i] || o.olay).trim();
          if (fd.get('al-' + i) === 'on') liste.push({ id: `k-${g.id}-${i}`, tarih: o.tarih, olay: o.olay, kaynak });
        });
        D.elle.isler = D.elle.isler || [];
        for (const [i, x] of g.ozet.isler.entries()) D.elle.isler.push({ id: `${g.id}-is-${i}`, is: x.is, son: x.son, kaynak: `${muvekkilBul(g.muvekkilId)?.ad || ''} görüşmesi` });
        g.durum = 'onaylandi'; D.ozetAcik = false; iz(g.dosyaId, 'Görüşme özeti onaylandı, müvekkil geçmişine eklendi');
        bildir('Özet onaylandı: olaylar müvekkil geçmişine, işler Özet sayfasına eklendi.'); return kaydet();
      }
    }
  });

  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && (D.cekmece || D.modal)) { kapat(); ciz(); } });
  // Kullanıcı bir alana yazarken ekranı yeniden çizme; yazma bitince çiz.
  const yaziyor = () => { const a = document.activeElement; return !!a && (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'file'].includes(a.type))); };
  let bekleyenCizim = false;
  const sonraCiz = () => { if (yaziyor()) { bekleyenCizim = true; return; } ciz(); };
  document.addEventListener('focusout', () => setTimeout(() => { if (bekleyenCizim && !yaziyor()) { bekleyenCizim = false; ciz(); } }, 0));
  if (eklentide && chrome.storage.onChanged) chrome.storage.onChanged.addListener((d, alan) => { if (alan === 'local' && D.mod === 'canli' && (d.db || d.sablonlar || d.sonSenkron || d.uyapSinyal || d.sonYakalama)) yukle().then(sonraCiz); });
  if (eklentide && chrome.runtime?.onMessage) chrome.runtime.onMessage.addListener((m) => {
    if (!m || m.tur !== 'senkron') return;
    if (m.bitti) { D.senkron = null; bildir(m.hata ? m.hata : `UYAP'tan okuma tamamlandı (${m.yapilan || 0} sorgu).`); yukle().then(sonraCiz); return; }
    D.senkron = { calisiyor: true, yapilan: m.yapilan || 0, toplam: m.toplam || 0, mesaj: m.mesaj || 'Başlıyor' }; sonraCiz();
  });

  (async () => {
    // Eklentide yalnız gerçek veri; demo yalnız yayınlanan demo sayfasında. Yerelde '#canli' ile gerçek görünüm önizlenir.
    // Herkese açık demo sitesinde (window.URIKEM_DEMO) her zaman uydurma veri gösterilir.
    D.mod = eklentide ? 'canli' : (location.hash === '#canli' && !cercevede && !window.URIKEM_DEMO ? 'canli' : 'demo');
    if (eklentide) {
      const eski = await al(['demoElle', 'elle']);
      if (eski.demoElle?.ayarlar && !eski.elle?.ayarlar) {
        const a = eski.demoElle.ayarlar, demoAdres = /demo-hukuk\.test$/;
        await koy({ elle: Object.assign(elleBos(), eski.elle || {}, { ayarlar: { ...a, eposta: demoAdres.test(a.eposta || '') ? '' : a.eposta, ortakEposta: demoAdres.test(a.ortakEposta || '') ? '' : a.ortakEposta } }) });
      }
      await sil(['demoDb', 'demoElle', 'demoGun', 'demoSurum', 'mod']);
    }
    await yukle();
    ciz();
  })();
})();
