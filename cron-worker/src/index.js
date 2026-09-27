// Runs once a day (see wrangler.toml crons). Checks whether either account has
// gone quiet for a few days and sends a gentle self-reminder — a nudge to the
// person who's been away, not a report to their partner. Deduped via the
// `nudges` table so it fires at most once per cooldown window, not every day
// they stay inactive.

const NTFY_BASE = "https://ntfy.sh";
const INACTIVITY_DAYS = 3;
const RENUDGE_COOLDOWN_DAYS = 3;

function topicFor(env, username) {
  return username === "joshua" ? env.NTFY_TOPIC_FOR_JOSHUA : env.NTFY_TOPIC_FOR_DEIN;
}

async function checkInactivity(env) {
  const now = Date.now();
  const inactiveCutoff = now - INACTIVITY_DAYS * 24 * 60 * 60 * 1000;
  const renudgeCutoff = now - RENUDGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  const { results: accounts } = await env.DB.prepare("SELECT username FROM users").all();

  for (const { username } of accounts) {
    const lastActivity = await env.DB.prepare(
      "SELECT created_at FROM activity WHERE username = ? ORDER BY id DESC LIMIT 1"
    ).bind(username).first();
    const lastActiveAt = lastActivity ? new Date(lastActivity.created_at).getTime() : 0;
    if (lastActiveAt >= inactiveCutoff) continue;

    const lastNudge = await env.DB.prepare("SELECT sent_at FROM nudges WHERE username = ?").bind(username).first();
    const lastNudgeAt = lastNudge ? new Date(lastNudge.sent_at).getTime() : 0;
    if (lastNudgeAt >= renudgeCutoff) continue;

    const topic = topicFor(env, username);
    if (!topic) continue;

    try {
      await fetch(NTFY_BASE + "/" + encodeURIComponent(topic), {
        method: "POST",
        headers: { "Title": "Pinned Together", "Tags": "wave" },
        body: "We miss you! It's been a few days — come see what's new on your board 💌"
      });
    } catch (e) {
      continue;
    }

    await env.DB.prepare(
      "INSERT INTO nudges (username, sent_at) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET sent_at = excluded.sent_at"
    ).bind(username, new Date().toISOString()).run();
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkInactivity(env));
  },
  async fetch() {
    return new Response("This worker only runs on a schedule (daily inactivity check).", { status: 200 });
  }
};
