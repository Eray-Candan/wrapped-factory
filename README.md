# Wrapped Fabrikası

Verileri kaydırmalı hikâyelere, paylaşılabilir görsellere ve Reels formatında videolara dönüştüren, tarayıcıda çalışan bir web uygulaması.

> **Durum:** Statik HTML/CSS/JavaScript projesi. Derleme adımı veya paket yöneticisi gerektirmez.

## Özellikler

- **GitHub:** Herkese açık profil ve katkı verilerinden yıllık özet.
- **Takım:** Organizasyon/depo etkinliklerini karşılaştırma.
- **Kod Soruları:** Stack Exchange profil istatistikleri.
- **Satranç:** Lichess ve Chess.com oyun verileri.
- **Anime:** AniList listelerinden özet.
- **Film:** Letterboxd dışa aktarım dosyalarından özet.
- **WhatsApp:** Sohbet dışa aktarım dosyalarını yerel olarak analiz etme.
- **Müzik:** Spotify veri dışa aktarım dosyalarından istatistik.
- Kartları gezme, görsel olarak dışa aktarma ve video oluşturma.
- Örnek veriyle bazı akışları deneme.

Özellikler, ilgili veri kaynağının sağladığı alanlara ve dışa aktarım biçimine bağlıdır.

## Yerelde çalıştırma

1. Bu depoyu indirin veya klonlayın.
2. `index.html` dosyasını güncel bir tarayıcıda açın.
3. Tarayıcı kısıtları nedeniyle bir özellik doğrudan dosya üzerinden çalışmazsa yerel bir HTTP sunucusu kullanın. Örneğin Python yüklüyse proje klasöründe:

   ```bash
   python -m http.server 8000
   ```

   Ardından `http://localhost:8000` adresini açın.

Node.js, npm veya derleme aracı normal kullanım için gerekli değildir.

## Proje yapısı

- `index.html` — ana sayfa ve komut dosyalarının yüklenme sırası.
- `style.css` ve `theme-*.css` — temel arayüz ve hikâye temaları.
- `engine.js` — uygulamanın ortak hikâye üretim motoru.
- `app.js` — kaynak seçimi, form üretimi ve uygulama akışı.
- `github.js`, `team.js`, `stack.js`, `chess.js`, `anime.js`, `film.js`, `whatsapp.js`, `music.js` — veri kaynakları ve analiz mantığı.
- `scenes-*.js`, `scene-lib.js` — hikâye sahneleri ve ortak yardımcılar.
- `motion.js`, `audio.js` — hareket, video ve ses yardımcıları.
- `gizlilik.html` — gizlilik bildirimi taslağı.
- `vercel.json` — Vercel dağıtım ayarları ve temel güvenlik başlıkları.

## Gizlilik ve güvenlik

- Sohbet ve müzik gibi kullanıcı tarafından yüklenen dışa aktarım dosyaları tarayıcı içinde işlenmek üzere tasarlanmıştır; hassas dosyaları yalnızca güvendiğiniz cihazlarda açın.
- Kullanıcı adıyla çalışan özellikler, verileri ilgili üçüncü taraf API'lerinden doğrudan tarayıcıya alır. Bu hizmetlerin kendi koşulları geçerlidir.
- İsteğe bağlı GitHub erişim token'ı, bu sekmenin belleğinde tutulur ve GitHub API isteklerinde GitHub'a gönderilir. Token'ı kaynak koduna, issue'lara veya ekran görüntülerine koymayın; güvenmediğiniz cihazlarda kullanmayın. Gerekli değilse token alanını boş bırakın.
- Gizlilik sayfasında yayın öncesi doldurulması gereken hukuki/işletme bilgisi alanları bulunur. `gizlilik.html` bir **taslaktır**; yayınlamadan önce gerçek barındırma ve veri işleme uygulamalarına göre gözden geçirilmelidir.
- Bu depoda uygulama için bir açık kaynak lisansı belirtilmemiştir. Bir lisans eklenene kadar kullanım ve yeniden dağıtım haklarını varsaymayın. `YAZI-TIPI-LISANSLARI.txt` yazı tiplerine ait lisans bildirimlerini içerir.

## Dağıtım

Proje statik dosyalardan oluştuğu için Vercel gibi statik barındırma hizmetlerine dağıtılabilir. Depoyu içe aktarırken proje kök dizinini seçin; özel bir build komutu veya output dizini tanımlamayın. `vercel.json` mevcut güvenlik başlıklarını ayarlar.

GitHub Pages kullanılacaksa depoda `index.html` kök dizinde kalmalıdır. Dağıtım öncesi ana sayfa, gizlilik sayfası, dosya yükleme akışları ve dış API kullanan özellikler gerçek tarayıcıda kontrol edilmelidir.

## Kontroller

Bu kaynak paketi için yapılan temel statik kontroller:

- JavaScript dosyalarının `node --check` ile sözdizimi kontrolü.
- Ana sayfada referans verilen yerel dosyaların varlık kontrolü.
- Kaynak kodunda yaygın gizli anahtar/token desenlerinin taranması.

Bu kontroller tam işlevsel tarayıcı testi veya güvenlik denetimi yerine geçmez.

## Bağımsızlık bildirimi

Wrapped Fabrikası, adı geçen platformlardan bağımsız bir projedir; bu hizmetler tarafından desteklendiği veya onaylandığı iddia edilmez.
