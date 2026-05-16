const main = async () => {
  const { WebSocketRPC } = await import(chrome.runtime.getURL("./WebSocketRPC.js"));
  const { ExtensionRPC } = await import(chrome.runtime.getURL("./ExtensionRPC.js"));
  const { getConnectionMethod, getDisabledActivities, ACTIVITY } = await import(chrome.runtime.getURL("./options.js"));
  const { sleep, throttleFunction } = await import(chrome.runtime.getURL("./utils.js"));

  const disabledActivities = await getDisabledActivities();
  if (disabledActivities.includes(ACTIVITY.KICK)) return;

  // ── helpers ───────────────────────────────────────────────────────────────

  const safeText = (selector) =>
    document.querySelector(selector)?.textContent?.trim() ?? "";

  const metaContent = (property) =>
    document.querySelector(`meta[property='${property}']`)?.content ?? "";

  /** Extract the channel slug from the current URL. */
  const getSlug = () => {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.length === 1 ? parts[0] : null;
  };

  // ── stream info extraction ────────────────────────────────────────────────

  const getStreamInfo = () => {
    const slug = getSlug();
    if (!slug) return null;

    // Live detection: og:title contains "Watch Live" only for live streams
    // e.g. "DaniloFariasFut Stream - Watch Live on Kick"
    const ogTitle = metaContent("og:title");
    const isLive = ogTitle.toLowerCase().includes("watch live") ||
                   ogTitle.toLowerCase().includes("is live");

    if (!isLive) return null;

    // Streamer name — confirmed: first h1 on the page
    const streamer = safeText("h1") || slug;

    // Avatar — confirmed: og:image returns files.kick.com/images/user/.../fullsize.webp
    const avatarUrl = metaContent("og:image");

    // Stream title — confirmed selector from DOM inspection
    // Uses the title attribute to avoid &nbsp; entities in textContent
    const streamTitleEl = document.querySelector("[data-testid='livestream-title']");
    const streamTitle = streamTitleEl?.getAttribute("title") ||
                        streamTitleEl?.textContent?.replace(/\u00a0/g, " ").trim() ||
                        "";

    return {
      slug,
      streamer,
      avatarUrl,
      title: streamTitle || streamer,
      url: `https://kick.com/${slug}`,
    };
  };

  // ── fallback: Kick public API (for stream title + richer data) ────────────

  const fetchStreamTitle = async (slug) => {
    try {
      const res = await fetch(`https://kick.com/api/v2/channels/${slug}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin", // use existing session cookies
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.livestream?.session_title ?? null;
    } catch {
      return null;
    }
  };

  // ── RPC setup ─────────────────────────────────────────────────────────────

  const method = await getConnectionMethod();
  const rpc = new (method === "BROWSER" ? ExtensionRPC : WebSocketRPC)("1484242629762916352");

  let lastKey = null;
  let streamStartedAt = Date.now();
  let currentSlug = null;
  let clearTimeoutId = null;

  const sendRpc = (info, title) => {
    const finalTitle = title || info.title;
    clearTimeout(clearTimeoutId);

    const key = `${info.slug}|${finalTitle}`;
    if (key === lastKey) return;

    if (info.slug !== currentSlug) {
      streamStartedAt = Date.now();
      currentSlug = info.slug;
    }

    lastKey = key;

    rpc.request({
      name: "Kick",
      action: "Watching",
      imgSrc: info.avatarUrl,
      title: info.streamer,
      link: info.url,
      subtitle: finalTitle,
      startedAt: streamStartedAt,
    });
  };

  const clearRpc = () => {
    clearTimeoutId = setTimeout(() => {
      rpc.request(undefined);
      lastKey = null;
    }, 3000);
  };

  const poll = async () => {
    const info = getStreamInfo();
    if (!info) {
      clearRpc();
      return;
    }

    // Send immediately with DOM data (fast)
    sendRpc(info, null);

    // Then enrich with API data for the stream title (slower but accurate)
    const apiTitle = await fetchStreamTitle(info.slug);
    if (apiTitle && apiTitle !== info.title) {
      sendRpc(info, apiTitle);
    }
  };

  // Wait for meta tags to be populated (Kick is SSR so they're usually ready)
  await sleep(1500);

  rpc.connect();
  rpc.on("ready", () => poll());

  // Poll every 15 s
  setInterval(poll, 15_000);

  // SPA navigation detection
  let lastUrl = location.href;
  new MutationObserver(
    throttleFunction(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastKey = null;
        currentSlug = null;
        setTimeout(poll, 2000);
      }
    }, 500)
  ).observe(document.body, { childList: true, subtree: true });
};

main();
