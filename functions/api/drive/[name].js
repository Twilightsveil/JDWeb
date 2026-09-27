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

export async function onRequestPatch(context) {
  const { env, params, request } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const newDisplay = String(body.name || "").trim().replace(/[\/\\]/g, "_").slice(0, 150);
  if (!newDisplay) {
    return new Response("New name required", { status: 400 });
  }

  const prefixMatch = params.name.match(/^(\d+_)/);
  const prefix = prefixMatch ? prefixMatch[1] : "";
  const newStoredName = prefix + newDisplay;

  if (newStoredName === params.name) {
    return Response.json({ name: params.name });
  }

  let res;
  try {
    res = await fetch(davUrl(env, params.name), {
      method: "MOVE",
      headers: {
        Authorization: authHeader(env),
        Destination: davUrl(env, newStoredName),
        Overwrite: "F"
      }
    });
  } catch (err) {
    return new Response("Could not reach Nextcloud", { status: 502 });
  }
  if (!res.ok) {
    return new Response("Rename failed on Nextcloud", { status: 502 });
  }

  await env.DB.prepare("UPDATE drive_files SET name = ? WHERE name = ?").bind(newStoredName, params.name).run();
  return Response.json({ name: newStoredName });
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
  await env.DB.prepare("DELETE FROM drive_files WHERE name = ?").bind(params.name).run();
  return Response.json({ ok: true });
}
