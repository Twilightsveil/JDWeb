export async function onRequestGet(context) {
  const { env, params } = context;

  const obj = await env.PHOTOS.get(params.key);
  if (!obj) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  // private: cacheable only by the requesting browser, never by Cloudflare's shared edge cache —
  // this endpoint requires a session cookie, so a shared/public cache would leak photos to anyone.
  headers.set("Cache-Control", "private, max-age=86400");

  return new Response(obj.body, { headers });
}
