// Muzik secimini dogrular: paket taramasi, indeks araligi, kalicilik,
// kaynak degisimi ve ayar panelindeki satir sayisi.
//
// Kullanim: node tools/check-music.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "index.html"), "utf8");
const js = readFileSync(join(here, "..", "main.js"), "utf8");

const problems = [];
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => {
  problems.push(m);
  console.log("  HATA " + m);
};

// --- DOM / API taklidi -----------------------------------------------------
const store = new Map();
const audio = {
  paused: true,
  currentTime: 0,
  volume: 0.35,
  readyState: 4,
  error: null,
  currentSrc: "",
  src: "",
  _loaded: 0,
  getAttribute(name) {
    return name === "src" ? this.src || null : null;
  },
  setAttribute(name, value) {
    if (name === "src") {
      this.src = value;
      this.currentSrc = "file://" + value;
    }
  },
  load() {
    this._loaded += 1;
  },
  play() {
    this.paused = false;
    return Promise.resolve();
  },
  pause() {
    this.paused = true;
  },
};

const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) {
    nodes.set(id, {
      id,
      textContent: "",
      className: "",
      classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      children: [],
      hasAttribute: () => false,
      getAttribute: () => null,
      setAttribute() {},
      addEventListener() {},
      appendChild() {},
      focus() {},
      style: {},
    });
  }
  return nodes.get(id);
}
node("bgMusic");
Object.assign(nodes.get("bgMusic"), audio);

globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.document = {
  hidden: false,
  documentElement: { lang: "tr" },
  body: { classList: { toggle() {}, add() {}, remove() {} } },
  activeElement: null,
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: (id) => nodes.get(id) || null,
  createElement: () => node("tmp"),
  head: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};
globalThis.setTimeout = () => 0;
globalThis.clearTimeout = () => {};
globalThis.fetch = () => Promise.reject(new Error("offline"));

// --- Ozellik yerinde mi -----------------------------------------------------
console.log("== ozellik kaldirildi mi ==");

html.includes('id="settingMusicTrack"')
  ? ok("ayarlar panelinde muzik satiri var")
  : bad("panelde muzik satiri yok");

html.includes('src="music-tv.mp3"')
  ? ok("audio etiketi varsayilan parca ile geliyor")
  : bad("audio etiketi music-tv.mp3 icermiyor");

for (const fn of ["applyMusicSelection", "getMusicEntry", "clampMusicIndex", "sortMusicEntries"]) {
  js.includes("function " + fn)
    ? ok(fn + " tanimli")
    : bad(fn + " tanimli degil");
}

js.includes("settings.musicIndex")
  ? ok("musicIndex ayar nesnesinde")
  : bad("musicIndex ayar nesnesinde yok");

js.includes('localStorage.setItem("tvDashboardSettings"')
  ? ok("ayarlar localStorage'a yaziliyor")
  : bad("ayarlar kalici degil");

// --- Ayarlar paneli butunlugu ---------------------------------------------
console.log("\n== ayarlar paneli butunlugu ==");

const rowIds = (js.match(/const SETTING_ROWS = \[([\s\S]*?)\];/) || [])[1] || "";
const declared = [...rowIds.matchAll(/"(setting[A-Za-z]+)"/g)].map((m) => m[1]);

for (const id of declared) {
  html.includes(`id="${id}"`) ? ok(id + " HTML'de var") : bad(id + " HTML'de yok");
}

// Paneldeki tum satirlar tanimli mi.
// NOT: ilk satir "settingRow activeSetting" oldugu icin sinif sirasi
// farkli olabilir; yalnizca "settingRow" geçen id'leri topla.
const rowBlocks = [...html.matchAll(/<div id="(setting[A-Za-z]+)" class="settingRow[^"]*"/g)].map((m) => m[1]);
rowBlocks.length === declared.length
  ? ok("satir sayisi esit: " + rowBlocks.length)
  : bad(`satir sayisi farkli: HTML ${rowBlocks.length}, JS ${declared.length}`);
JSON.stringify(rowBlocks) === JSON.stringify(declared)
  ? ok("satir sirasi HTML ile ayni")
  : bad("sira farkli: " + rowBlocks.join(",") + " vs " + declared.join(","));

// Index dagilimi: 0..6 hepsi kullanilmis mi
const adjust = js.match(/function adjustSetting[\s\S]*?\n}/)[0];
const used = [...adjust.matchAll(/activeSettingIndex === (\d)/g)].map((m) => Number(m[1]));
const needed = Array.from({ length: declared.length }, (_, i) => i);
const missing = needed.filter((n) => !used.includes(n));
missing.length === 0
  ? ok("adjustSetting tum satirlari ele aliyor (0.." + (needed.length - 1) + ")")
  : bad("adjustSetting eksik indeksler: " + missing.join(","));

