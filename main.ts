// Deno Deploy Proxy with daily limit (100k requests + 2 GB)

const REQUEST_LIMIT = 100000;
const BANDWIDTH_LIMIT = 2 * 1024 * 1024 * 1024; // 2 GB

let requestCount = 0;
let bandwidthUsed = 0;
let lastReset = new Date().toISOString().slice(0, 10);

function resetIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastReset) {
    requestCount = 0;
    bandwidthUsed = 0;
    lastReset = today;
  }
}

async function handler(req: Request): Promise<Response> {
  resetIfNeeded();

  if (requestCount >= REQUEST_LIMIT) {
    return new Response("Daily request limit reached. Try tomorrow.", { status: 429 });
  }

  const url = new URL(req.url);
  let target = url.searchParams.get("url");

  if (!target) {
    return new Response(
      `Proxy Active\nUsage: ?url=https://google.com\nToday: ${(bandwidthUsed / (1024 * 1024)).toFixed(2)} MB / 2048 MB | Requests: ${requestCount} / ${REQUEST_LIMIT}`
    );
  }

  const headers = new Headers(req.headers);
  headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
  headers.set("Accept-Language", "en-US,en;q=0.9");
  headers.delete("Origin");
  headers.delete("Referer");

  try {
    const response = await fetch(target, { headers });
    const clone = response.clone();
    const size = (await clone.arrayBuffer()).byteLength;

    requestCount++;
    bandwidthUsed += size;

    const newHeaders = new Headers(response.headers);
    newHeaders.set("X-Remaining-Req", (REQUEST_LIMIT - requestCount).toString());
    newHeaders.set("X-Remaining-MB", ((BANDWIDTH_LIMIT - bandwidthUsed) / (1024 * 1024)).toFixed(2));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

Deno.serve(handler);
