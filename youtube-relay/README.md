# TV Dashboard YouTube Relay (Cloudflare Worker)

TV Dashboard'un Tizen tarafında güvenilir biçimde açamadığı YouTube embed'ini
sağlayan küçük bir HTTPS.origin katmanı. Video akışı **bu Worker'dan geçmez**;
sadece `youtube-nocookie.com/embed/...` iframe'ini içeren HTML döner.

## Neden var

Tizen uygulaması `file://` origin'de çalışır. YouTube embed'i geçerli bir
`origin`/referrer ister; autoplay için de iframe'e `postMessage` gönderen bir
HTTPS sayfası gerekir. Bu Worker o sayfayı sağlar.

## API

```
GET /?v=<videoId>&autoplay=1|0&mute=1|0
GET /health
```

`v` şu biçimleri kabul eder:

- `dQw4w9WgXcQ`
- `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `https://youtu.be/dQw4w9WgXcQ`
- `https://www.youtube.com/embed/dQw4w9WgXcQ`
- `https://www.youtube.com/shorts/dQw4w9WgXcQ`

Geçersiz kimlikte "No video selected" sayfası döner. `/health` JSON döndürür;
uptime kontrolü için kullanılabilir.

## Kurulum

```bash
cd youtube-relay
npm install
npm test
npx wrangler login
npx wrangler deploy
```

Deploy sonrası çıkan adresi (ör. `https://tv-dashboard-youtube-relay.<hesap>.workers.dev`)
ana projede **`main.js`** içindeki iki listeye yaz:

```js
relayOptions: [
  { label: "Otomatik", value: "" },
  { label: "Cloudflare", value: "https://SENIN-ADRESIN.workers.dev" },
  { label: "Yedek relay", value: "https://tvdash-youtube-relay.windows-destekleyeci.chatgpt.site" }
],
relayUrls: [
  "https://SENIN-ADRESIN.workers.dev",
  "https://tvdash-youtube-relay.windows-destekleyeci.chatgpt.site"
]
```

Kendi domain'ini bağlamak istersen `wrangler.toml` içindeki `routes` örneğini
açıp `zone_name`/`pattern` değerlerini düzenle, sonra yeniden deploy et.

TV'de **Ayarlar → YouTube relay** satırıyla aktif kaynağı değiştirebilirsin:
`Otomatik` bütün adresleri sırayla dener, diğer seçenekler tek bir adresi
zorlar. Relay patlarsa uygulama sıradaki yedeğe, en sonda da doğrudan
`youtube-nocookie.com` embed'ine düşer.

## Öneriler

- Cloudflare Dashboard → Workers & Pages → ilgili Worker → **Rate Limiting**
  aç; widget herkese dağıtıldığında IP başına sınır seni korur.
- Domain'i Cloudflare'de tut, auto-renew aç; sertifikayı Cloudflare yönetsin.
- `npx wrangler tail` ile canlı hataları izleyebilirsin.
- Kaynak bu depoda olduğu için Worker başka bir hesaba 1 dakikada taşınır.
