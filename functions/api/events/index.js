import { allIdentities, resolveIdentity } from "../../_lib/auth.js";
import { announce } from "../../_lib/notify.js";

export async function onRequestGet(context) {
  const { env } = context;
  const [{ results }, identities] = await Promise.all([
    env.DB.prepare("SELECT * FROM events ORDER BY event_date ASC").all(),
    allIdentities(env)
  ]);
  return Response.json(results.map(function (r) {
    const live = resolveIdentity(identities, r.created_by, null, null);
    return { id: r.id, label: r.label, date: r.event_date, author: live.author, createdAt: r.created_at };
  }));
}

export async function onRequestPost(context) {
  const { env, request, data, waitUntil } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }
  const label = String(body.label || "").trim().slice(0, 60);
  const eventDate = String(body.date || "").slice(0, 10);
  if (!label || !eventDate) {
    return new Response("Label and date are required", { status: 400 });
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const username = data.user.u;

  await env.DB.prepare(
    "INSERT INTO events (id, label, event_date, created_by, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, label, eventDate, username, now).run();

  waitUntil(announce(env, username, ' added an event: "' + label + '" 📌', "pushpin"));

  return Response.json({ id: id, label: label, date: eventDate, createdAt: now });
}
