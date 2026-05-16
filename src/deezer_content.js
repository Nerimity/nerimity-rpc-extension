const main = async () => {
  const { WebSocketRPC } = await import(chrome.runtime.getURL("./WebSocketRPC.js"));
  const { ExtensionRPC } = await import(chrome.runtime.getURL("./ExtensionRPC.js"));
  const { getConnectionMethod, getDisabledActivities, ACTIVITY } = await import(chrome.runtime.getURL("./options.js"));
  const { sleep, throttleFunction } = await import(chrome.runtime.getURL("./utils.js"));

  const disabledActivities = await getDisabledActivities();
  if (disabledActivities.includes(ACTIVITY.DEEZER)) return;

  // ── extraction helpers ────────────────────────────────────────────────────

  /**
   * Parse document.title format: "Track - Artist - Deezer"
   * Returns null for generic page titles (e.g. "Explore | Deezer").
   */
  const parseTitle = () => {
    const title = document.title;
    const parts = title.split(" - ");
    // Valid track title has at least 3 parts and the last is "Deezer"
    if (parts.length < 3 || parts[parts.length - 1] !== "Deezer") return null;
    const artist = parts[parts.length - 2];
    const track = parts.slice(0, parts.length - 2).join(" - ");
    if (!track || !artist) return null;
    return { track, artist };
  };

  /**
   * Play state: confirmed — button[aria-label='Pause'] exists only while playing.
   * "Pause" is the same in every Deezer locale.
   */
  const isPlaying = () => !!document.querySelector("button[aria-label='Pause']");

  /**
   * Album art: confirmed selector — dzcdn.net 500x500 cover image.
   * Falls back to any dzcdn.net cover image.
   */
  const getArt = () =>
    document.querySelector("img[src*='dzcdn.net'][src*='500x500']")?.src ||
    document.querySelector("img[src*='dzcdn.net'][src*='cover']")?.src ||
    "";

  // ── RPC setup ─────────────────────────────────────────────────────────────

  const method = await getConnectionMethod();
  const rpc = new (method === "BROWSER" ? ExtensionRPC : WebSocketRPC)("1484242629762916352");

  let lastKey = null;
  let trackStartedAt = Date.now();

  const makeRequest = () => {
    if (!isPlaying()) {
      if (lastKey !== null) {
        rpc.request(undefined);
        lastKey = null;
      }
      return;
    }

    const parsed = parseTitle();
    if (!parsed) {
      if (lastKey !== null) {
        rpc.request(undefined);
        lastKey = null;
      }
      return;
    }

    const { track, artist } = parsed;
    const artUrl = getArt();
    const key = `${track}|${artist}`;

    if (key === lastKey) return;

    // Reset timer when track changes
    if (key !== lastKey) trackStartedAt = Date.now();

    lastKey = key;

    rpc.request({
      name: "Deezer",
      action: "Listening to",
      imgSrc: artUrl,
      title: track,
      link: location.href,
      subtitle: artist,
      startedAt: trackStartedAt,
    });
  };

  // ── init ──────────────────────────────────────────────────────────────────

  // Wait a bit for Deezer's SPA to finish rendering
  await sleep(2000);

  rpc.connect();
  rpc.on("ready", () => makeRequest());

  // Poll every 2s (catches play/pause changes and track changes)
  setInterval(makeRequest, 2000);

  // React instantly to title changes (track change)
  const titleEl = document.querySelector("title");
  if (titleEl) {
    new MutationObserver(
      throttleFunction(() => makeRequest(), 300)
    ).observe(titleEl, { childList: true });
  }

  // Also react to button DOM changes (play/pause)
  new MutationObserver(
    throttleFunction(() => makeRequest(), 300)
  ).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["aria-label"] });
};

main();
