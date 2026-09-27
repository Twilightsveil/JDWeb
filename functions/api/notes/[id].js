import { announce } from "../../_lib/notify.js";

export async function onRequestPatch(context) {
  const { env, request, params, data, waitUntil } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const sets = [];
  const binds = [];
  let event = null;

  if (Array.isArray(body.reactions)) {
    sets.push("reactions = ?");
    binds.push(JSON.stringify(body.reactions));
    event = { text: " reacted to a pin ❤️", tag: "heart" };
  } else if (Array.isArray(body.stickers)) {
    sets.push("stickers = ?");
    binds.push(JSON.stringify(body.stickers));
    event = { text: " decorated a pin 🏷️", tag: "label" };
  } else if (Array.isArray(body.notes)) {
    sets.push("notes = ?");
    binds.push(JSON.stringify(body.notes));
    event = { text: " added a sticky note ✏️", tag: "pencil2" };
  } else if (body.lat !== undefined && body.lng !== undefined) {
    sets.push("lat = ?", "lng = ?");
    binds.push(body.lat, body.lng);
  }

  if (!sets.length) {
    return new Response("Nothing to update", { status: 400 });
  }
  binds.push(params.id);

  await env.DB.prepare(`UPDATE notes SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();

  if (event) {
    waitUntil(announce(env, data.user.u, event.text, event.tag));
  }

  return Response.json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;

  const row = await env.DB.prepare("SELECT image_key FROM notes WHERE id = ?").bind(params.id).first();
  if (row) {
    await env.PHOTOS.delete(row.image_key);
    await env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(params.id).run();
  }
  return Response.json({ ok: true });
}
