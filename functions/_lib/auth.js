const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 180; // 180 days
export const COOKIE_NAME = "pt_session";

function b64url(bytes) {
  var bin = "";
  var arr = new Uint8Array(bytes);
  for (var i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  var bin = atob(str);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function getKey(env) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(env.AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signToken(env, payloadObj) {
  const payloadB64 = b64url(encoder.encode(JSON.stringify(payloadObj)));
  const key = await getKey(env);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return payloadB64 + "." + b64url(sig);
}

export async function verifyToken(env, token) {
  if (!token || token.indexOf(".") < 0) return null;
  const parts = token.split(".");
  const payloadB64 = parts[0], sigB64 = parts[1];
  try {
    const key = await getKey(env);
    const valid = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sigB64), encoder.encode(payloadB64));
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(b64urlToBytes(payloadB64)));
    if (!payload.iat || Date.now() - payload.iat > MAX_AGE_MS) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const parts = header.split(";");
  for (var i = 0; i < parts.length; i++) {
    var idx = parts[i].indexOf("=");
    if (idx < 0) continue;
    var k = parts[i].slice(0, idx).trim();
    if (k === name) return decodeURIComponent(parts[i].slice(idx + 1).trim());
  }
  return null;
}

export function sessionCookieHeader(token) {
  return COOKIE_NAME + "=" + encodeURIComponent(token) + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + Math.floor(MAX_AGE_MS / 1000);
}

export function clearCookieHeader() {
  return COOKIE_NAME + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

export function defaultNickname(username) {
  return username.charAt(0).toUpperCase() + username.slice(1);
}

export function defaultColor(username) {
  return username === "joshua" ? "#c9584a" : "#3f6f96";
}

const PBKDF2_ITERATIONS = 100000;

// Returns {hash, salt} both base64url. Pass an existing salt to verify a password
// against a stored hash; omit it to create a new hash for a freshly-set password.
export async function hashPassword(password, existingSaltB64) {
  const salt = existingSaltB64 ? b64urlToBytes(existingSaltB64) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: b64url(bits), salt: b64url(salt) };
}

export async function verifyPassword(password, hashB64, saltB64) {
  if (!hashB64 || !saltB64) return false;
  const result = await hashPassword(password, saltB64);
  return result.hash === hashB64;
}

export async function identityFor(env, username) {
  const row = await env.DB.prepare("SELECT nickname, color FROM users WHERE username = ?").bind(username).first();
  return {
    author: row ? row.nickname : defaultNickname(username),
    authorColor: row ? row.color : defaultColor(username)
  };
}

// { [username]: {author, authorColor} } for every known account, so a row that
// records a username can always resolve the CURRENT nickname/color at read time.
export async function allIdentities(env) {
  const { results } = await env.DB.prepare("SELECT username, nickname, color FROM users").all();
  const map = {};
  results.forEach(function (r) {
    map[r.username] = { author: r.nickname, authorColor: r.color };
  });
  return map;
}

// The app is always exactly two accounts — this finds "the other one" without
// hardcoding either username, so an account can rename itself freely.
export async function otherUsername(env, username) {
  const row = await env.DB.prepare("SELECT username FROM users WHERE username != ? LIMIT 1").bind(username).first();
  return row ? row.username : null;
}

// Resolve a row's live display identity: prefer the CURRENT nickname/color for
// its username (so a nickname change updates old pins too); fall back to the
// frozen author/authorColor the row was created with when it predates accounts.
export function resolveIdentity(identities, username, fallbackAuthor, fallbackColor) {
  const known = username && identities[username];
  return {
    author: known ? known.author : fallbackAuthor,
    authorColor: known ? known.authorColor : fallbackColor
  };
}
