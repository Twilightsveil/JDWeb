import { identityFor, allIdentities, resolveIdentity } from "../../_lib/auth.js";
import { announce } from "../../_lib/notify.js";

function monthOf(iso) {
  return iso.slice(0, 7);
}

function rowToNote(r, identities) {
  const live = resolveIdentity(identities, r.username, r.author, r.author_color);
  return {
    id: r.id,
    image: `/images/${r.image_key}`,
    stickers: JSON.parse(r.stickers || "[]"),
    notes: JSON.parse(r.notes || "[]"),
    reactions: JSON.parse(r.reactions || "[]"),
    author: live.author,
    authorColor: live.authorColor,
    createdAt: r.created_at,
    month: r.month,
    lat: r.lat,
    lng: r.lng
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const month = url.searchParams.get("month");

  const stmt = month
    ? env.DB.prepare("SELECT * FROM notes WHERE month = ? ORDER BY created_at DESC LIMIT 500").bind(month)
    : env.DB.prepare("SELECT * FROM notes ORDER BY created_at DESC LIMIT 500");

  const [{ results }, identities] = await Promise.all([stmt.all(), allIdentities(env)]);
  return Response.json(results.map(function (r) { return rowToNote(r, identities); }));
}

export async function onRequestPost(context) {
  const { env, request, data, waitUntil } = context;

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return new Response("Expected multipart/form-data", { status: 400 });
  }

  const file = form.get("image");
  if (!file || typeof file === "string") {
    return new Response("Missing image", { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > 8 * 1024 * 1024) {
    return new Response("Image too large", { status: 413 });
  }

  const latRaw = form.get("lat");
  const lngRaw = form.get("lng");
  const lat = latRaw !== null && latRaw !== "" ? Number(latRaw) : null;
  const lng = lngRaw !== null && lngRaw !== "" ? Number(lngRaw) : null;

  const username = data.user.u;
  const { author, authorColor } = await identityFor(env, username);

  const id = crypto.randomUUID();
  const key = `${id}.jpg`;

  await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } });

  const now = new Date().toISOString();
  const month = monthOf(now);

  await env.DB.prepare(
    "INSERT INTO notes (id, image_key, stickers, notes, reactions, author, author_color, username, created_at, month, lat, lng) VALUES (?, ?, '[]', '[]', '[]', ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, key, author, authorColor, username, now, month, lat, lng).run();

  waitUntil(announce(env, username, " pinned a new photo 📌", "camera"));

  return Response.json({
    id,
    image: `/images/${key}`,
    stickers: [],
    notes: [],
    reactions: [],
    author,
    authorColor,
    createdAt: now,
    month,
    lat,
    lng
  });
}
