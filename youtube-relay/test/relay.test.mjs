import assert from "node:assert/strict";
import test from "node:test";

import worker, { buildRelayHtml, extractVideoId } from "../src/index.js";

test("video id extraction", () => {
  assert.equal(extractVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractVideoId("https://youtu.be/dQw4w9WgXcQ?t=5"), "dQw4w9WgXcQ");
  assert.equal(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractVideoId("short"), "");
});

test("embed html contains nocookie iframe and autoplay commands", () => {
  const html = buildRelayHtml({ videoId: "dQw4w9WgXcQ", autoplay: true, origin: "https://relay.example.com" });
  assert.match(html, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.match(html, /playVideo/);
  assert.match(html, /enablejsapi=1/);
  assert.match(html, /relay\.example\.com/);
});

test("invalid id renders empty state", () => {
  const html = buildRelayHtml({ videoId: "", autoplay: true });
  assert.match(html, /No video selected/);
  assert.doesNotMatch(html, /youtubeFrame/);
});

test("/health returns json", async () => {
  const response = await worker.fetch(new Request("https://relay.example.com/health"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  const payload = await response.json();
  assert.equal(payload.ok, true);
});

test("root serves embed html", async () => {
  const response = await worker.fetch(
    new Request("https://relay.example.com/?v=dQw4w9WgXcQ&autoplay=1&mute=0")
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /id="youtubeFrame"/);
  assert.match(html, /autoplay=1/);
});
