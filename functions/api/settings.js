import { announce } from "../_lib/notify.js";

export async function onRequestGet(context) {
  const { env } = context;
  const row = await env.DB.prepare("SELECT together_since, next_date, big_event_label, big_event_date FROM settings WHERE id = 1").first();
  return Response.json({
    togetherSince: row ? row.together_since : null,
    nextDate: row ? row.next_date : null,
    bigEventLabel: row ? row.big_event_label : null,
    bigEventDate: row ? row.big_event_date : null
  });
}

export async function onRequestPatch(context) {
  const { env, request, data, waitUntil } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const row = await env.DB.prepare("SELECT together_since, next_date, big_event_label, big_event_date FROM settings WHERE id = 1").first();
  const togetherSince = body.togetherSince !== undefined ? (body.togetherSince || null) : (row ? row.together_since : null);
  const nextDate = body.nextDate !== undefined ? (body.nextDate || null) : (row ? row.next_date : null);
  const bigEventLabel = body.bigEventLabel !== undefined ? (body.bigEventLabel || null) : (row ? row.big_event_label : null);
  const bigEventDate = body.bigEventDate !== undefined ? (body.bigEventDate || null) : (row ? row.big_event_date : null);

  await env.DB.prepare(
    "INSERT INTO settings (id, together_since, next_date, big_event_label, big_event_date) VALUES (1, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET together_since = excluded.together_since, next_date = excluded.next_date, big_event_label = excluded.big_event_label, big_event_date = excluded.big_event_date"
  ).bind(togetherSince, nextDate, bigEventLabel, bigEventDate).run();

  waitUntil(announce(env, data.user.u, " updated our dates 💞", "calendar"));

  return Response.json({ togetherSince: togetherSince, nextDate: nextDate, bigEventLabel: bigEventLabel, bigEventDate: bigEventDate });
}
