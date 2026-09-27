import { otherUsername } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const { env, data } = context;
  const other = await otherUsername(env, data.user.u);
  if (!other) return Response.json({ typing: false });
  const row = await env.DB.prepare("SELECT until FROM typing_status WHERE username = ?").bind(other).first();
  const typing = !!(row && new Date(row.until).getTime() > Date.now());
  return Response.json({ typing: typing });
}

export async function onRequestPost(context) {
  const { env, data } = context;
  const until = new Date(Date.now() + 4000).toISOString();
  await env.DB.prepare(
    "INSERT INTO typing_status (username, until) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET until = excluded.until"
  ).bind(data.user.u, until).run();
  return Response.json({ ok: true });
}
