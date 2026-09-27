import { davUrl, authHeader, ensureFolder, listFolder } from "../../_lib/nextcloud.js";
import { identityFor, allIdentities, resolveIdentity } from "../../_lib/auth.js";
import { announce } from "../../_lib/notify.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    await ensureFolder(env);
    const items = await listFolder(env);

    const [{ results }, identities] = await Promise.all([
      env.DB.prepare("SELECT name, author, author_color, username FROM drive_files").all(),
      allIdentities(env)
    ]);
    const byName = {};
    results.forEach(function (r) { byName[r.name] = r; });
    items.forEach(function (item) {
      const row = byName[item.name];
      const live = resolveIdentity(identities, row ? row.username : null, row ? row.author : null, row ? row.author_color : null);
      item.author = live.author;
      item.authorColor = live.authorColor;
    });

    items.sort(function (a, b) { return (b.modifiedAt || "").localeCompare(a.modifiedAt || ""); });
    return Response.json(items);
  } catch (err) {
    console.warn("drive list failed", err);
    return new Response("Could not reach Nextcloud", { status: 502 });
  }
}

export async function onRequestPost(context) {
  const { env, request, data, waitUntil } = context;

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return new Response("Expected multipart/form-data", { status: 400 });
  }
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return new Response("Missing file", { status: 400 });
  }

  try {
    await ensureFolder(env);
  } catch (err) {
    console.warn("drive ensureFolder failed", err);
    return new Response("Could not reach Nextcloud", { status: 502 });
  }

  const cleanName = String(file.name || "upload").replace(/[\/\\]/g, "_").slice(-150);
  const safeName = Date.now() + "_" + cleanName;

  const putRes = await fetch(davUrl(env, safeName), {
    method: "PUT",
    headers: {
      Authorization: authHeader(env),
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file.stream(),
    duplex: "half"
  });

  if (!putRes.ok) {
    console.warn("drive upload failed", putRes.status);
    return new Response("Upload to Nextcloud failed", { status: 502 });
  }

  const username = data.user.u;
  const { author, authorColor } = await identityFor(env, username);
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO drive_files (name, author, author_color, username, uploaded_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET author = excluded.author, author_color = excluded.author_color, username = excluded.username, uploaded_at = excluded.uploaded_at"
  ).bind(safeName, author, authorColor, username, now).run();

  waitUntil(announce(env, username, " added a file to the drive ☁️", "cloud"));

  return Response.json({
    name: safeName,
    size: file.size,
    contentType: file.type || null,
    modifiedAt: now,
    isDir: false,
    author,
    authorColor
  });
}
