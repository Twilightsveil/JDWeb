import { announce } from "../../_lib/notify.js";

export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare("SELECT * FROM poems ORDER BY created_at DESC").all();
  return Response.json(results);
}

export async function onRequestPost(context) {
  const { env, request, data, waitUntil } = context;
  if (data.user.u !== "joshua") {
    return new Response("Only Joshua can post poems.", { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }
  const bodyText = String(body.body || "").trim().slice(0, 5000);
  if (!bodyText) {
    return new Response("Poem text required", { status: 400 });
  }
  const title = String(body.title || "").trim().slice(0, 120) || null;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO poems (id, title, body, created_at) VALUES (?, ?, ?, ?)"
  ).bind(id, title, bodyText, now).run();

  waitUntil(announce(env, "joshua", " wrote you a poem 📜", "scroll"));

  return Response.json({ id: id, title: title, body: bodyText, created_at: now });
}
