// EN_DYNAMIC sozlugunun kapsamini denetler.
//
// Kullanim: node tools/check-i18n.mjs
//
// setText/setStatus/updateFooter cagilarina dogrudan gecilen Turkce
// metinleri toplar ve EN_DYNAMIC'te karsiliklari olup olmadigini kontrol
// eder. Ayrica kaynak dosyada Latin-1/UTF-8 karisimi (mojibake) arar.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "main.js"), "utf8");

function readObjectLiteral(name) {
  const start = source.indexOf(`const ${name} = {`);
  if (start < 0) throw new Error(`${name} bulunamadi`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart + 1, i);
    }
  }
  throw new Error(`${name} kapanmadi`);
}

const dynamicBody = readObjectLiteral("EN_DYNAMIC");
const known = new Set(
  [...dynamicBody.matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].map((m) => m[1]),
);

// setText("id", "metin") / setStatus("id", "metin", "class") ...
const CALL = /\bset(?:Text|Status)\(\s*"[^"]*"\s*,\s*"((?:[^"\\]|\\.)*)"/g;
// setYoutubeMessage("metin", "class") ilk argumani dogrudan metindir.
const YOUTUBE_CALL = /\bsetYoutubeMessage\(\s*"((?:[^"\\]|\\.)*)"/g;
// updateFooter("metin") ve updateFooter(condition ? "a" : "b") icindeki
// literal'ler de ayni sozluge gider; ternaries icin parantez icini taririz.
const FOOTER_CALL = /\bupdateFooter\(([^)]*)\)/g;
const LITERAL = /"((?:[^"\\]|\\.)*)"/g;

const turkish = /[ÇĞİIÖŞÜçğıöşü]|\b(?:ve|ile|için|olarak|çın|aç|kapat|bulunamadı|okunamadı|yok|var|seç|oynat|duraklat|devam|başlat|dur)\b/i;

const entries = [];
for (const m of source.matchAll(CALL)) {
  entries.push({ literal: m[1], index: m.index });
}
for (const m of source.matchAll(YOUTUBE_CALL)) {
  entries.push({ literal: m[1], index: m.index });
}
for (const call of source.matchAll(FOOTER_CALL)) {
  for (const lit of call[1].matchAll(LITERAL)) {
    entries.push({ literal: lit[1], index: call.index + lit.index });
  }
}

const missing = new Map();
let total = 0;
for (const entry of entries) {
  if (!turkish.test(entry.literal)) continue;
  total += 1;
  if (!known.has(entry.literal)) {
    const line = source.slice(0, entry.index).split("\n").length;
    missing.set(entry.literal, line);
  }
}

// "artÄ±rÄ±ldÄ±" gibi bozuk dizgeler ne Turkce regex'e ne de sozluge
// uyar; EN modunda oldugu gibi ekranda gorunur. Her satiri tara.
const mojibake = [];
source.split(/\r?\n/).forEach(function (line, index) {
  if (/[ÄÃÂ]/.test(line)) mojibake.push({ line: index + 1, text: line.trim() });
});

console.log(`setText/setStatus/setYoutubeMessage/updateFooter icinde Turkce literal: ${total}`);
console.log(`EN_DYNAMIC anahtari: ${known.size}`);
console.log(`Eksik ceviri: ${missing.size}`);
console.log(`Bozuk kodlama: ${mojibake.length}`);

if (missing.size) {
  console.log("\nEksik olanlar (EN dilinde Turkce kalir):");
  for (const [literal, line] of [...missing].sort((a, b) => a[1] - b[1])) {
    console.log(`  main.js:${line}  ${literal}`);
  }
}
if (mojibake.length) {
  console.log("\nBozuk kodlama (UTF-8 yerine Latin-1 okunmus):");
  for (const item of mojibake) console.log(`  main.js:${item.line}  ${item.text}`);
}

if (missing.size || mojibake.length) process.exitCode = 1;