const wrap = js.match(/\(activeSettingIndex \+ SETTING_ROW_COUNT\) % SETTING_ROW_COUNT/);
wrap ? ok("yuklu/asagi sarma sabiti kullaniyor") : bad("sarma sabiti tanimsiz");

// --- Muzik kutuphanesi davranisi ------------------------------------------
console.log("\n== muzik kutuphanesi ==");

const api = new Function(
  js +
    "\n;return { getEl, applyMusicSelection, getMusicEntry, getMusicOptionValue," +
    " clampMusicIndex, backgroundLibrary, settings, normalizeSettings, MEDIA," +
    " setScanComplete: function (v) { backgroundScanComplete = v; } };",
)();

// Simulasyon: iki parcaya listeyi doldur.
api.backgroundLibrary.tracks = [
  { file: "music-tv.mp3", label: "music-tv.mp3" },
  { file: "music2.mp3", label: "music2.mp3" },
];
// clampMusicIndex yalnizca tarama bittikten sonra listeyi kisar; oyun
// basladiktan sonra bu dogru.
api.setScanComplete(true);

api.getMusicEntry(0).file === "music-tv.mp3"
  ? ok("indeks 0 -> ilk parca")
  : bad("indeks 0 yanlis: " + api.getMusicEntry(0).file);
api.getMusicEntry(1).file === "music2.mp3"
  ? ok("indeks 1 -> ikinci parca")
  : bad("indeks 1 yanlis: " + api.getMusicEntry(1).file);
api.getMusicEntry(5).file === "music2.mp3"
  ? ok("indeks 5 -> basa donuyor (2 parcada)")
  : bad("indeks 5 yanlis: " + api.getMusicEntry(5).file);
api.getMusicEntry(-1).file === "music2.mp3"
  ? ok("negatif indeks basa donuyor")
  : bad("negatif indeks yanlis: " + api.getMusicEntry(-1).file);

api.clampMusicIndex(99) === 1 ? ok("clampMusicIndex sona kisiliyor") : bad("clamp yanlis");
api.clampMusicIndex("abc") === 0 ? ok("clampMusicIndex bozuk degeri 0 yapiyor") : bad("clamp bozuk deger");

api.getMusicOptionValue(1) === "music2.mp3 (2/2)"
  ? ok("secici etiketi sayac gosteriyor: " + api.getMusicOptionValue(1))
  : bad("secici etiketi: " + api.getMusicOptionValue(1));

// Kaynak degisimi
const audioNode = api.getEl("bgMusic");
audioNode.src = "music-tv.mp3";
audioNode.currentSrc = "file://music-tv.mp3";
audioNode.paused = false;
api.applyMusicSelection({ musicIndex: 1 });
audioNode.src.endsWith("music2.mp3")
  ? ok("kaynak degisti: " + audioNode.src)
  : bad("kaynak degismedi: " + audioNode.src);
audioNode.paused === false ? ok("calma durumu korundu") : bad("calma durumu degisti");

// Ayni parca tekrar secilirse gereksiz yukleme olmamali
const before = audioNode._loaded;
api.applyMusicSelection({ musicIndex: 1 });
audioNode._loaded === before
  ? ok("ayni parca tekrar yuklenmiyor")
  : bad("ayni parca yeniden yuklendi");

// --- Sonuc ------------------------------------------------------------------
console.log("");
if (problems.length) {
  console.log(`SONUC: ${problems.length} sorun`);
  process.exitCode = 1;
} else {
  console.log("SONUC: muzik secimi saglam");
}