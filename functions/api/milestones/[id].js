export async function onRequestDelete(context) {
  const { env, params } = context;
  const row = await env.DB.prepare("SELECT image_key FROM milestones WHERE id = ?").bind(params.id).first();
  if (row && row.image_key) {
    await env.PHOTOS.delete(row.image_key);
  }
  await env.DB.prepare("DELETE FROM milestones WHERE id = ?").bind(params.id).run();
  return Response.json({ ok: true });
}
