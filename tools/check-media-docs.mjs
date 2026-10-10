// README'deki "Adding your own background media" ve "Music" iddialarini
// kodla karsilastirir. Dokuman yanlissa burasi yakalar.
//
// Kullanim: node tools/check-media-docs.mjs

import { readFileSync } from "node:fs";

const doc = readFileSync("README.md", "utf8");
const html = readFileSync("index.html", "utf8");
const js = readFileSync("main.js", "utf8");

let problems = 0;
const ok = (m) => console.log("  OK   " + m);
const bad = (m) => {
  console.log("  FAIL " + m);
  problems += 1;
};

console.log("== arka plan medyasi bulma ==");

js.includes('tizen.filesystem.resolve("wgt-package"')
  ? ok("wgt-package klasoru taraniyor")
  : bad("paket klasoru taranmiyor gibi");

js.includes("directory.listFiles")
  ? ok("listFiles ile dizin okunuyor")
  : bad("listFiles cagrisi yok");

js.match(/\/\^bg\\d\*\\\.\/i/)
  ? ok("dosya filtresi /^bg\\d*\\./i")
  : bad("beklenen bg filtresi bulunamadi");

console.log("\n== kabul edilen bicimler ==");

// Uzantilar koddan okunur, sabit listeyle degil.
const imageRe = js.match(/if \(\/\\\.\(\?:([a-z|]+)\)\$\/i\.test\(name\)\) images\.push/);
const videoRe = js.match(/if \(\/\\\.(mp4)\$\/i\.test\(name\)\) videos\.push/);
const imageList = imageRe ? imageRe[1].split("|") : [];
const videoList = videoRe ? videoRe[1] : null;

imageList.length ? ok("gorsel: " + imageList.join(", ")) : bad("gorsel filtresi bulunamadi");
videoList ? ok("video: " + videoList) : bad("video filtresi bulunamadi");

// README tablosu kodla ayni mi?
const docImages = /\| Images \| (.+?) \|/.exec(doc);
const docClaim = (docImages ? docImages[1] : "").split(",").map((s) => s.trim().toLowerCase());
const docVideo = /\| Videos \| (.+?) \|/.exec(doc);
const docClaimVideo = (docVideo ? docVideo[1] : "").split(",").map((s) => s.trim().toLowerCase());

JSON.stringify(docClaim) === JSON.stringify(imageList)
  ? ok("README gorsel listesi kodla ayni")
  : bad("README gorsel listesi farkli: " + docClaim.join(",") + " vs " + imageList.join(","));
JSON.stringify(docClaimVideo) === JSON.stringify([videoList])
  ? ok("README video listesi kodla ayni")
  : bad("README video listesi farkli: " + docClaimVideo.join(",") + " vs " + videoList);

