import { defaultNickname, defaultColor } from "../_lib/auth.js";

function rowToProfile(username, row) {
  return {
    username: username,
    nickname: row ? row.nickname : defaultNickname(username),
    color: row ? row.color : defaultColor(username),
    avatarUrl: row && row.avatar_key ? ("/images/" + row.avatar_key) : null,
    mood: row ? row.mood : null,
    moodUpdatedAt: row ? row.mood_updated_at : null
  };
}

export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare("SELECT username, nickname, color, avatar_key, mood, mood_updated_at FROM users").all();
  const profiles = {};
  results.forEach(function (r) { profiles[r.username] = rowToProfile(r.username, r); });
  return Response.json(profiles);
}
