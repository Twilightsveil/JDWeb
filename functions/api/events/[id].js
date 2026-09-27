export async function onRequestDelete(context) {
  const { env, params } = context;
  await env.DB.prepare("DELETE FROM events WHERE id = ?").bind(params.id).run();
  return Response.json({ ok: true });
}
