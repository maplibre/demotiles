export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Pass everything that isn't a .pmtiles file straight through to GitHub Pages
    // (demo HTML, screenshots, etc. under /pmtiles/*).
    if (!url.pathname.endsWith(".pmtiles")) {
      return fetch(request);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // R2 key mirrors the path, e.g. "pmtiles/vector/world.pmtiles"
    const key = url.pathname.replace(/^\/+/, "");

    const object = await env.BUCKET.get(key, {
      range: request.headers,   // honor the client's Range request natively
      onlyIf: request.headers,  // honor If-Range / If-None-Match for caching
    });

    if (object === null) {
      return new Response("Not Found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);     // strong ETag passed through unchanged
    headers.set("Accept-Ranges", "bytes");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "public, max-age=86400");

    // No body => conditional request matched (304).
    if (!("body" in object) || object.body === undefined) {
      return new Response(null, { status: 304, headers });
    }

    const isRange = object.range && request.headers.has("range");
    if (isRange) {
      const offset = object.range.offset ?? 0;
      const length = object.range.length ?? (object.size - offset);
      const end = offset + length - 1;
      headers.set("Content-Range", `bytes ${offset}-${end}/${object.size}`);
    }

    return new Response(object.body, {
      status: isRange ? 206 : 200,
      headers,
    });
  },
};
