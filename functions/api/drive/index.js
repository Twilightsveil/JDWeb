import { davUrl, authHeader, ensureFolder, listFolder } from "../../_lib/nextcloud.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    await ensureFolder(env);
    const items = await listFolder(env);
    items.sort(function (a, b) { return (b.modifiedAt || "").localeCompare(a.modifiedAt || ""); });
    return Response.json(items);
  } catch (err) {
    console.warn("drive list failed", err);
    return new Response("Could not reach Nextcloud", { status: 502 });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return new Response("Expected multipart/form-data", { status: 400 });
  }
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return new Response("Missing file", { status: 400 });
  }

  try {
    await ensureFolder(env);
  } catch (err) {
    console.warn("drive ensureFolder failed", err);
    return new Response("Could not reach Nextcloud", { status: 502 });
  }

  const cleanName = String(file.name || "upload").replace(/[\/\\]/g, "_").slice(-150);
  const safeName = Date.now() + "_" + cleanName;

  const putRes = await fetch(davUrl(env, safeName), {
    method: "PUT",
    headers: {
      Authorization: authHeader(env),
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file.stream(),
    duplex: "half"
  });

  if (!putRes.ok) {
    console.warn("drive upload failed", putRes.status);
    return new Response("Upload to Nextcloud failed", { status: 502 });
  }

  return Response.json({
    name: safeName,
    size: file.size,
    contentType: file.type || null,
    modifiedAt: new Date().toISOString(),
    isDir: false
  });
}
