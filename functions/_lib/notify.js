import { identityFor, otherUsername } from "./auth.js";

const NTFY_BASE = "https://ntfy.sh";
const APP_URL = "https://pinned.enganostudios.com/";
const ACTIVITY_LIMIT = 300;

function topicFor(env, username) {
  return username === "joshua" ? env.NTFY_TOPIC_FOR_JOSHUA : env.NTFY_TOPIC_FOR_DEIN;
}

// Sends a notification to whichever account did NOT perform the action.
// Never throws — a failed notification should never break the API call it rides along with.
export async function notifyOther(env, actingUsername, message, tag) {
  try {
    const recipient = await otherUsername(env, actingUsername);
    if (!recipient) return;
    const topic = topicFor(env, recipient);
    if (!topic) return;

    await fetch(NTFY_BASE + "/" + encodeURIComponent(topic), {
      method: "POST",
      headers: {
        "Title": "Pinned Together",
        "Tags": tag || "",
        "Click": APP_URL
      },
      body: message
    });
  } catch (e) {
    console.warn("ntfy notify failed", e && e.message ? e.message : e);
  }
}

// Records an event in the persistent activity feed (both accounts' actions, unlike
// notifyOther which only pings the OTHER account). Also never throws.
export async function logActivity(env, username, message, tag) {
  try {
    await env.DB.prepare(
      "INSERT INTO activity (username, message, tag, created_at) VALUES (?, ?, ?, ?)"
    ).bind(username, message, tag || null, new Date().toISOString()).run();
    await env.DB.prepare(
      "DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY id DESC LIMIT " + ACTIVITY_LIMIT + ")"
    ).run();
  } catch (e) {
    console.warn("activity log failed", e && e.message ? e.message : e);
  }
}

// Convenience: resolve the acting user's current nickname, then both push-notify
// the other account and record it in the activity feed, in one call.
export async function announce(env, actingUsername, actionText, tag) {
  const { author } = await identityFor(env, actingUsername);
  const message = author + actionText;
  await Promise.all([
    notifyOther(env, actingUsername, message, tag),
    logActivity(env, actingUsername, message, tag)
  ]);
}

export function topicForViewer(env, username) {
  return topicFor(env, username);
}
