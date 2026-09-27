import { defaultNickname, defaultColor } from "../_lib/auth.js";

function rowToProfile(username, row) {
  return {
    username: username,
    nickname: row ? row.nickname : defaultNickname(username),
    color: row ? row.color : defaultColor(username),
    avatarUrl: row && row.avatar_key ? ("/images/" + row.avatar_key) : null,
    mood: row ? row.mood : null,
    moodUpdatedAt: row ? row.mood_updated_at : null,
    mustChangeCredentials: !!(row && row.must_change_credentials)
  };
}

export async function onRequestGet(context) {
  const { env, data } = context;
  const username = data.user.u;
  const row = await env.DB.prepare("SELECT nickname, color, avatar_key, mood, mood_updated_at, must_change_credentials FROM users WHERE username = ?").bind(username).first();
  return Response.json(rowToProfile(username, row));
}

export async function onRequestPatch(context) {
  const { env, request, data } = context;
  const username = data.user.u;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const existing = await env.DB.prepare("SELECT nickname, color, avatar_key, mood, mood_updated_at FROM users WHERE username = ?").bind(username).first();

  const nickname = body.nickname !== undefined
    ? (String(body.nickname || "").trim().slice(0, 24) || defaultNickname(username))
    : (existing ? existing.nickname : defaultNickname(username));
  const color = body.color !== undefined
    ? (String(body.color || "").trim().slice(0, 20) || defaultColor(username))
    : (existing ? existing.color : defaultColor(username));

  let mood = existing ? existing.mood : null;
  let moodUpdatedAt = existing ? existing.mood_updated_at : null;
  if (body.mood !== undefined) {
    mood = body.mood ? String(body.mood).slice(0, 8) : null;
    moodUpdatedAt = new Date().toISOString();
  }

  await env.DB.prepare(
    "INSERT INTO users (username, nickname, color, mood, mood_updated_at) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT(username) DO UPDATE SET nickname = excluded.nickname, color = excluded.color, mood = excluded.mood, mood_updated_at = excluded.mood_updated_at"
  ).bind(username, nickname, color, mood, moodUpdatedAt).run();

  const row = await env.DB.prepare("SELECT nickname, color, avatar_key, mood, mood_updated_at FROM users WHERE username = ?").bind(username).first();
  return Response.json(rowToProfile(username, row));
}
