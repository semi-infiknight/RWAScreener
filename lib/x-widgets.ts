/**
 * Unused: official Tweet.html embed helpers. The public feed is native cards
 * because iframe widgets stall scrolling. Keep for a later opt-in.
 */

export function twitterStatusUrl(url: string, id: string): string {
  try {
    const parsed = new URL(url);
    parsed.hostname = "twitter.com";
    return parsed.toString();
  } catch {
    return `https://twitter.com/i/status/${id}`;
  }
}

/** Same query string Twitter for Websites puts on the widget iframe. */
export function xEmbedSrc(id: string, origin?: string): string {
  const params = new URLSearchParams({
    dnt: "true",
    embedId: `eco-${id}`,
    frame: "false",
    hideCard: "false",
    hideThread: "true",
    id,
    lang: "en",
    theme: "dark",
    width: "550",
  });
  if (origin) params.set("origin", origin);
  return `https://platform.twitter.com/embed/Tweet.html?${params.toString()}`;
}

let resizeBound = false;

/** Widget iframes post height to the parent; match widgets.js resize behavior. */
export function bindXEmbedResize() {
  if (typeof window === "undefined" || resizeBound) return;
  resizeBound = true;
  window.addEventListener("message", (event) => {
    const origin = event.origin || "";
    if (
      !origin.includes("twitter.com") &&
      !origin.includes("x.com") &&
      !origin.includes("twimg.com")
    ) {
      return;
    }
    let payload: unknown = event.data;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        return;
      }
    }
    if (!payload || typeof payload !== "object") return;
    const rec = payload as { params?: { height?: number }; height?: number };
    const height = rec.params?.height ?? rec.height;
    if (!height || height < 40) return;
    const frames = document.querySelectorAll<HTMLIFrameElement>("iframe.eco-x-iframe");
    for (const frame of frames) {
      if (frame.contentWindow === event.source) {
        frame.style.height = `${Math.ceil(height)}px`;
        break;
      }
    }
  });
}
