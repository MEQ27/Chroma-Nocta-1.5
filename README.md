# 🌌 CHROMA NOCTA v1.4-OPS — Astrophotography Field Station & Ephemeris

Chroma Nocta, derin uzay astrofotografisi (DSO), arazi lojistiği ve saha gözlemleri için sıfır cihaz saati sızıntısı ve katı tip güvenliği ile korunan deterministik bir operasyon istasyonudur.

---

## 🎯 1. Proje Vizyonu ve Çözülen Saha Problemi

Astrofotoğrafçılar sahaya çıktıklarında dağınık haritalar, tutarsız hava durumu tahminleri, cihaz saatinden kaynaklanan zaman dilimi kaymaları, kundak meridyen dönüşü (meridian flip) riskleri ve kamera-kundak ekosistemindeki koordinasyon eksikliğiyle karşılaşırlar. Birkaç dakikalık hesaplama hatası, ekipmanın kundağa çarpmasına veya saatlerce süren pozlamaların boşa gitmesine neden olabilir.

**Chroma Nocta'nın Çözümü:**
- **Birleşik Saha Konsolu:** Tek bir deterministik PWA içerisinde efemeris, karanlık gökyüzü takvimi, mikro-katman hava durumu, rota/dağ maskesi, meridyen bekçisi ve otonom yıldız-üçgen eşleştirme (plate-solve).
- **Çevrimdışı Dayanıklılık (Offline-First):** Dağlık ve hücresel kapsama alanı dışındaki gözlem noktalarında IndexedDB ve LocalStorage önbellekleriyle kesintisiz çalışma.
- **Sıfır Varsayım & Sıfır Uydurma Veri:** Eksik atmosferik parametreler için sahte veri üretilmez; üç durumlu donanım LED telemetrisi ve `missing[]` dizisi ile operatöre doğrudan durum bildirilir.

---

## 🛡️ 2. Dört Tavizsiz Mühendislik Aksiyomu

1. **Zero Device-Clock Leak (Cihaz Saati Sızıntı Yasağı):**
   Tarayıcının veya yerel telefonun saati/saat dilimi asla efemeris ve astronomi hesaplamalarına karışamaz. Tüm zaman ve tarih dönüşümleri `src/lib/siteTime.ts` üzerinden hedef gözlem noktasının IANA zaman dilimine (`location.timeZone`) kilitlidir.
2. **ZERO_LOCK — 29 Çekirdek Dosyada Sıfır Tip Kaçışı:**
   Çekirdek kütüphaneler ve kullanıcı arayüzü sekmelerinde `any`, `as <Type>` tür dönüşümleri, `as const`, `!` (non-null assertion) ve `@ts-*` direktifleri kesinlikle yasaktır (`scripts/type-escape-check.ts` tarafından AST seviyesinde denetlenir).
3. **Uydurma Veri Yasağı (Zero Fabricated Data):**
   Veri kaynağı erişilemez olduğunda hiçbir metrik sentetik veya rastgele üretilmez. Sistem doğrudan `null` döner ve UI üzerinde açıkça eksik alan rozeti gösterir.
4. **Tek Gerçek Kaynağı (Single Source of Truth):**
   Efemeris hesaplamaları `ephemerisCache` ile memoize edilir; hava durumu `inFlightRequests` havuzu ve 30 dakikalık v4 önbellekle çift istekleri engeller; tüm sekmeler ortak küresel durum ile senkronize çalışır.

---

## 📐 3. 5 Sekmeli İstasyon Mimarisi ve Dosya Topolojisi

| Sekme | Başlık | Birincil Sorumluluk | İlgili Dosyalar |
|---|---|---|---|
| **Tab 1** | **Night Calendar & Almanac** (`#tabCalendar`) | 72h çift irtifa kubbesi (Güneş/Ay/Galaktik Merkez), ay evreleri, 24 aylık karanlık pencereler, taktik brifing | `src/components/tabs/NightCalendarTab.tsx`, `src/components/AltitudeCurve.tsx`, `src/lib/windowClusters.ts`, `src/lib/nightScore.ts` |
| **Tab 2** | **Field Weather & Telemetry** (`#tabWeather`) | Alçak/orta/yüksek bulut ayrışımı, rüzgar hamleleri, çiğ noktası depresyonu (dew heater alarmı), 2-satırlı saha konsolu | `src/components/tabs/FieldWeatherTab.tsx`, `src/lib/weatherService.ts`, `src/lib/splinePath.ts` |
| **Tab 3** | **Route, Dossier & Gear** (`#tabRoute`) | Saha koordinatları, GPS/cihaz konumu, rakım sıcaklık düşüşü (lapse rate), lightpollutionmap bağlantısı, kalıcı ekipman kontrol listesi | `src/components/tabs/RouteTab.tsx`, `src/components/LocationModal.tsx`, `src/lib/deviceStorage.ts` |
| **Tab 4** | **Target Ops & Watchdog** (`#tabTargets`) | Derin uzay hedef kataloğu, 2x yüksek (340px) irtifa grafiği, iç Horizon etiketi, canlı Min-Alt eşiği, sesli meridyen alarmı | `src/components/tabs/TargetOpsTab.tsx`, `src/lib/targetOpsEngine.ts`, `src/components/HorizonMaskModal.tsx` |
| **Tab 5** | **Sky Vizor & Plate-Solve** (`#tabSky`) | 2D serbest pan/tilt gök kubbe projeksiyonu, mozaik planlayıcı, optik FOV sensör çerçevesi, Modül H yıldız üçgeni plate-solve | `src/components/tabs/SkyVizorTab.tsx`, `src/lib/starAlignmentEngine.ts` |

