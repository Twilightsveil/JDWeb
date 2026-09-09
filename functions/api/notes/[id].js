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
  if (Array.isArray(body.stickers)) {
    sets.push("stickers = ?");
    binds.push(JSON.stringify(body.stickers));
  }
  if (Array.isArray(body.notes)) {
    sets.push("notes = ?");
    binds.push(JSON.stringify(body.notes));
  }
  if (!sets.length) {
    return new Response("Nothing to update", { status: 400 });
  }
  binds.push(params.id);

  await env.DB.prepare(`UPDATE notes SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
  return Response.json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;

  const row = await env.DB.prepare("SELECT image_key FROM notes WHERE id = ?").bind(params.id).first();
  if (row) {
    await env.PHOTOS.delete(row.image_key);
    await env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(params.id).run();
  }
  return Response.json({ ok: true });
}
