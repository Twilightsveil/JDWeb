import { allIdentities, resolveIdentity } from "../../_lib/auth.js";
import { announce } from "../../_lib/notify.js";
import { fetchSongMetadata } from "../../_lib/oembed.js";

function rowToSong(r, identities) {
  const live = resolveIdentity(identities, r.username, null, null);
  return {
    id: r.id,
    url: r.url,
    note: r.note,
    author: live.author,
    authorColor: live.authorColor,
    createdAt: r.created_at,
    trackTitle: r.track_title || null,
    trackAuthor: r.track_author || null,
    thumbnailUrl: r.thumb_key ? ("/images/" + r.thumb_key) : null
  };
}

// Fetches title/artist/art for a link and stores the art in R2.
// track_title is stored as "" (not NULL) when a fetch was attempted but came up
// empty, so GET's backfill below can tell "never tried" (NULL) from "tried,
// nothing there" ("") and doesn't keep re-fetching a link with no metadata.
async function fetchAndStoreMetadata(env, url) {
  const meta = await fetchSongMetadata(url);
  let thumbKey = null;
  if (meta && meta.thumbnailUrl) {
    try {
      const imgRes = await fetch(meta.thumbnailUrl);
      if (imgRes.ok) {
        const bytes = await imgRes.arrayBuffer();
        thumbKey = "song-thumb-" + crypto.randomUUID() + ".jpg";
        await env.PHOTOS.put(thumbKey, bytes, {
          httpMetadata: { contentType: imgRes.headers.get("content-type") || "image/jpeg" }
        });
      }
    } catch (e) {
      thumbKey = null;
    }
  }
  return {
    trackTitle: (meta && meta.title) || "",
    trackAuthor: (meta && meta.author) || null,
    thumbKey: thumbKey
  };
}

export async function onRequestGet(context) {
  const { env, waitUntil } = context;
  const [{ results }, identities] = await Promise.all([
    env.DB.prepare("SELECT * FROM songs ORDER BY id DESC LIMIT 100").all(),
    allIdentities(env)
  ]);

  // Self-healing backfill: songs added before metadata fetching existed have
  // track_title/thumb_key still NULL. Fetch them in the background so the
  // NEXT load picks up real art/title, without blocking this response.
  results.forEach(function (r) {
    if (r.track_title === null && r.thumb_key === null) {
      waitUntil((async function () {
        try {
          const meta = await fetchAndStoreMetadata(env, r.url);
          await env.DB.prepare(
            "UPDATE songs SET track_title = ?, track_author = ?, thumb_key = ? WHERE id = ?"
          ).bind(meta.trackTitle, meta.trackAuthor, meta.thumbKey, r.id).run();
        } catch (e) {
          // leave it NULL; it'll just retry next load
        }
      })());
    }
  });

  return Response.json(results.map(function (r) { return rowToSong(r, identities); }));
}

export async function onRequestPost(context) {
  const { env, request, data, waitUntil } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }
  const url = String(body.url || "").trim().slice(0, 500);
  if (!url || !/^https?:\/\//i.test(url)) {
    return new Response("A valid song link is required", { status: 400 });
  }
  const note = String(body.note || "").trim().slice(0, 200) || null;
  const username = data.user.u;
  const now = new Date().toISOString();

  const meta = await fetchAndStoreMetadata(env, url);

  const result = await env.DB.prepare(
    "INSERT INTO songs (username, url, note, created_at, track_title, track_author, thumb_key) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(username, url, note, now, meta.trackTitle, meta.trackAuthor, meta.thumbKey).run();

  waitUntil(announce(env, username, " shared a song of the day 🎵", "musical_note"));

  return Response.json({
    id: result.meta.last_row_id,
    url: url,
    note: note,
    createdAt: now,
    trackTitle: meta.trackTitle || null,
    trackAuthor: meta.trackAuthor,
    thumbnailUrl: meta.thumbKey ? ("/images/" + meta.thumbKey) : null
  });
}