---

## 🔬 4. Matematiksel ve Astronomik Çekirdek Formüller

### A. Topografik Ufuk Çökmesi (Dip of the Horizon) ve 8 Yönlü Dağ Maskesi
Gözlem noktasının deniz seviyesinden yüksekliğine bağlı optik ufuk çökmesi formülü:
$$\text{Dip} = 0.0293^\circ \times \sqrt{h_{\text{metre}}}$$
8 yönlü (N, NE, E, SE, S, SW, W, NW) dağ topoğrafyası için hedefin o anki azimut açısına ($\theta$) göre iki komşu yön arasında doğrusal enterpolasyon uygulanır:
$$\text{Alt}_{\text{terrain}}(\theta) = \text{Alt}_1 + \frac{\theta - \text{Az}_1}{\text{Az}_2 - \text{Az}_1} \times (\text{Alt}_2 - \text{Alt}_1)$$

### B. 5 Faktörlü Gece Çekim Skoru ve 4 Sert Saha Vetosu
Her gece `0–100` puan aralığında ağırlıklı olarak değerlendirilir:
$$\text{Puan} = \text{Bulut (40p)} + \text{Karanlık/Ay (25p)} + \text{Rüzgar (15p)} + \text{Çiğ (10p)} + \text{Termal/Saha (10p)}$$

**4 Sert Saha Vetosu (Puanı Sıfıra / Çekim İptaline Düşüren Koşullar):**
1. **Yağış Vetosu:** Yağış ihtimali $\ge 40\%$ veya birikim $\ge 0.5\text{ mm}$
2. **Fırtına Vetosu:** Sürekli rüzgar veya ani hamle $> 35\text{ km/h}$
3. **Alçak Sis/Bulut Vetosu:** Alçak katman bulut örtüsü $\ge 60\%$
4. **Aşırı Soğuk Vetosu:** Yüzey sıcaklığı $\le -15^\circ\text{C}$

### C. Küresel Kosinüs Yasası ve Meridyen Saat Açısı (Hour Angle)
Hedef ($\alpha_t, \delta_t$) ile Ay ($\alpha_m, \delta_m$) arasındaki açısal ayrım:
$$\cos(d) = \sin(\delta_t)\sin(\delta_m) + \cos(\delta_t)\cos(\delta_m)\cos(\alpha_t - \alpha_m)$$
Yerel Yıldız Zamanı (LST) ve hedefin Sağ Açıklığı (RA) üzerinden Saat Açısı:
$$\text{HA} = \text{LST} - \text{RA}$$
$\text{HA} = 0$ anı meridyen geçişidir (Meridian Transit). $\text{HA} \in [-0.25\text{h}, +0.25\text{h}]$ aralığında görsel ve sesli meridyen güvenlik uyarısı tetiklenir.

### D. Bağıl Yıldız-Üçgen Eşleştirme (Relative Star-Triangle Plate-Solve) ve HFR
Görüntüdeki en parlak $N$ yıldızın ağırlıklı kütle merkezi (centroid) hesaplanır. Her yıldız üçgeni kenar uzunluklarına göre kanonik olarak sıralanır ($v_A, v_B, v_C$):
$$a = |v_B - v_C|, \quad b = |v_A - v_C|, \quad c = |v_A - v_B| \quad (a \ge b \ge c)$$
Ölçekten bağımsız kenar oranları $r_1 = b / a$ ve $r_2 = c / a$ ile referans katalog eşleştirilir. Odak kalitesi Yarı-Akı Yarıçapı (Half Flux Radius - HFR) ile ölçülür:
$$\text{HFR} = r \quad \text{öyle ki} \quad \int_0^r I(\rho)\rho\,d\rho = \frac{1}{2}\int_0^\infty I(\rho)\rho\,d\rho$$

---

## 🧪 5. 13 Otomatik Denetim Paketi (`npm run audit`)

Chroma Nocta, sıfır hata toleranslı 13 otomatik kalite güvence paketine sahiptir:

