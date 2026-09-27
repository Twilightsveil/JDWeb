import { createZipStream } from "../_lib/zip.js";
import { allIdentities, resolveIdentity } from "../_lib/auth.js";

// Scoped to pins only (D1 + R2 — the data that only exists in this app and would
// otherwise be hard to back up). Drive files are already backed by a real
// Nextcloud account: an in-Worker zip of 200+MB of video reliably hit a platform
// wall-clock limit on streaming responses during testing (confirmed by pulling a
// real export and finding it truncated mid-file), so bulk drive backup belongs to
// Nextcloud's own client/web app rather than this endpoint.
export async function onRequestGet(context) {
  const { env } = context;

  const { results: noteRows } = await env.DB.prepare("SELECT * FROM notes ORDER BY created_at ASC").all();
  const identities = await allIdentities(env);

  const manifest = noteRows.map(function (r) {
    const live = resolveIdentity(identities, r.username, r.author, r.author_color);
    return {
      author: live.author,
      stickers: JSON.parse(r.stickers || "[]"),
      notes: JSON.parse(r.notes || "[]"),
      reactions: JSON.parse(r.reactions || "[]"),
      createdAt: r.created_at,
      month: r.month,
      file: "pins/" + r.id + ".jpg"
    };
  });

  const entries = [];

  entries.push({
    name: "manifest.json",
    getStream: async function () {
      const bytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
      return new Response(bytes).body;
    }
  });

  noteRows.forEach(function (r) {
    entries.push({
      name: "pins/" + r.id + ".jpg",
      getStream: async function () {
        const obj = await env.PHOTOS.get(r.image_key);
        return obj ? obj.body : null;
      }
    });
  });

  const zipStream = createZipStream(entries);
  const filename = "pinned-together-pins-" + new Date().toISOString().slice(0, 10) + ".zip";

  return new Response(zipStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="' + filename + '"'
    }
  });
}
