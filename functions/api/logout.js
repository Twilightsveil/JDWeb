import { clearCookieHeader } from "../_lib/auth.js";

export async function onRequestPost() {
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", clearCookieHeader());
  return new Response(JSON.stringify({ ok: true }), { headers: headers });
}
