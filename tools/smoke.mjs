// Uygulamanin gercek bir DOM varmis gibi acilip acilmadigini ve konsol
// hatasi uretip uretmedigini dogrular. Tizen API'leri yoksa uygulama
// yine de calismali; kumanda akislari da istisna vermemeli.
//
// Kullanim: node tools/smoke.mjs
// Girdi: kokteki index.html + main.js.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "index.html"), "utf8");
const js = readFileSync(join(here, "..", "main.js"), "utf8");

// --- Minimal DOM -------------------------------------------------------------
// jsdom gibi bir bagimlilik olmadan, index.html'deki gercek id/sinif/satir
// yapisini kullanarak bir agac kuruyoruz. Boylece boot() ve kumanda
// handler'lari gercekten calisiyor; getElementById her zaman null donmuyor.

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);
const allElements = [];
const documentListeners = {};

class Element {
  constructor(tag, attrs, parent) {
    this.tagName = tag;
    this.attributes = new Map(Object.entries(attrs));
    this.children = [];
    this.textParts = [];
    this.parentNode = parent;
    this.id = this.getAttribute("id") || "";
    this.className = this.getAttribute("class") || "";
    this.style = {};
    this.hidden = this.hasAttribute("hidden");
    this.listeners = {};
    this.offsetWidth = 400;
    this.offsetHeight = 100;
    this.paused = true;
    this.currentTime = 0;
    this.duration = NaN;
    this.readyState = 0;
    this.error = null;
    this.volume = 1;
    this.loop = false;
    this.muted = false;
    this.src = this.getAttribute("src") || "";

    const classes = new Set(this.className.split(/\s+/).filter(Boolean));
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, force) => {
        const next = force === undefined ? !classes.has(name) : !!force;
        if (next) classes.add(name);
        else classes.delete(name);
        return next;
      },
    };

    if (tag === "audio" || tag === "video") {
      this.play = () => {
        this.paused = false;
        this.dispatch("play");
        this.dispatch("playing");
        return Promise.resolve();
      };
      this.pause = () => {
        this.paused = true;
        this.dispatch("pause");
      };
      this.load = () => this.dispatch("load");
    }

    if (parent) parent.children.push(this);
    allElements.push(this);
  }

  get textContent() {
    return this.textParts.join("") + this.children.map((c) => c.textContent).join("");
  }

  set textContent(value) {
    this.textParts = [String(value)];
    this.children = [];
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "hidden") this.hidden = true;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "hidden") this.hidden = false;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }

  dispatch(type, event) {
    for (const fn of (this.listeners[type] || []).slice()) {
      fn.call(this, event || { type, target: this });
    }
  }

  focus() {
    if (globalThis.document) globalThis.document.activeElement = this;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 400, height: 100, right: 400, bottom: 100 };
  }
}

const root = new Element("#document", {}, null);
const stack = [root];
const tokenRe = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/?([A-Za-z][\w:-]*)([^>]*?)(\/?)>|([^<]+)/g;
const attrRe = /([:\w-]+)\s*=\s*"([^"]*)"|([:\w-]+)/g;
let token;
while ((token = tokenRe.exec(html))) {
  if (token[0].startsWith("<!--") || token[0].startsWith("<!DOCTYPE")) continue;

  if (token[1]) {
    const tag = token[1].toLowerCase();
    if (token[0].startsWith("</")) {
      for (let index = stack.length - 1; index >= 1; index--) {
        if (stack[index].tagName === tag) {
          stack.length = index;
          break;
        }
      }
      continue;
    }

    const attrs = {};
    attrRe.lastIndex = 0;
    let attr;
    while ((attr = attrRe.exec(token[2]))) {
      const name = attr[1] || attr[3];
      if (name && !(name in attrs)) attrs[name] = attr[2] !== undefined ? attr[2] : "";
    }

    const parent = stack[stack.length - 1] || root;
    const element = new Element(tag, attrs, parent);
    if (!VOID_TAGS.has(tag) && token[3] !== "/") stack.push(element);
    continue;
  }

  if (token[4] && token[4].trim()) {
    (stack[stack.length - 1] || root).textParts.push(token[4]);
  }
}

function matches(element, selector) {
  if (selector.startsWith("#")) return element.id === selector.slice(1);
  if (selector.startsWith("[")) return element.hasAttribute(selector.slice(1, -1));
  if (selector.startsWith(".")) return element.classList.contains(selector.slice(1));
  return element.tagName === selector.toLowerCase();
}

function descendants(element) {
  const result = [];
  for (const child of element.children) {
    result.push(child, ...descendants(child));
  }
  return result;
}

function queryAll(selector) {
  const result = [];
  for (const group of selector.split(",")) {
    const parts = group.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    let candidates = allElements;
    if (parts.length === 2 && parts[1] === "*") {
      const parents = allElements.filter((el) => matches(el, parts[0]));
      candidates = [];
      for (const parent of parents) {
        for (const child of descendants(parent)) {
          if (!candidates.includes(child)) candidates.push(child);
        }
      }
    } else {
      candidates = allElements.filter((el) => matches(el, parts[parts.length - 1]));
    }
    for (const el of candidates) {
      if (!result.includes(el)) result.push(el);
    }
  }
  return result;
}

function queryOne(selector) {
  return queryAll(selector)[0] || null;
}

const htmlElement = allElements.find((el) => el.tagName === "html") || root;
const bodyElement = allElements.find((el) => el.tagName === "body") || root;
const store = new Map();

