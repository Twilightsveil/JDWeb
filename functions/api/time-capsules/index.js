import { allIdentities, resolveIdentity } from "../../_lib/auth.js";
import { announce } from "../../_lib/notify.js";

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export async function onRequestGet(context) {
  const { env } = context;
  const [{ results }, identities] = await Promise.all([
    env.DB.prepare("SELECT * FROM time_capsules ORDER BY reveal_date ASC").all(),
    allIdentities(env)
  ]);
  const today = todayUTC();
  const capsules = results.map(function (r) {
    const live = resolveIdentity(identities, r.username, null, null);
    const revealed = r.reveal_date <= today;
    return {
      id: r.id,
      author: live.author,
      authorColor: live.authorColor,
      revealDate: r.reveal_date,
      createdAt: r.created_at,
      revealed: revealed,
      title: revealed ? r.title : null,
      body: revealed ? r.body : null
    };
  });
  return Response.json(capsules);
}

export async function onRequestPost(context) {
  const { env, request, data, waitUntil } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }
  const text = String(body.body || "").trim().slice(0, 5000);
  const revealDate = String(body.revealDate || "").slice(0, 10);
  if (!text || !revealDate) {
    return new Response("Letter text and reveal date are required", { status: 400 });
  }
  if (revealDate <= todayUTC()) {
    return new Response("Reveal date must be in the future", { status: 400 });
  }
  const title = String(body.title || "").trim().slice(0, 120) || null;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const username = data.user.u;

  await env.DB.prepare(
    "INSERT INTO time_capsules (id, username, title, body, reveal_date, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, username, title, text, revealDate, now).run();

  waitUntil(announce(env, username, " sealed a time capsule for " + revealDate + " 🔒", "lock"));

  return Response.json({ id: id, revealDate: revealDate, createdAt: now, revealed: false, title: null, body: null });
}