// Kabul edilenler disinda bir bicim gercekten ele aliniyor mu.
// Yanlis pozitifleri onlemek icin yalnizca tirnak icinde, sonrasi nokta
// ve bicim adindan olusan gecisler sayilir; "context.moveTo" veya
// "avinfo" gibi kelimelerin icindeki harfler sayilmaz.
const exts = new Set();
for (const m of js.matchAll(/["'`]\s*\.(jpg|jpeg|png|webp|mp4|mkv|avi|mov|gif|bmp)\b/gi)) {
  exts.add(m[1].toLowerCase());
}
const accepted = new Set([...imageList, videoList]);
const unexpected = [...exts].filter((e) => !accepted.has(e));
unexpected.length === 0
  ? ok("beklenmedik bicim yok" + (exts.size ? " (" + [...exts].sort().join(", ") + ")" : ""))
  : bad("belge disi bicim kodu var: " + unexpected.join(", "));

console.log("\n== ayarlar paneli ==");
for (const [id, label] of [
  ["settingBackgroundImage", "photo selection row"],
  ["settingBackgroundVideo", "video selection row"],
  ["settingBackgroundImageValue", "photo selection value"],
  ["settingBackgroundVideoValue", "video selection value"],
]) {
  html.includes(`id="${id}"`) ? ok(label) : bad("panelde eksik: " + label);
}

const cycles = js.match(/activeSettingIndex === [34]/g) || [];
cycles.length >= 2
  ? ok("sol/sag tuslari listede geziniyor (" + cycles.length + " dal)")
  : bad("ayarlarda gecis mantigi bulunamadi");

console.log("\n== yeniden tarama ==");
js.includes("scanPackagedBackgroundMedia")
  ? ok("tarama fonksiyonu var")
  : bad("tarama fonksiyonu yok");

// initBackground tarama zincirini baslatmali. Tarama bir kez calisir
// (backgroundScanComplete) ve her acilista yeniden kurulmus olur.
const scanRefs = js.split("scanPackagedBackgroundMedia").length - 1;
const scanFn = /function scanBackgroundMedia\s*\(/.test(js);
const guarded = /backgroundScanComplete/.test(js);
const calledAtBoot = /initBackground[\s\S]{0,400}?scanBackgroundMedia/.test(js);

scanFn ? ok("scanBackgroundMedia tanimli") : bad("scanBackgroundMedia yok");
guarded ? ok("tarama bir kez calisiyor (backgroundScanComplete)") : bad("tarama korumasiz");
calledAtBoot
  ? ok("tarama acilista tetikleniyor (initBackground)")
  : bad("tarama acilista tetiklenmiyor, README iddiasi yanlis");

const orderFn = js.match(/function getBackgroundFileOrder[\s\S]{0,220}?\n}/);
orderFn && orderFn[0].includes("Number")
  ? ok("siralama sayisal (Number ile)")
  : bad("siralama sayisal degil");
/not\s+alphabetically/.test(doc)
  ? ok("README alfabetik olmadigini soyluyor")
  : bad("README siralamayi yanlis anlatiyor");

console.log("\n== muzik ==");
const audioTag = html.match(/<audio[^>]*>/);
audioTag
  ? ok("audio etiketi: " + audioTag[0].slice(0, 70))
  : bad("audio etiketi yok");
html.includes('src="music-tv.mp3"')
  ? ok("music-tv.mp3 varsayilan kaynak")
  : bad("music-tv.mp3 referansi degil");

// Muzik artik taranabilir olmali: music* filtresi ve bicim listesi.
// Muzik filtresi iki satira bolunmus olabilir: once "music" ile baslayanlari
// secen bir filtre, sonra uzanti listesini belirleyen bir kosul. Uzantilari
// ozelikle arayan satiri sec.
const musicLine = js
  .split("\n")
  .find((l) => /test\(name\)/.test(l) && /\(\?:/.test(l) && /music/.test(l));
// Bicim listesi rakam da icerir ("mp3"), bu yuzden [a-z|] degil
// [a-z0-9|] kullanilir.
const musicFilter = musicLine ? /\(\?:([a-z0-9|]+)\)/.exec(musicLine) : null;
const musicList = musicFilter ? musicFilter[1].split("|") : [];
musicList.length
  ? ok("mzik filtresi: music* + " + musicList.join(", "))
  : bad("mzik dosya filtresi bulunamadi");

const docMusic = /\| Audio \| (.+?) \|/.exec(doc);
const docMusicList = (docMusic ? docMusic[1] : "").split(",").map((s) => s.trim().toLowerCase());
JSON.stringify(docMusicList) === JSON.stringify(musicList)
  ? ok("README ses listesi kodla ayni")
  : bad("README ses listesi farkli: " + docMusicList.join(",") + " vs " + musicList.join(","));

// Muzik secici ayar satiri gercekten var mi.
html.includes('id="settingMusicTrack"')
  ? ok("panelde Muzik secimi satiri var")
  : bad("panelde Muzik secimi satiri yok");
js.includes("applyMusicSelection")
  ? ok("applyMusicSelection cagriliyor")
  : bad("applyMusicSelection yok");

// Muzik icin de tarama olmamali (artik tarama YAPILMASI gerek).
const mp3Refs = (js.match(/["'`]\s*\.mp3\b/gi) || []).length;
mp3Refs <= 1
  ? ok("tek sabit mp3 referansi kaldi (" + mp3Refs + ")")
  : bad("beklenmedik mp3 tarama kodu var: " + mp3Refs);

console.log("\n== belge tutarliligi ==");
doc.includes("Background media and music")
  ? ok("README'de bolum basligi var")
  : bad("README'de bolum basligi yok");
doc.includes("#### Music")
  ? ok("README'de muzik alt basligi var")
  : bad("README'de muzik alt basligi yok");

// Kurulum cercevesi: paketlenen medya boyutu iddiasi gercek mi?
// Iddia README'de iki yerde geciyor ve sayi bir sonraki satira tasabilir.
// Blockquote isaretleri (> ) araya girdigi icin once kaldirilir, sonra
// metin tek duz stringe indirgenir.
const flatDoc = doc
  .replace(/^\s*>\s?/gm, " ")
  .replace(/\s+/g, " ");
const claim = flatDoc.match(/shipped media totals about (\d+) MB/);
if (claim) {
  const stated = Number(claim[1]);
  const files = [
    "bg.jpg", "bg.mp4", "bg2.mp4", "bg2.png", "bg3.jpg",
    "bg3.mp4", "bg4.mp4", "bg5.mp4", "music-tv.mp3",
  ];
  let bytes = 0;
  let found = true;
  for (const f of files) {
    try {
      bytes += readFileSync(f).length;
    } catch {
      found = false;
    }
  }
  const actual = bytes / 1024 / 1024;
  // "about" bir yaklasik deger; 2 MB'den genis fark bir iddia hatasi.
  const diff = Math.abs(actual - stated);
  found && diff <= 3
    ? ok("paket medya iddiasi ~" + stated + " MB ~ gercek " + actual.toFixed(1) + " MB")
    : bad(
      "paket medya iddiasi ~" + stated + " MB ama gercek " +
        (found ? actual.toFixed(1) : "hesaplanamadi") + " MB",
    );
} else {
  bad("paket medya boyutu iddiasi yok");
}

console.log(problems ? `\n${problems} sorun` : "\nDogrulama temiz");
process.exitCode = problems ? 1 : 0;