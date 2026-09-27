import { topicForViewer } from "../_lib/notify.js";

export async function onRequestGet(context) {
  const { env, data } = context;
  const topic = topicForViewer(env, data.user.u);
  return Response.json({
    topic: topic || null,
    url: topic ? ("https://ntfy.sh/" + topic) : null
  });
}
