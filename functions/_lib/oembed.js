// Fetches real title/artist/thumbnail for a song link via Spotify/YouTube's
// public oEmbed endpoints (no API key needed). Best-effort: any failure
// (unsupported platform, network hiccup, unexpected shape) resolves null
// rather than throwing, so a song can still be added without rich metadata.
export async function fetchSongMetadata(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    let oembedUrl = null;

    if (host === "open.spotify.com") {
      oembedUrl = "https://open.spotify.com/oembed?url=" + encodeURIComponent(url);
    } else if (host === "youtube.com" || host === "music.youtube.com" || host === "youtu.be") {
      oembedUrl = "https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(url);
    } else {
      return null;
    }

    const res = await fetch(oembedUrl);
    if (!res.ok) return null;
    const data = await res.json();

    return {
      title: typeof data.title === "string" ? data.title.slice(0, 200) : null,
      author: typeof data.author_name === "string" ? data.author_name.slice(0, 120) : null,
      thumbnailUrl: typeof data.thumbnail_url === "string" ? data.thumbnail_url : null
    };
  } catch (e) {
    return null;
  }
}
