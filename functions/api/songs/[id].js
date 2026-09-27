export async function onRequestDelete(context) {
  const { env, params } = context;
  const row = await env.DB.prepare("SELECT thumb_key FROM songs WHERE id = ?").bind(params.id).first();
  if (row && row.thumb_key) {
    await env.PHOTOS.delete(row.thumb_key);
  }
  await env.DB.prepare("DELETE FROM songs WHERE id = ?").bind(params.id).run();
  return Response.json({ ok: true });
}
