import { allIdentities, resolveIdentity } from "../../_lib/auth.js";
import { announce } from "../../_lib/notify.js";

export async function onRequestGet(context) {
  const { env } = context;
  const [{ results }, identities] = await Promise.all([
    env.DB.prepare("SELECT * FROM date_ideas ORDER BY done ASC, created_at DESC").all(),
    allIdentities(env)
  ]);
  const ideas = results.map(function (r) {
    const live = resolveIdentity(identities, r.created_by, null, null);
    return {
      id: r.id,
      text: r.text,
      done: !!r.done,
      author: live.author,
      authorColor: live.authorColor,
      createdAt: r.created_at,
      doneAt: r.done_at
    };
  });
  return Response.json(ideas);
}

export async function onRequestPost(context) {
  const { env, request, data, waitUntil } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }
  const text = String(body.text || "").trim().slice(0, 200);
  if (!text) {
    return new Response("Idea text required", { status: 400 });
  }
  const username = data.user.u;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO date_ideas (id, text, done, created_by, created_at) VALUES (?, ?, 0, ?, ?)"
  ).bind(id, text, username, now).run();

  waitUntil(announce(env, username, ' added a date idea: "' + text + '" 💡', "bulb"));

  return Response.json({ id: id, text: text, done: false, createdAt: now });
}
