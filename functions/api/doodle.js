import { announce } from "../_lib/notify.js";

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export async function onRequestGet(context) {
  const { env } = context;
  let row = await env.DB.prepare("SELECT date, items FROM doodle WHERE id = 1").first();
  const today = todayUTC();

  if (!row) {
    await env.DB.prepare("INSERT INTO doodle (id, date, items) VALUES (1, ?, '[]')").bind(today).run();
    row = { date: today, items: "[]" };
  } else if (row.date !== today) {
    await env.DB.prepare("UPDATE doodle SET date = ?, items = '[]' WHERE id = 1").bind(today).run();
    row = { date: today, items: "[]" };
  }

  return Response.json({ date: row.date, items: JSON.parse(row.items) });
}

export async function onRequestPost(context) {
  const { env, request, data, waitUntil } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items.slice(-260) : [];
  const today = todayUTC();

  await env.DB.prepare(
    "INSERT INTO doodle (id, date, items) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET date = excluded.date, items = excluded.items"
  ).bind(today, JSON.stringify(items)).run();

  // Only notify when a text note was just left — not on every single pen stroke.
  const last = items[items.length - 1];
  if (last && last.type === "text") {
    const text = ' left a note on the doodle board: "' + String(last.text || "").slice(0, 80) + '"';
    waitUntil(announce(env, data.user.u, text, "pencil2"));
  }

  return Response.json({ ok: true, date: today, items });
}
