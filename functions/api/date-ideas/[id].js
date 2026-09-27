export async function onRequestPatch(context) {
  const { env, request, params } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const sets = [];
  const binds = [];
  if (body.done !== undefined) {
    sets.push("done = ?", "done_at = ?");
    binds.push(body.done ? 1 : 0, body.done ? new Date().toISOString() : null);
  }
  if (body.text !== undefined) {
    sets.push("text = ?");
    binds.push(String(body.text).trim().slice(0, 200));
  }
  if (!sets.length) {
    return new Response("Nothing to update", { status: 400 });
  }
  binds.push(params.id);

  await env.DB.prepare(`UPDATE date_ideas SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
  return Response.json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  await env.DB.prepare("DELETE FROM date_ideas WHERE id = ?").bind(params.id).run();
  return Response.json({ ok: true });
}
