import { readFileSync } from "node:fs";

// Surum numarasi dort yerde tekrar ediyor. Birini guncelleyip digerlerini
// unutmak, TV'de eski dosyalarin cache'lenmesine yol acar.

const js = readFileSync("main.js", "utf8");
const html = readFileSync("index.html", "utf8");
const cfg = readFileSync("config.xml", "utf8");

const versions = [
  ["main.js APP_VERSION", js.match(/\bconst APP_VERSION = "([^"]+)"/)?.[1]],
  ["index.html style.css?v=", html.match(/href="style\.css\?v=([^"]+)"/)?.[1]],
  ["index.html main.js?v=", html.match(/src="main\.js\?v=([^"]+)"/)?.[1]],
  ["index.html appVersion", html.match(/id="appVersion">v([^<]+)</)?.[1]],
  ["config.xml widget version", cfg.match(/<widget\b[^>]*\bversion="([^"]+)"/)?.[1]],
];

let problems = 0;
for (const [label, value] of versions) {
  if (!value) {
    console.log(`  FAIL ${label}: bulunamadi`);
    problems += 1;
  } else {
    console.log(`  OK   ${label}: ${value}`);
  }
}

const unique = new Set(versions.map((entry) => entry[1]).filter(Boolean));
if (unique.size !== 1) {
  console.log(`\nFAIL surumler tutarsiz: ${[...unique].join(", ")}`);
  problems += 1;
}

console.log(problems ? `\n${problems} sorun` : "\nSurumler tutarli");
process.exitCode = problems ? 1 : 0;
