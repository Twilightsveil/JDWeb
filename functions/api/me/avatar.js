import { defaultNickname, defaultColor } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  const { env, request, data } = context;
  const username = data.user.u;

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return new Response("Expected multipart/form-data", { status: 400 });
  }

  const file = form.get("image");
  if (!file || typeof file === "string") {
    return new Response("Missing image", { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > 4 * 1024 * 1024) {
    return new Response("Image too large", { status: 413 });
  }

  const key = "avatar-" + username + "-" + Date.now() + ".jpg";
  await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } });

  const existing = await env.DB.prepare("SELECT nickname, color, avatar_key FROM users WHERE username = ?").bind(username).first();
  const oldKey = existing ? existing.avatar_key : null;
  const nickname = existing ? existing.nickname : defaultNickname(username);
  const color = existing ? existing.color : defaultColor(username);

  await env.DB.prepare(
    "INSERT INTO users (username, nickname, color, avatar_key) VALUES (?, ?, ?, ?) " +
    "ON CONFLICT(username) DO UPDATE SET avatar_key = excluded.avatar_key"
  ).bind(username, nickname, color, key).run();

  if (oldKey && oldKey !== key) {
    context.waitUntil(env.PHOTOS.delete(oldKey).catch(function () {}));
  }

  return Response.json({ avatarUrl: "/images/" + key });
}
