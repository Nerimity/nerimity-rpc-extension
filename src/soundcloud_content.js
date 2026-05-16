const main = async () => {
  const { WebSocketRPC } = await import(chrome.runtime.getURL("./WebSocketRPC.js"));
  const { ExtensionRPC } = await import(chrome.runtime.getURL("./ExtensionRPC.js"));
  const { getConnectionMethod, getDisabledActivities, ACTIVITY } = await import(chrome.runtime.getURL("./options.js"));
  const { sleep, hmsToMilliseconds, throttleFunction } = await import(chrome.runtime.getURL("./utils.js"));

  const disabledActivities = await getDisabledActivities();
  if (disabledActivities.includes(ACTIVITY.SOUNDCLOUD)) return;

  const waitForEl = async (selector) => {
    const el = document.querySelector(selector);
    if (el) return el;
    await sleep(1000);
    return waitForEl(selector);
  };

  // ── track extraction — confirmed selectors from DOM inspection ────────────

  const getTrack = () => {
    // Title: confirmed selector
    const titleEl = document.querySelector("a.playbackSoundBadge__titleLink");
    if (!titleEl) return null;

    // Artist
    const artistEl = document.querySelector("a.playbackSoundBadge__lightLink");

    // Artwork: stored as background-image on a <span> inside the avatar container
    // Confirmed: .playbackSoundBadge__avatar span contains style="background-image: url(...)"
    const artSpan = document.querySelector(".playbackSoundBadge__avatar .image__lightOutline span") ||
                    document.querySelector(".playbackSoundBadge__avatar span[style*='background-image']") ||
                    document.querySelector(".playbackSoundBadge__avatar span");

    let artUrl = "";
    if (artSpan?.style?.backgroundImage) {
      const match = artSpan.style.backgroundImage.match(/url\("?([^")]+)"?\)/);
      if (match) {
        // Upscale: replace t120x120 or large with t500x500 for better quality
        artUrl = match[1]
          .replace("-t120x120.", "-t500x500.")
          .replace("-large.", "-t500x500.");
      }
    }

    // Play state: confirmed aria-label is "Pause current" when playing
    const playBtn = document.querySelector("button.playControl");
    const isPlaying = playBtn?.getAttribute("aria-label") === "Pause current";

    // Progress: .playbackTimeline__progressWrapper has aria-valuenow (seconds) and aria-valuemax (total seconds)
    const progressEl = document.querySelector(".playbackTimeline__progressWrapper");
    const positionSec = parseFloat(progressEl?.getAttribute("aria-valuenow") ?? "0");
    const durationSec = parseFloat(progressEl?.getAttribute("aria-valuemax") ?? "0");

    return {
      title: titleEl.getAttribute("title") || titleEl.textContent?.trim() || "",
      artist: artistEl?.getAttribute("title") || artistEl?.textContent?.trim() || "",
      link: titleEl.href || "",
      artUrl,
      isPlaying,
      positionMs: positionSec * 1000,
      durationMs: durationSec * 1000,
    };
  };

  // ── RPC setup ─────────────────────────────────────────────────────────────

  const method = await getConnectionMethod();
  const rpc = new (method === "BROWSER" ? ExtensionRPC : WebSocketRPC)("1484242629762916352");

  let prevKey = null;

  const makeRequest = (data) => {
    if (!data || !data.isPlaying) {
      rpc.request(undefined);
      prevKey = null;
      return;
    }
    const key = data.title + data.artist;
    if (key === prevKey) return;
    prevKey = key;

    rpc.request({
      name: "SoundCloud",
      action: "Listening to",
      imgSrc: data.artUrl,
      title: data.title,
      link: data.link,
      subtitle: data.artist,
      startedAt: Date.now() - data.positionMs,
      endsAt: data.durationMs ? Date.now() - data.positionMs + data.durationMs : undefined,
    });
  };

  // Wait for the player badge — appears once SoundCloud loads (even before playing)
  await waitForEl("a.playbackSoundBadge__titleLink, .playbackSoundBadge, .playControls");

  rpc.connect();

  rpc.on("ready", () => {
    const data = getTrack();
    if (data?.isPlaying) makeRequest(data);
  });

  // Poll every 2s AND observe mutations for instant updates
  setInterval(() => {
    makeRequest(getTrack());
  }, 2000);

  const playerEl = document.querySelector(".playbackSoundBadge, .playControls__elements");
  if (playerEl) {
    new MutationObserver(
      throttleFunction(() => makeRequest(getTrack()), 300)
    ).observe(playerEl, { subtree: true, attributes: true, childList: true });
  }
};

main();
