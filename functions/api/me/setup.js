import { hashPassword, signToken, sessionCookieHeader } from "../../_lib/auth.js";

const USERNAME_RE = /^[a-z0-9_]{2,20}$/;

// Tables (and columns) that record a username, kept in sync when an account
// renames itself. There are no real FK constraints tying these together, so
// a rename is just "update everywhere the string appears".
const USERNAME_COLUMNS = [
  ["notes", "username"],
  ["drive_files", "username"],
  ["activity", "username"],
  ["chat_messages", "username"],
  ["songs", "username"],
  ["typing_status", "username"],
  ["wishlist_items", "username"],
  ["wishlist_items", "claimed_by"],
  ["nudges", "username"],
  ["time_capsules", "username"],
  ["milestones", "created_by"],
  ["events", "created_by"],
  ["date_ideas", "created_by"]
];

export async function onRequestPost(context) {
  const { env, request, data } = context;
  const currentUsername = data.user.u;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const newUsername = String(body.username || "").trim().toLowerCase();
  const newPassword = String(body.password || "");

  if (!USERNAME_RE.test(newUsername)) {
    return new Response(JSON.stringify({ error: "Username must be 2-20 characters: lowercase letters, numbers, underscores only." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (newPassword.length < 6) {
    return new Response(JSON.stringify({ error: "Password must be at least 6 characters." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (newUsername !== currentUsername) {
    const clash = await env.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(newUsername).first();
    if (clash) {
      return new Response(JSON.stringify({ error: "That username is already taken." }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  const { hash, salt } = await hashPassword(newPassword);

  const statements = [];
  if (newUsername !== currentUsername) {
    USERNAME_COLUMNS.forEach(function ([table, col]) {
      statements.push(
        env.DB.prepare("UPDATE " + table + " SET " + col + " = ? WHERE " + col + " = ?").bind(newUsername, currentUsername)
      );
    });
  }
  statements.push(
    env.DB.prepare(
      "UPDATE users SET username = ?, password_hash = ?, password_salt = ?, must_change_credentials = 0 WHERE username = ?"
    ).bind(newUsername, hash, salt, currentUsername)
  );
  await env.DB.batch(statements);

  const token = await signToken(env, { u: newUsername, iat: Date.now() });
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", sessionCookieHeader(token));
  return new Response(JSON.stringify({ ok: true, username: newUsername }), { headers: headers });
}
