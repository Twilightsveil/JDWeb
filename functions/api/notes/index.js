function monthOf(iso) {
  return iso.slice(0, 7);
}

function rowToNote(r) {
  return {
    id: r.id,
    image: `/images/${r.image_key}`,
    stickers: JSON.parse(r.stickers || "[]"),
    notes: JSON.parse(r.notes || "[]"),
    author: r.author,
    authorColor: r.author_color,
    createdAt: r.created_at,
    month: r.month
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const month = url.searchParams.get("month");

  const stmt = month
    ? env.DB.prepare("SELECT * FROM notes WHERE month = ? ORDER BY created_at DESC LIMIT 500").bind(month)
    : env.DB.prepare("SELECT * FROM notes ORDER BY created_at DESC LIMIT 500");

  const { results } = await stmt.all();
  return Response.json(results.map(rowToNote));
}

export async function onRequestPost(context) {
  const { env, request } = context;

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return new Response("Expected multipart/form-data", { status: 400 });
  }

  const file = form.get("image");
  const author = String(form.get("author") || "Someone").slice(0, 40);
  const authorColor = String(form.get("authorColor") || "#c9584a").slice(0, 20);

  if (!file || typeof file === "string") {
    return new Response("Missing image", { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > 8 * 1024 * 1024) {
    return new Response("Image too large", { status: 413 });
  }

  const id = crypto.randomUUID();
  const key = `${id}.jpg`;

  await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } });

  const now = new Date().toISOString();
  const month = monthOf(now);

  await env.DB.prepare(
    "INSERT INTO notes (id, image_key, stickers, notes, author, author_color, created_at, month) VALUES (?, ?, '[]', '[]', ?, ?, ?, ?)"
  ).bind(id, key, author, authorColor, now, month).run();

  return Response.json({
    id,
    image: `/images/${key}`,
    stickers: [],
    notes: [],
    author,
    authorColor,
    createdAt: now,
    month
  });
}
