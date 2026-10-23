# Wrapped Fabrikası

**Kişisel verilerini paylaşılabilir hikâyelere dönüştür.** GitHub, takım etkinliği, Stack Exchange, satranç, anime, film, WhatsApp ve müzik verilerinden kaydırmalı hikâyeler, görseller ve Reels biçiminde videolar üretmeye yönelik tarayıcı tabanlı bir uygulama.

> **Durum:** Geliştirme aşamasında. Kaynak dosyaları ve temel statik kontroller mevcut; tüm akışlar henüz uçtan uca doğrulanmış değildir.

## Özellikler

- GitHub herkese açık profil ve katkı verileri
- Organizasyon/depo karşılaştırmaları
- Stack Exchange profil istatistikleri
- Lichess ve Chess.com oyun verileri
- AniList anime listeleri
- Letterboxd dışa aktarım dosyaları
- WhatsApp sohbet dışa aktarım dosyaları
- Spotify veri dışa aktarım dosyaları
- Hikâye kartları, paylaşılabilir görseller ve video oluşturma

Kaynakların kullanılabilirliği, ilgili hizmetlerin API'lerine ve dosya dışa aktarım biçimlerine bağlıdır.

## Yerelde çalıştırma

1. Depoyu klonlayın veya ZIP olarak indirin.
2. Proje kök dizininde bir terminal açın.
3. Python yüklüyse `python -m http.server 8000` komutunu çalıştırın.
4. Tarayıcıda `http://localhost:8000` adresini açın.

Basit kullanım için Node.js, npm veya derleme adımı gerekmez. Tarayıcı kısıtları nedeniyle `index.html` dosyasını doğrudan açmak yerine yerel HTTP sunucusu kullanılması önerilir.

## Dosya yapısı

- `index.html`: uygulama giriş sayfası
- `app.js`, `engine.js`, `scene-lib.js`: uygulama akışı ve hikâye motoru
- `github.js`, `team.js`, `stack.js`, `chess.js`, `anime.js`, `film.js`, `whatsapp.js`, `music.js`: kaynaklara özel analiz
- `scenes-*.js`: hikâye sahneleri
- `style.css`, `theme-*.css`: arayüz ve tema stilleri
- `motion.js`, `audio.js`: hareket, video ve ses yardımcıları
- `gizlilik.html`: gizlilik bildirimi taslağı
- `vercel.json`: statik dağıtım ve HTTP güvenlik başlıkları
- `YAZI-TIPI-LISANSLARI.txt`: yazı tipi lisans bildirimleri

## Gizlilik ve güvenlik

- WhatsApp, Spotify ve Letterboxd gibi kullanıcı dosyaları tarayıcıda işlenmek üzere tasarlanmıştır. Hassas dosyaları yalnızca güvendiğiniz cihazlarda kullanın.
- Kullanıcı adıyla çalışan özellikler, ilgili üçüncü taraf API'lerine istek gönderir. Bu hizmetler IP adresinizi ve istek bilgilerini görebilir; kendi koşulları geçerlidir.
- GitHub erişim token'ı kullanırsanız token tarayıcıda bellekte tutulsa bile GitHub API isteklerinde GitHub'a gönderilir. Token'ı koda, issue'lara veya ekran görüntülerine eklemeyin; mümkün olan en dar izinli ve süreli token'ı kullanın.
- Gizlilik bildirimi hukuki danışmanlık değildir. Barındırma sağlayıcısı, veri işleme ve iletişim bilgileri gerçek uygulamaya göre doğrulanmadan hukuki uyumluluk iddiasında bulunmayın.
- Bu depoda henüz bir proje açık kaynak lisansı belirtilmemiştir. Bir lisans seçilene kadar kodun yeniden kullanım haklarını varsaymayın. Yazı tiplerinin lisansları ayrı dosyada yer alır.

## Dağıtım

Bu proje statik dosyalardan oluşur. Vercel'de depoyu içe aktarırken kök dizini kullanın; build komutu ve output dizini tanımlamayın. GitHub Pages kullanırken kaynak dosyaların ve `index.html` dosyasının depo kökünde olması gerekir.

Dağıtımdan önce ana akışları güncel tarayıcılarda deneyin: her veri kaynağı, hatalı dosya, boş veri, mobil görünüm, kart indirme ve video dışa aktarma. Ayrıca gizlilik metnini ve tüm dış API çağrılarını doğrulayın.

## Kontrollerin kapsamı

Kaynak paketi üzerinde JavaScript sözdizimi, ana HTML yerel dosya referansları, Vercel yapılandırması ve yaygın token/özel anahtar desenleri için statik kontroller yapıldı. Bunlar tam tarayıcı testi, bağımsız güvenlik denetimi veya hukuki inceleme yerine geçmez.

## Bağımsızlık bildirimi

Wrapped Fabrikası, adı geçen platformlardan bağımsız bir projedir; bu hizmetler tarafından desteklendiği veya onaylandığı iddia edilmez.
