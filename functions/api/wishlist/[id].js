// "done" (item received/fulfilled) can only be set by the list's OWNER.
// "claimed" (someone's planning to get this) can only be set by the NON-owner —
// and is never exposed back to the owner via GET, which is what keeps it a surprise.

export async function onRequestPatch(context) {
  const { env, request, params, data } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const row = await env.DB.prepare("SELECT username FROM wishlist_items WHERE id = ?").bind(params.id).first();
  if (!row) {
    return Response.json({ ok: true });
  }

  const isOwner = row.username === data.user.u;

  if (body.done !== undefined) {
    if (!isOwner) return new Response("Only the list owner can mark items received.", { status: 403 });
    await env.DB.prepare("UPDATE wishlist_items SET done = ? WHERE id = ?").bind(body.done ? 1 : 0, params.id).run();
  }

  if (body.claimed !== undefined) {
    if (isOwner) return new Response("You can't claim your own wishlist item.", { status: 403 });
    await env.DB.prepare("UPDATE wishlist_items SET claimed_by = ? WHERE id = ?")
      .bind(body.claimed ? data.user.u : null, params.id).run();
  }

  return Response.json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, params, data } = context;
  await env.DB.prepare("DELETE FROM wishlist_items WHERE id = ? AND username = ?").bind(params.id, data.user.u).run();
  return Response.json({ ok: true });
}
