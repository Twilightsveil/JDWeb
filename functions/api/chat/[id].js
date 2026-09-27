export async function onRequestDelete(context) {
  const { env, params, data } = context;
  const row = await env.DB.prepare("SELECT username FROM chat_messages WHERE id = ?").bind(params.id).first();
  if (!row) {
    return Response.json({ ok: true });
  }
  if (row.username !== data.user.u) {
    return new Response("You can only delete your own messages", { status: 403 });
  }
  await env.DB.prepare("DELETE FROM chat_messages WHERE id = ?").bind(params.id).run();
  return Response.json({ ok: true });
}