1. **Suite #1 — Altın Efemeris Denetimi (`golden-check.ts`):** Bolu ve Erzurum koordinatlarında bağımsız NOAA güneş/ay efemeris referanslarıyla 1:1 tam eşleşme.
2. **Suite #2 — Zaman Dilimi Matrisi (`timezone-matrix-check.ts`):** 9 farklı küresel IANA saat dilimi ve DST (Yaz/Kış saati) geçişlerinin doğrulanması.
3. **Suite #3 — 2-Yıllık Deterministik Süpürme (`year-sweep-check.ts`):** 730 günlük döngüde efemeris hesaplamalarında sıçrama veya anomalilerin denetimi.
4. **Suite #4 — Cihaz Saati & Sessiz Varsayılan Denetimi (`no-device-clock-check.ts`):** Kod tabanında `new Date().getHours()` gibi cihaz saati sızıntılarını ve fonksiyon parametrelerindeki sessiz saat dilimi varsayılanlarını engeller (Grup 1: 0 ihlal, Grup 2: 0 ihlal).
5. **Suite #5 — Ortak Gece & Alacakaranlık Analizi (`common-night-check.ts`):** Farklı enlemlerde astronomik gece pencerelerinin sınır analizi.
6. **Suite #6 — Ay İkiye Bölünme Hassasiyeti (`moon-bisection-check.ts`):** İlk dördün ve son dördün evrelerinin geometrik doğrulaması.
7. **Suite #7 — Topografik Ufuk Çökmesi (`horizon-dip-check.ts`):** Yüksek irtifa gözlem noktalarında ufuk eğriliği matematiği.
8. **Suite #8 — Hava Durumu Önbellek & Yarış Durumu (`weather-cache-check.ts`):** InFlightRequests havuzu ve v4 LocalStorage depolama yalıtımı.
9. **Suite #9 — 2x2 Gece Penceresi Telemetrisi (`night-weather-check.ts`):** Gece aralığı hava durumu özetlerinin sayısal tutarlılığı.
10. **Suite #10 — Saha Saati İzolasyonu (`site-timezone-check.ts`):** `siteTime.ts` motorunun tarayıcı yerel ayarlarından mutlak bağımsızlığı.
11. **Suite #11 — Pencere Kümeleme Doğrulaması (`window-cluster-check.ts`):** 24 aylık karanlık çekim koridorlarının tampon sınırları.
12. **Suite #12 — Tip Kaçışı ve Ratchet Denetimi (`type-escape-check.ts`):** 29 ZERO_LOCK dosyasında tam 0 kaçış (0 any, 0 asCast, 0 asConst, 0 nonNull, 0 tsDirective).
13. **Suite #13 — Çekirdek Sınır Denetimi (`core-boundary-check.ts`):** 55/55 sınır testi (E1-E6, D1-D8, TH1-TH4, EP1, W1-W9, AS1-AS27) ile tam regresyon güvencesi.

---

## 🗺️ 6. Gelecek Yol Haritası (v1.5 Planı)

- **`T-16` (ARAYÜZ):** Çoklu Cihaz Senkronizasyonu & Gelişmiş Spektroskopik Filtre Simülasyonu (Çevrimdışı PWA arka plan senkronizasyonu ve darbant Ha/OIII/SII görünürlük modellemesi).
- **`T-17` (ARAYÜZ):** İstasyon Başlangıç ve Operasyonel Kurulum Ekranı (Field Station Briefing — ilk açılışta 5 sekmeli iş akışı, ana gözlem sahası ve optik profil yapılandırma sihirbazı).
- **`T-18` (ARAYÜZ):** Obsidian Matte Birleşik Tasarım Dili ve Kırmızı Gece Görüş Kilidi (Night-Vision Lock — sıfır mavi ışıklı monokrom gece görüş modu).
- **`T-19` (ÇEKİRDEK):** İvmeölçer Eğim Ölçerli (Clinometer) Kutup Dürbünü Asistanı (Telefon ivmeölçeri ile $\pm 0.1^\circ$ hassasiyetli dijital kutup hizalama kaması).
- **`T-20` (LOJİSTİK):** Nikon .NEF / RAW Gömülü JPEG Ayıklayıcı ve Otomatik Plate-Solve Köprüsü (USB OTG ile aktarılan RAW karelerin ikili başlığından önizleme ayıklayıp yıldız üçgeni çözücüsüne besleme).

---

## ⚡ 7. Yerel Geliştirme ve Doğrulama Komutları

```bash
# Geliştirme sunucusunu başlat (Port 3000)
npm run dev

# Tip kontrolü
npx tsc --noEmit

# Tip kaçışı denetimi (29 ZERO_LOCK dosyası)
npx tsx scripts/type-escape-check.ts

# Çekirdek sınır denetimi (Suite #13, 55/55 test)
npx tsx scripts/core-boundary-check.ts

# 13 test paketinin tamamını çalıştır
npm run audit

# Üretim derlemesi
npm run build
```
