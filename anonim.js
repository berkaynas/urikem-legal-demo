// Anonimleştirme — Saadet Kartı'nın "Anonimleştirme Aracı" (cekirdek.py, sürüm 1.1) metin çekirdeğinin JavaScript'e çevirisi.
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
// Değişiklik: Yalnız metin çekirdeği (Türkçe katlama, liste, sabit kalıplar, şirket unvanı, emsal bağlamı,
// geri çevirme, şüpheli taraması) taşındı; Word/UDF/PDF okuma bölümleri alınmadı. Kurallar aynen korundu.
// Düzeltme (2026-11-23): düzenli ifade kaçışı Unicode kipine uyarlandı ('-' ve '/' içeren adlarda ve geri çevirmede hata veriyordu).
// Kural: Urikem Legal'de yapay zekâya giden HER metin önce buradan geçer; gerçek değerler bilgisayardan çıkmaz.
(function (kok) {
  const UA = (kok.UA = kok.UA || {});
  const W = '[\\p{L}\\p{N}_]';            // Python'daki Unicode \w
  const NW_ONCE = `(?<!${W})`, NW_SONRA = `(?!${W})`;
  // Unicode kipindeki (u) düzenli ifadelerde '-' ve '/' kaçırılamaz; bunlar karakter sınıfı dışında zaten düz harftir.
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // ---------- Türkçe katlama: uzunluk korunur, konumlar değişmez ----------
  const TR = { 'İ': 'i', 'I': 'i', 'ı': 'i', 'Ş': 's', 'ş': 's', 'Ç': 'c', 'ç': 'c', 'Ğ': 'g', 'ğ': 'g', 'Ö': 'o', 'ö': 'o', 'Ü': 'u', 'ü': 'u', 'Â': 'a', 'â': 'a', 'Î': 'i', 'î': 'i', 'Û': 'u', 'û': 'u' };
  const katla = (s) => String(s).split('').map((ch) => { const t = TR[ch] ?? ch; const k = t.toLowerCase(); return k.length === 1 ? k : ch; }).join('');
  // Not: [...s] kod noktası verir; Python ile aynı konumlar için UTF-16 uzunluğu eşit kalmalı. Türkçe metinde BMP dışı karakter yok.

  function kurallariOku(metin) {
    const kurallar = [];
    for (let satir of String(metin || '').split(/\r?\n/)) {
      satir = satir.trim();
      if (!satir || satir.startsWith('#') || !satir.includes('=')) continue;
      const i = satir.indexOf('=');
      const etiket = satir.slice(0, i).trim().replace(/^\[+|\]+$/g, '').trim();
      if (!etiket) continue;
      const varyantlar = satir.slice(i + 1).split(';').map((v) => v.trim()).filter(Boolean);
      if (varyantlar.length) kurallar.push([`[${etiket}]`, varyantlar]);
    }
    return kurallar;
  }

  const BIRLESEN = '[\\u0300-\\u036f]?';
  const harfDeseni = (ch) => (ch === 's' ? '[s\\u0219]' + BIRLESEN : esc(ch) + (/\p{L}/u.test(ch) ? BIRLESEN : ''));
  const kelimeDeseni = (k) => [...k].map(harfDeseni).join('');

  // ---------- şirket unvanları ----------
  const TUR_EKI = katla('(?:a\\.?\\s?ş\\.?|t\\.?\\s?a\\.?\\s?ş\\.?|anonim\\s+şirketi'
    + '|(?:ltd|limited)\\.?\\s*(?:şti|şirketi)\\.?|ltd\\.?|limited'
    + '|kollektif\\s+şirketi|koll\\.?\\s*şti\\.?|komandit\\s+şirketi|kom\\.?\\s*şti\\.?'
    + '|kooperatifi|koop\\.?|holding|inc\\.?|gmbh|llc|s\\.a\\.|b\\.v\\.|ag|corp\\.?|plc)');
  const TUR_EKI_RE = new RegExp('(?:^|\\s)' + TUR_EKI + '\\s*$', 'u');
  const KISALTMA = {
    sanayi: ['sanayi', 'sanayii', 'san'], sanayii: ['sanayi', 'sanayii', 'san'], ticaret: ['ticaret', 'tic'], pazarlama: ['pazarlama', 'paz'],
    'inşaat': ['inşaat', 'inş'], ithalat: ['ithalat', 'ith'], ihracat: ['ihracat', 'ihr'], turizm: ['turizm', 'tur'],
    'mühendislik': ['mühendislik', 'müh'], 'danışmanlık': ['danışmanlık', 'dan'], hizmetleri: ['hizmetleri', 'hiz', 'hizm'], limited: ['limited', 'ltd'],
  };
  for (const grup of Object.values({ ...KISALTMA })) { const k = grup.map(katla); for (const x of k) KISALTMA[x] = k; }
  const SEKTOR = new Set(`ve & and sanayi sanayii san ticaret tic pazarlama paz inşaat inş yapı gıda turizm tur tekstil otomotiv lojistik
nakliyat nakliye taşımacılık kargo enerji elektrik elektronik makine makina mühendislik müh danışmanlık dan yazılım
bilişim teknoloji teknolojileri ithalat ith ihracat ihr dış hizmetleri hizmet hiz ürünleri ambalaj kimya ilaç sağlık
medikal mobilya emlak gayrimenkul yatırım yatırımları holding grup madencilik tarım hayvancılık petrol akaryakıt
reklam organizasyon eğitim sigorta aracılık finans faktoring leasing kiralama metal plastik kağıt matbaa yayıncılık
restoran otel iletişim telekomünikasyon güvenlik temizlik tasarım dekorasyon mimarlık proje taahhüt müşavirlik
alışveriş hizmetleri servisi türk türkiye uluslararası international packaging foods trading`.split(/\s+/).map(katla));

  function sirketVaryantDeseni(katli) {
    const m = katli.match(TUR_EKI_RE);
    const govde = m ? katli.slice(0, m.index).trim() : katli;
    const parca = [];
    for (const k of govde.split(/\s+/).filter(Boolean)) {
      const yalin = k.replace(/\.+$/, '');
      if (['ve', '&', 'and'].includes(yalin)) parca.push(null);
      else if (KISALTMA[yalin]) parca.push('(?:' + KISALTMA[yalin].map(kelimeDeseni).join('|') + ')\\.?');
      else parca.push(kelimeDeseni(k));
    }
    if (!parca.some(Boolean)) return null;
    let desen = '', onceki = false;
    for (const x of parca) {
      if (x === null) { desen += '(?:[\\s.]*(?:ve|&|and))?'; continue; }
      desen += (onceki ? '[\\s.]*' : '') + x; onceki = true;
    }
    return desen + '(?:[\\s.]*' + TUR_EKI + ')?';
  }

  function adDeseni(varyant) {
    const katli = katla(String(varyant).normalize('NFC')).trim();
    const govde = TUR_EKI_RE.test(katli) ? sirketVaryantDeseni(katli) : katli.split(/\s+/).map(kelimeDeseni).join('\\s+');
    if (!govde) return null;
    const desen = new RegExp(NW_ONCE + govde + NW_SONRA, 'gu');
    return new RegExp('^(?:' + govde + ')', 'u').test('') ? null : desen;
  }

  // ---------- sabit kalıplar ----------
  function tcknGecerli(s) {
    const d = [...s].map(Number);
    if (d.length !== 11 || d[0] === 0) return false;
    if (((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10 !== d[9]) return false;
    return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
  }
  const BH = 'A-ZÇĞİÖŞÜ', KH = 'a-zçğıöşü';
  const B = NW_ONCE; // Python \b (kelime başı)
  const DESENLER = [
    ['iban', 'IBAN', 'IBAN', new RegExp(`${B}TR\\s?\\d{2}(?:\\s?\\d{4}){5}\\s?\\d{2}${NW_SONRA}`, 'giu')],
    ['eposta', 'E-posta', 'E-POSTA', new RegExp(`[\\p{L}\\p{N}_.+-]+@[\\p{L}\\p{N}_-]+(?:\\.[\\p{L}\\p{N}_-]+)+`, 'gu')],
    ['tckn', 'TC kimlik no', 'TCKN', /(?<!\d)[1-9]\d{10}(?!\d)/gu],
    ['telefon', 'Telefon', 'TELEFON', /(?<![\d+])(?:\+?90[\s.-]?)?\(?0?[2-5]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)/gu],
    ['vkn', 'Vergi no', 'VKN', new RegExp(`(?:${B}V\\.?K\\.?N\\.?|${B}Vergi\\s+(?:Kimlik\\s+)?(?:No|Numarası)|${B}Vergi\\s+No)\\s*[:.]?\\s*(?<d>\\d{10,11})(?!\\d)`, 'giu')],
    ['mersis', 'MERSİS no', 'MERSİS', new RegExp(`${B}MERS[İI]S\\s*(?:No|Numarası)?\\s*[:.]?\\s*(?<d>\\d{16})(?!\\d)`, 'giu')],
    ['dosyano', 'Esas/karar/dosya no', 'DOSYA NO', new RegExp(
      `(?:${B}(?:E|K)\\s*[.:]|${B}(?:Esas|Karar|Dosya|Soruşturma|Talimat|Takip)\\s*(?:No|Numarası|Sayısı)?\\s*[.:]?)\\s*`
      + '(?<d>(?:19|20)\\d{2}\\s*/\\s*\\d{1,7})'
      + '|(?<d2>(?:19|20)\\d{2}\\s*/\\s*\\d{1,7})(?=\\s*(?:E\\.|K\\.|Esas|Karar|D\\.\\s*İş|Tal\\.|Talimat|Soruşturma|Hz\\.))', 'giu')],
    ['adaparsel', 'Ada/parsel', 'ADA-PARSEL', new RegExp(
      `${B}\\d+\\s*ada\\s*,?\\s*\\d+\\s*(?:nolu\\s*|no'?lu\\s*)?parsel`
      + `|${B}ada\\s*/\\s*parsel\\s*(?:no\\s*)?[:.]?\\s*\\d+\\s*/\\s*\\d+`
      + `|${B}ada\\s*(?:no)?\\s*[:.]?\\s*\\d+\\s*,?\\s*parsel\\s*(?:no)?\\s*[:.]?\\s*\\d+`, 'giu')],
    ['adres', 'Adres (mahalle/cadde ... No)', 'ADRES', new RegExp(
      `(?:(?!(?i:adres|adresi|ikametgah|ikamet)${NW_SONRA})[${BH}0-9][\\p{L}\\p{N}_.'’]*\\s+){1,4}`
      + `(?i:mahallesi|mahalle|mah\\.?|mh\\.|caddesi|cadde|cad\\.?|cd\\.|sokağı|sokak|sok\\.?|sk\\.?|bulvarı|bulvar|blv\\.)${NW_SONRA}`
      + `(?:(?:(?![${KH}]{4}[.!?]\\s)[^\\n]){0,100}?${B}(?i:no)\\s*[:.]?\\s*|\\s+(?=\\d))`
      + '\\d+[A-Za-z]?(?:\\s*/\\s*\\d+[A-Za-z]?)?(?![\\d.]\\d)'
      + `(?:\\s*[,-]?\\s*(?:(?i:[a-z]?\\d*\\s*blok(?:\\s+[a-z0-9]{1,2}${NW_SONRA}(?!\\s*[:.]\\s*\\d))?)`
      + '|(?i:d|daire|kat|k|iç\\s*kapı(?:\\s*no)?|apt\\.?|apartmanı)\\s*[:.]?\\s*\\d+[A-Za-z]?))*'
      + `(?:\\s*,?\\s*[${BH}][${KH}]+\\s*/\\s*[${BH}][${KH}]+)?`, 'gu')],
    ['pasaport', 'Pasaport no', 'PASAPORT', new RegExp(`${B}pasaport\\s*(?:no|numarası|numarasi)?\\s*[:.]?\\s*(?<d>[A-Z]{1,2}\\s?\\d{6,8})${NW_SONRA}`, 'giu')],
    ['dogum', 'Doğum tarihi', 'DOĞUM TARİHİ', new RegExp(
      `(?:${B}doğum\\s+(?:yeri\\s+ve\\s+)?tarihi|${B}D\\.\\s?T\\.)\\s*[:.]?[^\\d\\n]{0,25}?`
      + '(?<d>\\d{1,2}[./-]\\d{1,2}[./-](?:19|20)\\d{2})'
      + '|(?<d2>\\d{1,2}[./-]\\d{1,2}[./-](?:19|20)\\d{2})(?=\\s*(?:doğumlu|d\\.\\s?lu|doğum\\s+tarihli))', 'giu')],
    ['plaka', 'Araç plakası', 'PLAKA', new RegExp(`(?<![\\p{L}\\p{N}_/.:-])(?:0[1-9]|[1-7]\\d|8[01])\\s?[A-Z]{1,3}\\s?\\d{2,4}(?![\\p{L}\\p{N}_/:-])`, 'gu')],
  ];
  const UNVAN_KELIME = `(?:[${BH}0-9][\\p{L}\\p{N}_&.’'\\-]*|ve|VE|&|and)`;
  const SIRKET_DESENI = new RegExp(
    `(?<![\\p{L}\\p{N}_.])(?<g>${UNVAN_KELIME}(?:[ \\t\\u00a0]+${UNVAN_KELIME}){0,11}?)[ \\t\\u00a0]*`
    + '(?<t>A\\.?\\s?Ş\\.?|T\\.?\\s?A\\.?\\s?Ş\\.?|ANON[İI]M\\s+Ş[İI]RKET[İI]|Anonim\\s+Şirketi'
    + '|(?:Ltd|LTD|Limited|L[İI]M[İI]TED)\\.?\\s*(?:Şti|ŞT[İI]|Şirketi|Ş[İI]RKET[İI])\\.?'
    + '|Koll\\.?\\s*Şti\\.?|Kom\\.?\\s*Şti\\.?|Kollektif\\s+Şirketi|Komandit\\s+Şirketi'
    + `|Kooperatifi|KOOPERAT[İI]F[İI]|Holding|HOLD[İI]NG|Inc\\.|GmbH|LLC|Ltd\\.|S\\.A\\.|B\\.V\\.|AG${NW_SONRA}|Corp\\.|PLC${NW_SONRA})`
    + NW_SONRA, 'gdu');
  const ROL = new Set(`davacı davalı müvekkil müvekkilimiz borçlu alacaklı satıcı alıcı kiracı kiraya veren yüklenici işveren işçi
müteahhit tedarikçi dağıtıcı bayi şirket şirketi firma firması sayın işbu taraf taraflar ile ve tarafından
lojistik hizmeti hizmet olarak vekili vekil the by and between with of davalılardan davacılardan üçüncü kişi
ancak zira nitekim bu söz konusu dava davaya öte yandan ayrıca bununla birlikte dolayısıyla nedenle yine keza
hatta oysa halbuki yukarıda aşağıda adı geçen anılan mezkur sözü edilen olan diğer karşı yan t.c. tc`.split(/\s+/).map(katla));
  DESENLER.unshift(['sirket', 'Şirket unvanı', 'ŞİRKET', SIRKET_DESENI]);

  function unvanKirp(metin, s, e, gs) {
    const re = /\S+\s*/gu; const parca = metin.slice(gs, e); let x;
    while ((x = re.exec(parca))) {
      const t = x[0].trim(), k = katla(t).replace(/[.:,;]+$/, '');
      if ((ROL.has(k) || /^\d+[.)-]$/.test(t)) && x.index + x[0].length + gs < e) continue;
      return gs + x.index;
    }
    return gs;
  }

  const DUR = new Set(`kanun kanunu kanunun kanununun mahkeme mahkemesi mahkemesinin hukuk ceza yargıtay danıştay daire dairesi genel
kurul kurulu türk türkiye cumhuriyeti cumhuriyet borçlar medeni ticaret iş sosyal güvenlik kurumu kurum sağlık
bakanlığı bakanlık ilaç tıbbi cihaz müdürlüğü başkanlığı başkanlık asliye sulh icra noter noterliği tapu sicil
yönetmelik yönetmeliği yönetmeliğin madde maddesi sayılı esas karar davacı davalı vekili vekil sözleşme sözleşmesi
protokol ek taraf taraflar tarafından konu açıklamalar hukuki sebepler deliller sonuç istem talep netice
aile tüketici idare idari vergi bölge adliye anayasa istanbul ankara izmir anadolu bakırköy kadıköy kartal
pendik üsküdar ümraniye çağlayan bursa antalya kocaeli ocak şubat mart nisan mayıs haziran temmuz ağustos eylül
ekim kasım aralık pazartesi salı çarşamba perşembe cuma cumartesi pazar sayın sn t.c. tc hakimliği hâkimliği
başsavcılığı savcılığı cumhuriyet üniversitesi hastanesi fakültesi etik klinik araştırma araştırmalar
araştırmaları kılavuzu kılavuz ilaçlar ürünleri kurumu titck sgk kvkk
agreement sponsor site study institution investigator principal party parties clinical trial protocol
services service section article schedule exhibit appendix annex confidential confidentiality information
budget payment payments terms term effective date the and of for to in with by this that such any all
contract research organization organisation data protection subject subjects page of`.split(/\s+/).map(katla));

  function kisaAd(unvan) {
    SIRKET_DESENI.lastIndex = 0;
    const m = new RegExp(SIRKET_DESENI.source, 'du').exec(unvan);
    const govde = m ? unvan.slice(0, m.indices.groups.t[0]) : unvan;
    const kel = [];
    for (const k of govde.split(/\s+/).filter(Boolean)) { if (SEKTOR.has(katla(k.replace(/\.+$/, '')))) break; kel.push(k); }
    const kisa = kel.join(' ').replace(/^[ .]+|[ .]+$/g, '');
    if (kisa.replace(/[^\p{L}\p{N}_]/gu, '').length < 3 || kisa.split(/\s+/).every((k) => DUR.has(katla(k)))) return null;
    return kisa;
  }

  const EMSAL = /Yargıtay|YARGITAY|Danıştay|DANIŞTAY|Anayasa|ANAYASA|(?<![\p{L}\p{N}_])H\.?D\.?(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])HGK(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])CGK(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])C\.?D\.?(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])İDDK(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])VDDK(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])İBK(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])YİBK(?![\p{L}\p{N}_])|(?:Hukuk|Ceza|HUKUK|CEZA)\s+(?:Dairesi|DAİRESİ)|(?<![\p{L}\p{N}_])\d+\.\s*(?:Daire|DAİRE)(?![\p{L}\p{N}_])|Bölge\s+Adliye|(?<![\p{L}\p{N}_])BAM(?![\p{L}\p{N}_])|Genel\s+Kurul/gu;
  const KENDI = /müvekkil|Müvekkil|MÜVEKKİL|dosyamız|davamız|huzurdaki|işbu|İşbu|takip|Takip|icra|İcra|İCRA/u;
  const KENDI_SONRA = /^[\s.,]*(?:E\.?|Esas|K\.?|Karar)?[\s.,]*(?:sayılı\s+)?(?:dosya(?:sı|mız)|takip)(?![\p{L}\p{N}_])/u;
  const NUMARA_ONCESI = /(?i:fatura|hesap|abone|abonelik|sipariş|müşteri|poliçe|referans|seri|sicil|sözleşme|kart|tesisat)[\p{L}\p{N}_]*\s*(?i:no|numarası|numarasi)?\s*[:.]?\s*$/u;

  function emsalBaglami(metin, s, e) {
    const once = metin.slice(Math.max(0, s - 80), s).split(/[—;\n]/).at(-1);
    const sonra = metin.slice(e, e + 60).split(/[—;\n]/)[0];
    if (KENDI_SONRA.test(sonra)) return false;
    let son = null; EMSAL.lastIndex = 0; let m;
    while ((m = EMSAL.exec(once))) son = m;
    if (son && !KENDI.test(once.slice(son.index + son[0].length))) return true;
    EMSAL.lastIndex = 0; const var_ = EMSAL.test(sonra); EMSAL.lastIndex = 0;
    return var_ && !KENDI.test(once);
  }
  const norm = (s) => katla(s).replace(/\s+/g, '');
  const tumu = (re, s) => { re.lastIndex = 0; return [...s.matchAll(re)]; };

  // ---------- motorlar ----------
  class Motor {
    constructor(listeMetni, secenekler, otomatik) {
      this.kurallar = kurallariOku(listeMetni);
      const ad = [];
      for (const [etiket, varyantlar] of this.kurallar) for (const v of varyantlar) { const d = adDeseni(v); if (d) ad.push([v.length, d, etiket]); }
      ad.sort((a, b) => b[0] - a[0]);
      this.adDesenleri = ad.map(([, d, e]) => [d, e]);
      this.secenekler = new Set(secenekler || DESENLER.map((x) => x[0]));
      this.otomatik = otomatik || {};
      this.degerEtiket = {}; for (const [k, v] of Object.entries(this.otomatik)) this.degerEtiket[norm(v)] = k;
      this.atlananlar = {};
      this.kisa = {};
      for (const [etiket, varyantlar] of this.kurallar) for (const v of varyantlar) {
        if (TUR_EKI_RE.test(katla(v)) && adDeseni(v)) { const ka = kisaAd(v); if (ka && !this.kisa[norm(ka)]) this.kisa[norm(ka)] = [ka, etiket]; }
      }
    }
    etiket(kok, deger) {
      const n = norm(deger);
      if (this.degerEtiket[n]) return this.degerEtiket[n];
      const i = 1 + Object.keys(this.otomatik).filter((k) => k.startsWith('[' + kok + '-')).length;
      const e = `[${kok}-${i}]`; this.otomatik[e] = deger; this.degerEtiket[n] = e; return e;
    }
    sirketEtiketi(unvan) {
      const ka = kisaAd(unvan), a = ka ? norm(ka) : null;
      if (a && this.kisa[a]) return this.kisa[a][1];
      const e = this.etiket('ŞİRKET', unvan); if (a) this.kisa[a] = [ka, e]; return e;
    }
    bul(metin) {
      const adaylar = [], k = katla(metin), liste = [];
      for (const [d, et] of this.adDesenleri) for (const m of tumu(d, k)) { adaylar.push([m.index, m.index + m[0].length, 0, et]); liste.push([m.index, m.index + m[0].length, et]); }
      if (this.secenekler.has('sirket')) {
        for (const m of tumu(SIRKET_DESENI, metin)) {
          const tS = m.indices.groups.t[0], gS = m.indices.groups.g[0];
          let s = unvanKirp(metin, m.index, m.index + m[0].length, gS), e = m.index + m[0].length;
          if (s >= tS) continue;
          const ic = liste.filter(([ls, le]) => ls < e && le > s);
          if (ic.length) { s = Math.min(s, ...ic.map((x) => x[0])); e = Math.max(e, ...ic.map((x) => x[1])); adaylar.push([s, e, 0, ic[0][2]]); }
          else adaylar.push([s, e, 1, this.sirketEtiketi(metin.slice(s, e))]);
        }
        for (const [ka, et] of Object.values(this.kisa)) {
          const d = new RegExp(NW_ONCE + ka.split(/\s+/).map((p) => kelimeDeseni(katla(p))).join('\\s+') + NW_SONRA, 'gu');
          for (const m of tumu(d, k)) { const c = metin[m.index]; if (c !== c.toLocaleLowerCase('tr-TR') || /\d/.test(c)) adaylar.push([m.index, m.index + m[0].length, 2, et]); }
        }
      }
      for (const [anahtar, , kok, desen] of DESENLER) {
        if (!this.secenekler.has(anahtar) || anahtar === 'sirket') continue;
        const re = desen.flags.includes('d') ? desen : new RegExp(desen.source, desen.flags + 'd');
        for (const m of tumu(re, metin)) {
          const g = m.indices.groups && (m.groups.d ? 'd' : m.groups.d2 ? 'd2' : null);
          const [s, e] = g ? m.indices.groups[g] : [m.index, m.index + m[0].length];
          const deger = metin.slice(s, e);
          if (anahtar === 'tckn' && !tcknGecerli(deger)) continue;
          if (anahtar === 'dosyano' && emsalBaglami(metin, s, e)) { this.atlananlar[deger] = (this.atlananlar[deger] || 0) + 1; continue; }
          if (anahtar === 'telefon' && NUMARA_ONCESI.test(metin.slice(Math.max(0, s - 30), s))) { adaylar.push([s, e, 1, ['NUMARA', deger]]); continue; }
          adaylar.push([s, e, 1, [kok, deger]]);
        }
      }
      adaylar.sort((a, b) => a[0] - b[0] || (b[1] - b[0]) - (a[1] - a[0]) || a[2] - b[2]);
      const sonuc = []; let son = -1;
      for (const [s, e, , et] of adaylar) if (s >= son) { sonuc.push([s, e, Array.isArray(et) ? this.etiket(...et) : et]); son = e; }
      return sonuc;
    }
  }

  class GeriMotor {
    constructor(listeMetni, otomatik) {
      this.harita = { ...otomatik };
      for (const [etiket, varyantlar] of kurallariOku(listeMetni)) this.harita[etiket] = varyantlar[0];
      const a = Object.keys(this.harita).sort((x, y) => y.length - x.length);
      this.desen = a.length ? new RegExp(a.map(esc).join('|'), 'gu') : null;
    }
    bul(metin) { return this.desen ? tumu(this.desen, metin).map((m) => [m.index, m.index + m[0].length, this.harita[m[0]]]) : []; }
  }

  function metneUygula(metin, bul) {
    let i = 0, out = '';
    for (const [s, e, et] of bul(metin)) { out += metin.slice(i, s) + et; i = e; }
    return out + metin.slice(i);
  }

  function supheliler(metin) {
    const m = metin.replace(/\[[^\]\n]{1,40}\]/g, (x) => ' '.repeat(x.length));
    const bulgu = new Map();
    const ekle = (tur, s) => { s = s.replace(/\s+/g, ' ').replace(/^[ ,.;:]+|[ ,.;:]+$/g, ''); if (s.length >= 3) { const k = tur + '\u0000' + s; bulgu.set(k, (bulgu.get(k) || 0) + 1); } };
    for (const x of m.matchAll(new RegExp(`${B}(?:Sayın|SAYIN|Sn\\.|Av\\.|Avukat|Dr\\.|Doç\\.|Prof\\.|Uzm\\.|Bay|Bayan)\\s+((?:[${BH}][\\p{L}\\p{N}_${KH}]+\\.?\\s?){1,3})`, 'gu'))) ekle('Unvanla geçen ad', x[1]);
    for (const x of m.matchAll(new RegExp(`((?:[${BH}][${KH}]+\\s+){1,2})(?:Bey|Hanım|Hanımefendi)${NW_SONRA}`, 'gu'))) ekle('Bey/Hanım ile geçen ad', x[1]);
    for (const x of tumu(SIRKET_DESENI, m)) { const s = unvanKirp(m, x.index, x.index + x[0].length, x.indices.groups.g[0]); if (s < x.indices.groups.t[0]) ekle('Şirket adı', m.slice(s, x.index + x[0].length)); }
    for (const x of m.matchAll(new RegExp(`${B}[${BH}]{2,}(?:\\s+[${BH}]{2,}){1,3}${NW_SONRA}`, 'gu'))) if (x[0].split(/\s+/).some((k) => !DUR.has(katla(k)))) ekle('Büyük harfli dizi', x[0]);
    const goruldu = new Set([...bulgu.keys()].map((k) => k.split('\u0000')[1]));
    for (const x of m.matchAll(new RegExp(`(?<![.!?:]\\s)(?<=\\s)([${BH}][${KH}]{2,}(?:\\s+[${BH}][${KH}]{2,}){1,2})${NW_SONRA}`, 'gu'))) if (x[1].split(/\s+/).every((k) => !DUR.has(katla(k))) && !goruldu.has(x[1])) ekle('Büyük harfle başlayan ikili', x[1]);
    for (const x of m.matchAll(/(?<![\d/])\d{7,}(?![\d/])/g)) ekle('Uzun numara', x[0]);
    return [...bulgu].map(([k, n]) => { const [tur, deger] = k.split('\u0000'); return { tur, deger, sayi: n }; });
  }

  // ---------- Urikem Legal'in kullandığı kapı ----------
  // Yapay zekâya gidecek metni hazırlar: { anonim, esleme, sayi, supheliler }. Gerçek değerler 'esleme'de, bilgisayarda kalır.
  UA.anonimlestir = (metin, listeMetni, otomatik) => {
    const motor = new Motor(listeMetni, null, otomatik ? { ...otomatik } : {});
    const bulgular = motor.bul(metin);
    const anonim = metneUygula(metin, () => bulgular);
    return { anonim, esleme: motor.otomatik, liste: listeMetni, sayi: bulgular.length, supheliler: supheliler(anonim), atlananlar: motor.atlananlar };
  };
  // Yapay zekâdan dönen metindeki etiketleri bilgisayarda gerçek değerlere çevirir.
  UA.geriCevir = (metin, hazirlik) => metneUygula(metin, (t) => new GeriMotor(hazirlik.liste, hazirlik.esleme).bul(t));
  UA.anonimIc = { katla, kurallariOku, tcknGecerli, kisaAd, Motor, GeriMotor, supheliler, metneUygula };
})(typeof window !== 'undefined' ? window : globalThis);
