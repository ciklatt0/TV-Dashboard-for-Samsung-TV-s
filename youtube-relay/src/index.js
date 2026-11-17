// TV Dashboard için minimal YouTube embed relay'i.
// Video baytları buradan geçmez; yalnızca youtube-nocookie iframe'ini içeren
// bir HTML sayfası döndürülür. Autoplay, postMessage ile zorlanır.

const TITLE = "TV Dashboard YouTube Relay";
const EMBED_ORIGIN = "https://www.youtube-nocookie.com";
const NUDGE_DELAYS_MS = [250, 900, 1800];

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=300",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff"
};

export function extractVideoId(value) {
  const text = String(value || "");
  const match =
    text.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/) ||
    text.match(/^([A-Za-z0-9_-]{11})$/);
  return match ? match[1] : "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function playCommand(func) {
  return JSON.stringify({ event: "command", func, args: [] });
}

export function buildRelayHtml({ videoId, autoplay = true, mute = false, origin = "" }) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${TITLE}</title></head>` +
      `<body style="margin:0;background:#080b14;color:#fff;font:14px sans-serif;display:grid;place-items:center;height:100vh">` +
      `No video selected</body></html>`;
  }

  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: mute ? "1" : "0",
    controls: "0",
    disablekb: "1",
    fs: "0",
    iv_load_policy: "3",
    playsinline: "1",
    rel: "0",
    loop: "1",
    playlist: videoId,
    enablejsapi: "1"
  });
  if (origin) params.set("origin", origin);
  params.set("widget_referrer", origin ? origin + "/" : "");

  const iframeSrc = `${EMBED_ORIGIN}/embed/${videoId}?${params.toString()}`;
  const commands = [playCommand("playVideo"), playCommand("play")];
  const delays = JSON.stringify(NUDGE_DELAYS_MS);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${escapeHtml(TITLE)}</title>
  <style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
    #youtubeFrame { display: block; width: 100vw; height: 100vh; border: 0; }
  </style>
</head>
<body>
  <iframe id="youtubeFrame" title="YouTube player" src="${escapeHtml(iframeSrc)}"
    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
    referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
  <script>
    (function () {
      var frame = document.getElementById("youtubeFrame");
      var commands = ${JSON.stringify(commands)};
      var delays = ${delays};
      var target = ${JSON.stringify(EMBED_ORIGIN)};

      function send() {
        if (!frame || !frame.contentWindow) return;
        commands.forEach(function (command) {
          try { frame.contentWindow.postMessage(command, target); } catch (e) {}
        });
      }

      frame.addEventListener("load", function () {
        send();
        delays.forEach(function (delay) { setTimeout(send, delay); });
      });
      setTimeout(send, 50);
    }());
  </script>
</body>
</html>`;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          service: "tv-dashboard-youtube-relay",
          time: new Date().toISOString()
        }),
        {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "access-control-allow-origin": "*"
          }
        }
      );
    }

    const videoId = extractVideoId(url.searchParams.get("v"));
    const autoplay = url.searchParams.get("autoplay") !== "0";
    const mute = url.searchParams.get("mute") === "1";
    const body = buildRelayHtml({
      videoId,
      autoplay,
      mute,
      origin: url.origin
    });

    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: HTML_HEADERS
    });
  }
};
