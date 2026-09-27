import { signToken, sessionCookieHeader, verifyPassword } from "../_lib/auth.js";

// Only used as a fallback for an account that has never set its own password
// yet. Once a users row has password_hash/password_salt, that's the only
// thing that authenticates it — these secrets stop mattering for that account.
const BOOTSTRAP_SECRETS = {
  joshua: "AUTH_JOSHUA_PASSWORD",
  dein: "AUTH_DEIN_PASSWORD"
};

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");

  const row = await env.DB.prepare(
    "SELECT password_hash, password_salt, must_change_credentials FROM users WHERE username = ?"
  ).bind(username).first();

  let ok = false;
  if (row && row.password_hash && row.password_salt) {
    // A custom password has been set — that's the only thing that authenticates now.
    ok = await verifyPassword(password, row.password_hash, row.password_salt);
  } else {
    // No custom password yet: fall back to the original bootstrap secret.
    const secretName = BOOTSTRAP_SECRETS[username];
    ok = !!secretName && !!env[secretName] && password === env[secretName];
  }

  if (!ok) {
    return new Response(JSON.stringify({ error: "Wrong username or password." }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const token = await signToken(env, { u: username, iat: Date.now() });
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", sessionCookieHeader(token));
  return new Response(JSON.stringify({
    ok: true,
    username: username,
    mustChangeCredentials: !!(row && row.must_change_credentials)
  }), { headers: headers });
}
