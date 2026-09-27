import { allIdentities, resolveIdentity } from "../_lib/auth.js";
import { announce } from "../_lib/notify.js";

export async function onRequestGet(context) {
  const { env } = context;
  const [{ results }, identities] = await Promise.all([
    env.DB.prepare("SELECT id, username, text, audio_key, duration, created_at FROM chat_messages ORDER BY id DESC LIMIT 200").all(),
    allIdentities(env)
  ]);
  const messages = results.map(function (r) {
    const live = resolveIdentity(identities, r.username, null, null);
    return {
      id: r.id,
      username: r.username,
      author: live.author,
      authorColor: live.authorColor,
      text: r.text,
      audioUrl: r.audio_key ? ("/images/" + r.audio_key) : null,
      duration: r.duration,
      createdAt: r.created_at
    };
  }).reverse();
  return Response.json(messages);
}

export async function onRequestPost(context) {
  const { env, request, data, waitUntil } = context;
  const username = data.user.u;
  const contentType = request.headers.get("Content-Type") || "";
  const now = new Date().toISOString();

  if (contentType.indexOf("multipart/form-data") >= 0) {
    let form;
    try {
      form = await request.formData();
    } catch (e) {
      return new Response("Expected multipart/form-data", { status: 400 });
    }
    const file = form.get("audio");
    if (!file || typeof file === "string") {
      return new Response("Missing audio", { status: 400 });
    }
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > 8 * 1024 * 1024) {
      return new Response("Voice note too long", { status: 413 });
    }
    const duration = Number(form.get("duration")) || null;
    const key = "voice-" + crypto.randomUUID() + ".webm";
    await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: file.type || "audio/webm" } });

    const result = await env.DB.prepare(
      "INSERT INTO chat_messages (username, text, audio_key, duration, created_at) VALUES (?, '', ?, ?, ?)"
    ).bind(username, key, duration, now).run();

    waitUntil(announce(env, username, " sent you a voice note 🎤", "microphone"));

    return Response.json({
      id: result.meta.last_row_id, username: username, text: "",
      audioUrl: "/images/" + key, duration: duration, createdAt: now
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }
  const text = String(body.text || "").trim().slice(0, 500);
  if (!text) {
    return new Response("Message text required", { status: 400 });
  }

  const result = await env.DB.prepare(
    "INSERT INTO chat_messages (username, text, created_at) VALUES (?, ?, ?)"
  ).bind(username, text, now).run();

  waitUntil(announce(env, username, " sent you a note 💬", "speech_balloon"));

  return Response.json({ id: result.meta.last_row_id, username: username, text: text, createdAt: now });
}
