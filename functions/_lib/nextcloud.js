export const NEXTCLOUD_BASE = "https://nextcloud.enganostudios.com";
export const DRIVE_FOLDER = "PinnedTogetherDrive";

export function authHeader(env) {
  return "Basic " + btoa(env.NEXTCLOUD_USER + ":" + env.NEXTCLOUD_APP_PASSWORD);
}

export function davUrl(env, name) {
  const user = encodeURIComponent(env.NEXTCLOUD_USER);
  const base = NEXTCLOUD_BASE + "/remote.php/dav/files/" + user + "/" + encodeURIComponent(DRIVE_FOLDER);
  return name ? base + "/" + encodeURIComponent(name) : base;
}

export async function ensureFolder(env) {
  const res = await fetch(davUrl(env), {
    method: "MKCOL",
    headers: { Authorization: authHeader(env) }
  });
  // 201 = created, 405 = already exists — both fine
  if (!res.ok && res.status !== 405) {
    throw new Error("Could not prepare the Nextcloud folder (status " + res.status + ")");
  }
}

const PROPFIND_BODY =
  '<?xml version="1.0"?>' +
  '<d:propfind xmlns:d="DAV:">' +
  "<d:prop>" +
  "<d:resourcetype/>" +
  "<d:getcontentlength/>" +
  "<d:getlastmodified/>" +
  "<d:getcontenttype/>" +
  "</d:prop>" +
  "</d:propfind>";

export async function listFolder(env) {
  const res = await fetch(davUrl(env), {
    method: "PROPFIND",
    headers: {
      Authorization: authHeader(env),
      Depth: "1",
      "Content-Type": "application/xml"
    },
    body: PROPFIND_BODY
  });
  if (!res.ok) {
    throw new Error("Nextcloud listing failed (status " + res.status + ")");
  }
  const xml = await res.text();
  return parseListing(xml);
}

export function parseListing(xml) {
  const items = [];
  const blocks = xml.match(/<[\w]*:?response>[\s\S]*?<\/[\w]*:?response>/gi) || [];
  for (const block of blocks) {
    const hrefMatch = block.match(/<[\w]*:?href>([^<]*)<\/[\w]*:?href>/i);
    if (!hrefMatch) continue;
    var href = hrefMatch[1];
    try { href = decodeURIComponent(href); } catch (e) {}
    const name = href.replace(/\/+$/, "").split("/").pop();
    if (!name || name === DRIVE_FOLDER) continue;
    const isDir = /<[\w]*:?collection\s*\/?>/i.test(block);
    const sizeMatch = block.match(/<[\w]*:?getcontentlength>([^<]*)<\/[\w]*:?getcontentlength>/i);
    const mtimeMatch = block.match(/<[\w]*:?getlastmodified>([^<]*)<\/[\w]*:?getlastmodified>/i);
    const typeMatch = block.match(/<[\w]*:?getcontenttype>([^<]*)<\/[\w]*:?getcontenttype>/i);
    let modifiedAt = null;
    if (mtimeMatch) {
      const d = new Date(mtimeMatch[1]);
      if (!isNaN(d.getTime())) modifiedAt = d.toISOString();
    }
    items.push({
      name: name,
      isDir: isDir,
      size: sizeMatch ? Number(sizeMatch[1]) : 0,
      modifiedAt: modifiedAt,
      contentType: typeMatch ? typeMatch[1] : null
    });
  }
  return items;
}