globalThis.window = globalThis;
globalThis.addEventListener = (type, fn) => {
  if (type === "load") globalThis.__boot = fn;
};
globalThis.document = {
  hidden: false,
  documentElement: htmlElement,
  body: bodyElement,
  activeElement: null,
  getElementById: (id) => allElements.find((el) => el.id === id) || null,
  querySelector: queryOne,
  querySelectorAll: queryAll,
  createElement: (tag) => new Element(tag, {}, null),
  addEventListener: (type, fn) => {
    (documentListeners[type] ||= []).push(fn);
    if (type === "load") globalThis.__boot = fn;
  },
  dispatch: (type, event) => {
    for (const fn of (documentListeners[type] || []).slice()) {
      fn(event || { type, target: globalThis.document });
    }
  },
};
// Node 22+ navigator/location icin salt-okunur global getter tanimliyor.
function defineGlobal(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

defineGlobal("navigator", { onLine: false });
defineGlobal("location", { href: "file:///C:/tvdashboard/index.html" });
defineGlobal("history", { back() {} });
defineGlobal("innerWidth", 1920);
defineGlobal("innerHeight", 1080);
defineGlobal("screen", { width: 1920, height: 1080 });
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  key: (index) => [...store.keys()][index] ?? null,
  get length() { return store.size; },
};
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};
globalThis.setTimeout = () => 0;
globalThis.clearTimeout = () => {};
globalThis.fetch = () => Promise.reject(new Error("offline"));

const runtimeErrors = [];

function runStep(label, fn) {
  try {
    fn();
    console.log(`  ${label}: OK`);
  } catch (error) {
    runtimeErrors.push(`${label}: ${error.message}`);
    console.log(`  ${label} HATA: ${error.message}`);
  }
}

function key(code) {
  globalThis.document.dispatch("keydown", { keyCode: code, preventDefault() {} });
}

// --- Sozdizimi ---------------------------------------------------------------
console.log("--- syntax ---");
try {
  new Function(js);
  console.log("  main.js ayristirildi: OK");
} catch (error) {
  console.log("  main.js AYRISTIRILAMADI:", error.message);
  process.exitCode = 1;
}

// --- boot --------------------------------------------------------------------
console.log("\n--- boot ---");
try {
  new Function(js)();
  if (typeof globalThis.__boot === "function") {
    globalThis.__boot();
    console.log("  boot() calisti: OK");
  } else {
    throw new Error("boot() kaydedilmedi");
  }
} catch (error) {
  runtimeErrors.push(`boot(): ${error.message}`);
  console.log("  boot() HATA:", error.message);
  console.log(error.stack?.split("\n").slice(0, 4).join("\n"));
  process.exitCode = 1;
}

// --- Kumanda ve overlay akislari ---------------------------------------------
console.log("\n--- kumanda akislari ---");
runStep("dil onayi (OK)", () => key(13));
runStep("kart odaklama (yon tuslari)", () => [37, 38, 39, 40].forEach(key));
runStep("ayarlari ac", () => queryOne(".settingsCard")?.dispatch("click"));
runStep("ayar satirlari ve degisiklikler", () => {
  for (let index = 0; index < 3; index++) key(40);
  [37, 39, 37, 39].forEach(key);
  for (let index = 0; index < 3; index++) key(40);
  [37, 39].forEach(key);
});
runStep("ayarlari kaydet (OK)", () => key(13));
runStep("ses tuslari", () => [447, 448, 449].forEach(key));
runStep("medya tuslari", () => [415, 19, 10252].forEach(key));
runStep("arka plansa gec / geri don", () => {
  globalThis.document.hidden = true;
  globalThis.document.dispatch("visibilitychange");
  globalThis.document.hidden = false;
  globalThis.document.dispatch("visibilitychange");
});
runStep("cikis (Geri)", () => key(10009));

// --- Tanimsiz cagri denetimi --------------------------------------------------
console.log("\n--- tanimsiz cagri denetimi ---");
const gone = [
  "playYoutube", "pauseYoutube", "toggleYoutube", "openYoutubeSearch",
  "closeYoutubeSearch", "initYoutube", "loadYoutubeSelection",
  "updateYoutubeSearchCard", "updateYoutubeMiniCard", "updateYoutubePlaybackChrome",
  "stopYoutubeBackground", "clearEmbeddedYoutubePlayer", "decodeYoutubeText",
  "extractYoutubeVideoId", "pickBestYoutubeStream", "fetchJsonWithTimeout",
  "buildPipedSearchUrl", "handleYoutubeOverlayKey", "youtubePlayer",
];
const left = gone.filter((name) => new RegExp(`\\b${name}\\b`).test(js));
console.log(left.length ? `  KALAN: ${left.join(", ")}` : "  temiz");
if (left.length) process.exitCode = 1;

const defs = [...js.matchAll(/^(?:async )?function (\w+)\s*\(/gm)].map((m) => m[1]);
const dead = defs.filter((name) => {
  const refs = [...js.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length;
  return refs <= 1;
});
console.log(dead.length ? `  OLU: ${dead.join(", ")}` : "  olu fonksiyon yok");
if (dead.length) process.exitCode = 1;

const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const usedIds = [...js.matchAll(/getEl\("([^"]+)"\)/g)].map((m) => m[1]);
const orphans = [...new Set(usedIds)].filter((id) => !ids.includes(id));
console.log(orphans.length ? `  HTML'de olmayan id: ${orphans.join(", ")}` : "  tum id'ler HTML'de var");
if (orphans.length) process.exitCode = 1;

if (runtimeErrors.length) {
  console.log(`\nHATA: ${runtimeErrors.length}`);
  process.exitCode = 1;
} else {
  console.log("\nHata yok.");
}
