const main = async () => {
  const { WebSocketRPC } = await import(
    chrome.runtime.getURL("./WebSocketRPC.js")
  );
  const { ExtensionRPC } = await import(
    chrome.runtime.getURL("./ExtensionRPC.js")
  );
  const { getConnectionMethod, getDisabledActivities, ACTIVITY } = await import(
    chrome.runtime.getURL("./options.js")
  );
  const { sleep, throttleFunction } = await import(
    chrome.runtime.getURL("./utils.js")
  );

  const disabledActivities = await getDisabledActivities();
  if (disabledActivities.includes(ACTIVITY.TWITCH)) return;

  // ── helpers ──────────────────────────────────────────────────────────────

  /** Wait until a DOM element matching `selector` appears, polling every second. */
  const waitForEl = async (selector) => {
    const el = document.querySelector(selector);
    if (el) return el;
    await sleep(1000);
    return waitForEl(selector);
  };

  /** Safely read text content from an element, returning "" on failure. */
  const safeText = (selector) =>
    document.querySelector(selector)?.textContent?.trim() ?? "";

  // ── data extraction ───────────────────────────────────────────────────────

  /**
   * Returns the current stream info from the Twitch page, or null when we're
   * not on a live channel page / the streamer is offline.
   *
   * @returns {{ streamer: string, title: string, game: string, url: string, avatarUrl: string } | null}
   */
  const getStreamInfo = () => {
    // Twitch places the channel name in the pathname: /streamerName
    const pathParts = location.pathname.split("/").filter(Boolean);
    const streamer = pathParts[0];

    // We only track the main channel page (not clips, videos, etc.)
    if (!streamer || pathParts.length > 1) return null;

    // Detect if the stream is actually live via the "LIVE" badge
    const liveBadge = document.querySelector(
      "[data-a-target='player-overlay-mature-accept'], " +
      ".live-badge, " +
      "[data-test-selector='stream-info-card-component__live'], " +
      // The persistent red pill in the player
      "p[data-a-target='animated-channel-viewers-count']"
    );

    // Fall back: check channel status text shown under the player
    const channelStatusLive = document.querySelector(
      // "LIVE" label that appears under the video player
      ".tw-channel-status-text-indicator--live, " +
      "[data-a-target='video-ad-label'], " +
      // Sidebar live indicator
      ".side-nav-card__live-status"
    );

    // Another reliable signal: viewer count element only exists during live streams
    const viewerCountEl = document.querySelector(
      "[data-a-target='animated-channel-viewers-count']"
    );

    const isLive = !!(viewerCountEl || liveBadge || channelStatusLive);

    if (!isLive) return null;

    // Stream title — Twitch stores it in several places; try the most reliable ones
    const title =
      safeText("[data-a-target='stream-title']") ||
      safeText(".channel-info-content h2") ||
      safeText("h2.tw-title");

    // Category / game being played
    const game =
      safeText("[data-a-target='stream-game-link']") ||
      safeText(".game-name");

    // Streamer avatar — must target the channel info panel below the player,
    // NOT the top-nav avatar (which belongs to the logged-in viewer).
    // We query inside the channel info section first, then fall back to
    // the sidebar card, NEVER the top-nav.
    const channelInfoSection =
      document.querySelector(".channel-info-content") ||
      document.querySelector("[data-test-selector='channel-info-component']") ||
      document.querySelector(".tw-channel-header");

    // Within the channel info block, grab the first avatar image
    let avatarEl = channelInfoSection?.querySelector(
      "img.tw-image-avatar, .tw-avatar img, img[alt*='profile'], img[class*='avatar']"
    );

    // Second attempt: sidebar "suggested channels" card for the current streamer
    if (!avatarEl) {
      avatarEl = document.querySelector(
        // The streamer's own card at the top of the sidebar
        `.side-nav-card[href*='/${streamer.toLowerCase()}'] img, ` +
        // Channel header logo (appears on some layouts)
        `[data-a-target='nav-header-logo'] img`
      );
    }

    // Make sure we didn't accidentally grab the top-nav user avatar
    const topNav = document.querySelector(".top-nav, header nav");
    if (avatarEl && topNav?.contains(avatarEl)) {
      avatarEl = null;
    }

    const avatarUrl = avatarEl?.src ?? "";

    return {
      streamer,
      title: title || streamer,
      game: game || "",
      url: `https://www.twitch.tv/${streamer}`,
      avatarUrl,
    };
  };

  // ── RPC setup ─────────────────────────────────────────────────────────────

  const method = await getConnectionMethod();
  const rpc = new (method === "BROWSER" ? ExtensionRPC : WebSocketRPC)(
    "1484242629762916352"
  );

  let lastSentKey = null;
  let streamStartedAt = Date.now();
  let currentStreamer = null;
  let clearRpcTimeoutId = null;

  const makeRequest = (info) => {
    if (!info) {
      // Schedule clearing the RPC after a short grace period (avoids flickers)
      clearRpcTimeoutId = setTimeout(() => {
        rpc.request(undefined);
        lastSentKey = null;
      }, 3000);
      return;
    }

    clearTimeout(clearRpcTimeoutId);

    const key = `${info.streamer}|${info.title}|${info.game}`;
    if (key === lastSentKey) return; // nothing changed

    // Reset timer when the streamer or stream changes
    if (info.streamer !== currentStreamer) {
      streamStartedAt = Date.now();
      currentStreamer = info.streamer;
    }

    lastSentKey = key;

    rpc.request({
      name: "Twitch",
      action: "Watching",
      imgSrc: info.avatarUrl,
      title: info.streamer,
      link: info.url,
      subtitle: info.title + (info.game ? ` · ${info.game}` : ""),
      startedAt: streamStartedAt,
    });
  };

  // ── polling loop ──────────────────────────────────────────────────────────

  // Wait until the main Twitch layout element is ready before starting
  await waitForEl("[data-a-target='animated-channel-viewers-count'], .channel-info-content, #channel-header-vue-container");

  rpc.connect();

  rpc.on("ready", () => {
    makeRequest(getStreamInfo());
  });

  // Poll every 5 s — Twitch is a SPA so the URL / DOM can change without a reload
  setInterval(() => {
    makeRequest(getStreamInfo());
  }, 5000);

  // Also react to Twitch's client-side navigation
  let lastUrl = location.href;
  const navObserver = new MutationObserver(
    throttleFunction(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastSentKey = null; // force refresh on navigation
        currentStreamer = null;
        setTimeout(() => makeRequest(getStreamInfo()), 2000); // let DOM settle
      }
    }, 500)
  );
  navObserver.observe(document.body, { childList: true, subtree: true });
};

main();
