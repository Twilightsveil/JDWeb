import { allIdentities, resolveIdentity } from "../../_lib/auth.js";
import { announce } from "../../_lib/notify.js";

function rowToMilestone(r, identities) {
  const live = resolveIdentity(identities, r.created_by, null, null);
  return {
    id: r.id,
    title: r.title,
    date: r.milestone_date,
    note: r.note,
    image: r.image_key ? ("/images/" + r.image_key) : null,
    author: live.author,
    authorColor: live.authorColor,
    createdAt: r.created_at
  };
}

export async function onRequestGet(context) {
  const { env } = context;
  const [{ results }, identities] = await Promise.all([
    env.DB.prepare("SELECT * FROM milestones ORDER BY milestone_date ASC").all(),
    allIdentities(env)
  ]);
  return Response.json(results.map(function (r) { return rowToMilestone(r, identities); }));
}

export async function onRequestPost(context) {
  const { env, request, data, waitUntil } = context;

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return new Response("Expected multipart/form-data", { status: 400 });
  }

  const title = String(form.get("title") || "").trim().slice(0, 120);
  const milestoneDate = String(form.get("date") || "").slice(0, 10);
  if (!title || !milestoneDate) {
    return new Response("Title and date are required", { status: 400 });
  }
  const note = String(form.get("note") || "").trim().slice(0, 1000) || null;

  let imageKey = null;
  const file = form.get("image");
  if (file && typeof file !== "string") {
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > 8 * 1024 * 1024) {
      return new Response("Image too large", { status: 413 });
    }
    imageKey = "milestone-" + crypto.randomUUID() + ".jpg";
    await env.PHOTOS.put(imageKey, bytes, { httpMetadata: { contentType: "image/jpeg" } });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const username = data.user.u;

  await env.DB.prepare(
    "INSERT INTO milestones (id, title, milestone_date, note, image_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, title, milestoneDate, note, imageKey, username, now).run();

  waitUntil(announce(env, username, ' added a milestone: "' + title + '" 🏳️', "triangular_flag_on_post"));

  return Response.json({
    id: id, title: title, date: milestoneDate, note: note,
    image: imageKey ? ("/images/" + imageKey) : null, createdAt: now
  });
}
