// Each person's list is visible to their PARTNER (that's the whole point — so
// they know what to get you). What stays hidden is the claimed_by state on
// YOUR OWN items: you can't see whether your partner has already picked
// something off your list, so it still arrives as a surprise. Your partner
// (viewing your list) CAN see and set that flag, so they remember what
// they've already decided to get you.

import { otherUsername } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const { env, data } = context;
  const me = data.user.u;
  const partner = await otherUsername(env, me);
  if (!partner) return Response.json({ mine: [], partner: [] });

  const { results } = await env.DB.prepare(
    "SELECT * FROM wishlist_items WHERE username IN (?, ?) ORDER BY done ASC, created_at DESC"
  ).bind(me, partner).all();

  const mine = [];
  const partnerList = [];
  results.forEach(function (r) {
    if (r.username === me) {
      // No claimed_by here — the whole point is you don't get to see it.
      mine.push({ id: r.id, text: r.text, done: !!r.done, createdAt: r.created_at });
    } else {
      partnerList.push({
        id: r.id, text: r.text, done: !!r.done, createdAt: r.created_at,
        claimed: r.claimed_by === me
      });
    }
  });

  return Response.json({ mine: mine, partner: partnerList });
}

export async function onRequestPost(context) {
  const { env, request, data } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }
  const text = String(body.text || "").trim().slice(0, 200);
  if (!text) {
    return new Response("Item text required", { status: 400 });
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO wishlist_items (id, username, text, done, created_at) VALUES (?, ?, ?, 0, ?)"
  ).bind(id, data.user.u, text, now).run();

  return Response.json({ id: id, text: text, done: false, createdAt: now });
}
