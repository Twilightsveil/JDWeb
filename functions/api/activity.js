export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    "SELECT username, message, tag, created_at FROM activity ORDER BY id DESC LIMIT 50"
  ).all();
  return Response.json(results);
}
