import { hashPassword, verifyPassword } from "../../_lib/auth.js";

const ACCOUNTS = {
  joshua: "AUTH_JOSHUA_PASSWORD",
  dein: "AUTH_DEIN_PASSWORD"
};

export async function onRequestPost(context) {
  const { env, request, data } = context;
  const username = data.user.u;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  if (newPassword.length < 4) {
    return new Response(JSON.stringify({ error: "New password must be at least 4 characters." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const row = await env.DB.prepare("SELECT password_hash, password_salt FROM users WHERE username = ?").bind(username).first();

  let currentOk = false;
  if (row && row.password_hash && row.password_salt) {
    currentOk = await verifyPassword(currentPassword, row.password_hash, row.password_salt);
  } else {
    const secretName = ACCOUNTS[username];
    currentOk = !!env[secretName] && currentPassword === env[secretName];
  }

  if (!currentOk) {
    return new Response(JSON.stringify({ error: "Current password is incorrect." }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { hash, salt } = await hashPassword(newPassword);
  await env.DB.prepare(
    "INSERT INTO users (username, nickname, color, password_hash, password_salt) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, password_salt = excluded.password_salt"
  ).bind(username, username, "#c9584a", hash, salt).run();

  return Response.json({ ok: true });
}
