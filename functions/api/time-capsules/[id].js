export async function onRequestDelete(context) {
  const { env, params, data } = context;
  // Only the author can remove their own unopened letter; either of you can
  // clear one out once it's already been revealed (it's just a keepsake by then).
  const row = await env.DB.prepare("SELECT username, reveal_date FROM time_capsules WHERE id = ?").bind(params.id).first();
  if (!row) return Response.json({ ok: true });
  const revealed = row.reveal_date <= new Date().toISOString().slice(0, 10);
  if (!revealed && row.username !== data.user.u) {
    return new Response("Only the person who sealed this letter can delete it before it opens.", { status: 403 });
  }
  await env.DB.prepare("DELETE FROM time_capsules WHERE id = ?").bind(params.id).run();
  return Response.json({ ok: true });
}
