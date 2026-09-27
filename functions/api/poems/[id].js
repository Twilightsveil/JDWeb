export async function onRequestDelete(context) {
  const { env, params, data } = context;
  if (data.user.u !== "joshua") {
    return new Response("Only Joshua can delete his poems.", { status: 403 });
  }
  await env.DB.prepare("DELETE FROM poems WHERE id = ?").bind(params.id).run();
  return Response.json({ ok: true });
}
