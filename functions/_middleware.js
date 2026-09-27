import { verifyToken, getCookie, COOKIE_NAME } from "./_lib/auth.js";

const PUBLIC_API_PATHS = ["/api/login", "/api/logout"];

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const gated = url.pathname.startsWith("/api/") || url.pathname.startsWith("/images/");

  if (!gated || PUBLIC_API_PATHS.indexOf(url.pathname) >= 0) {
    return next();
  }

  const token = getCookie(request, COOKIE_NAME);
  const session = token ? await verifyToken(env, token) : null;
  if (!session || !session.u) {
    return new Response("Unauthorized", { status: 401 });
  }

  context.data = context.data || {};
  context.data.user = session;
  return next();
}
