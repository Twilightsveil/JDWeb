import { davUrl, authHeader } from "../../_lib/nextcloud.js";

export async function onRequestGet(context) {
  const { env, params, request } = context;

  const headers = { Authorization: authHeader(env) };
  const range = request.headers.get("Range");
  if (range) headers["Range"] = range;

  let res;
  try {
    res = await fetch(davUrl(env, params.name), { headers });
  } catch (err) {
    return new Response("Could not reach Nextcloud", { status: 502 });
  }
  if (res.status === 404) return new Response("Not found", { status: 404 });
  if (!res.ok && res.status !== 206) return new Response("Could not reach Nextcloud", { status: 502 });

  const outHeaders = new Headers();
  ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"].forEach(function (h) {
    const v = res.headers.get(h);
    if (v) outHeaders.set(h, v);
  });
  outHeaders.set("Cache-Control", "private, max-age=60");

  return new Response(res.body, { status: res.status, headers: outHeaders });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  let res;
  try {
    res = await fetch(davUrl(env, params.name), {
      method: "DELETE",
      headers: { Authorization: authHeader(env) }
    });
  } catch (err) {
    return new Response("Could not reach Nextcloud", { status: 502 });
  }
  if (!res.ok && res.status !== 404) {
    return new Response("Could not delete from Nextcloud", { status: 502 });
  }
  return Response.json({ ok: true });
}
