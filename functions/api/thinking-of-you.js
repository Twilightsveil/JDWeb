import { identityFor } from "../_lib/auth.js";
import { announce } from "../_lib/notify.js";

const COOLDOWN_MS = 60 * 1000;

export async function onRequestPost(context) {
  const { env, data, waitUntil } = context;
  const username = data.user.u;

  const recent = await env.DB.prepare(
    "SELECT created_at FROM activity WHERE username = ? AND tag = 'thinking' ORDER BY id DESC LIMIT 1"
  ).bind(username).first();

  if (recent) {
    const elapsed = Date.now() - new Date(recent.created_at).getTime();
    if (elapsed < COOLDOWN_MS) {
      return Response.json({ ok: true, throttled: true });
    }
  }

  const { author } = await identityFor(env, username);
  waitUntil(announce(env, username, " is thinking of you 💌", "thinking"));

  return Response.json({ ok: true, author: author });
}
