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
  const { sleep } = await import(chrome.runtime.getURL("./utils.js"));

  const disabledActivities = await getDisabledActivities();
  if (disabledActivities.includes(ACTIVITY.MULTIMEDIA)) return;

  // Load blacklist config (non-fatal if missing)
  const blacklist = await fetch(
    chrome.runtime.getURL("./blacklisted_websites.json")
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  function isBlacklistedHost(url) {
    if (!blacklist || !Array.isArray(blacklist.hostnames)) return false;

    try {
      const { hostname } = new URL(url);
      const host = String(hostname || "")
        .toLowerCase()
        .replace(/^www\./, "");

      return blacklist.hostnames.some((blocked) => {
        const b = String(blocked || "")
          .toLowerCase()
          .replace(/^www\./, "");
        return host === b || host.endsWith("." + b);
      });
    } catch {
      return false;
    }
  }

  const domReady = async () => {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      return;
    }
    await sleep(500);
    return domReady();
  };

  function getMetaContent(selector) {
    const el = document.querySelector(selector);
    return el && el.content ? el.content.trim() : null;
  }

  function getHostname() {
    try {
      const url = new URL(window.location.href);
      return (url.hostname || "").replace(/^www\./i, "").trim();
    } catch {
      return "";
    }
  }

  function getPlatformName() {
    const ogSiteName = getMetaContent('meta[property="og:site_name"]');
    if (ogSiteName) return ogSiteName;

    const host = getHostname();
    return host || "Unknown";
  }

  function getGenericArtworkUrl() {
    const ms = navigator.mediaSession && navigator.mediaSession.metadata;
    if (
      ms &&
      Array.isArray(ms.artwork) &&
      ms.artwork.length > 0 &&
      ms.artwork[0].src
    ) {
      return ms.artwork[0].src;
    }

    const ogImage =
      getMetaContent('meta[property="og:image"]') ||
      getMetaContent('meta[name="twitter:image"]') ||
      getMetaContent('meta[name="twitter:image:src"]');
    if (ogImage) return ogImage;

    const iconEl =
      document.querySelector('link[rel="icon"]') ||
      document.querySelector('link[rel="shortcut icon"]') ||
      document.querySelector('link[rel="apple-touch-icon"]');
    if (iconEl && iconEl.href) return iconEl.href;

    return null;
  }

  function getMediaSessionMetadata() {
    const ms = navigator.mediaSession && navigator.mediaSession.metadata;
    if (!ms) return { artist: null, title: null, album: null, art: null };

    return {
      artist: ms.artist || null,
      title: ms.title || null,
      album: ms.album || null,
      art:
        (Array.isArray(ms.artwork) &&
          ms.artwork.length > 0 &&
          ms.artwork[0].src) ||
        null,
    };
  }

  function getActiveMediaElement() {
    const mediaEls = Array.from(document.querySelectorAll("audio, video"));
    const active = mediaEls.find((el) => {
      try {
        return !el.paused && !el.ended && el.currentTime > 0;
      } catch (_) {
        return false;
      }
    });
    return active || null;
  }

  class MediaWatcher {
    constructor() {
      this.before = null;
      this.events = {};
      this.intervalId = setInterval(() => {
        this.checkForChanges();
      }, 2000);
    }

    getCurrentTrack() {
      const activeMedia = getActiveMediaElement();
      const {
        artist: msArtist,
        title: msTitle,
        album: msAlbum,
        art: msArt,
      } = getMediaSessionMetadata();

      const isPlaying = !!activeMedia;
      if (!isPlaying && !msTitle && !msArtist) {
        return null;
      }

      const platform = getPlatformName();
      const link = window.location.href;

      const title =
        msTitle ||
        (document.title && document.title.trim()) ||
        platform ||
        "Live stream";

      const artist = msArtist || null;
      const art = msArt || getGenericArtworkUrl();

      let position = null;
      let duration = null;
      let mediaType = null;

      if (activeMedia) {
        try {
          if (typeof activeMedia.currentTime === "number") {
            position = activeMedia.currentTime;
          }
          if (
            typeof activeMedia.duration === "number" &&
            isFinite(activeMedia.duration) &&
            activeMedia.duration > 0
          ) {
            duration = activeMedia.duration;
          }
          const tag = activeMedia.tagName.toLowerCase();
          if (tag === "video") mediaType = "video";
          else if (tag === "audio") mediaType = "audio";
        } catch (_) {}
      }

      return {
        platform,
        artist,
        title,
        album: msAlbum || null,
        isPlaying,
        art,
        link,
        position,
        duration,
        mediaType,
      };
    }

    async checkForChanges() {
      const current = this.getCurrentTrack();
      if (!current) return;

      if (!this.before) {
        this.before = { ...current };
        if (current.isPlaying) {
          this.emit("initial", current);
        }
        return;
      }

      const keyBefore =
        (this.before.title || "") +
        "|" +
        (this.before.artist || "") +
        "|" +
        (this.before.platform || "") +
        "|" +
        (this.before.link || "");
      const keyCurrent =
        (current.title || "") +
        "|" +
        (current.artist || "") +
        "|" +
        (current.platform || "") +
        "|" +
        (current.link || "");

      const hadDuration =
        typeof this.before.duration === "number" &&
        isFinite(this.before.duration) &&
        this.before.duration > 0;
      const hasDuration =
        typeof current.duration === "number" &&
        isFinite(current.duration) &&
        current.duration > 0;

      if (keyBefore !== keyCurrent) {
        this.before = { ...current };
        if (current.isPlaying) {
          this.emit("trackChanged", current);
        } else {
          this.emit("stopped", current);
        }
        return;
      }

      if (this.before.isPlaying !== current.isPlaying) {
        this.before = { ...current };
        this.emit("isPlayingChanged", current);
        return;
      }

      if (!hadDuration && hasDuration && current.isPlaying) {
        this.before = { ...current };
        this.emit("trackChanged", current);
      }
    }

    on(event, callback) {
      this.events[event] = callback;
    }

    emit(event, data) {
      if (typeof this.events[event] === "function") {
        this.events[event](data);
      }
    }
  }

  await domReady();

  // Domain kill-switch: ONLY domains in blacklist.hostnames disable RPC
  if (isBlacklistedHost(window.location.href)) return;

  const method = await getConnectionMethod();
  const rpc = new (method === "BROWSER" ? ExtensionRPC : WebSocketRPC)(
    "1484242629762916352"
  );

  const mediaWatcher = new MediaWatcher();
  rpc.connect();

  const makeRequest = (data) => {
    // Extra safety: never send if user navigates onto a blacklisted domain
    const url = data.link || window.location.href;
    if (isBlacklistedHost(url)) return;

    const title = data.title || data.platform || "Live stream";
    const platform = data.platform || "Media";
    let subtitle = platform;

    if (data.artist) {
      subtitle = `${data.artist} • ${platform}`;
    } else if (data.album) {
      subtitle = `${data.album} • ${platform}`;
    }

    const now = Date.now();
    let startedAt = now - 2000;
    let endsAt;

    if (typeof data.position === "number" && data.position >= 0) {
      const positionMs = Math.floor(data.position * 1000);
      startedAt = now - positionMs;

      if (
        typeof data.duration === "number" &&
        isFinite(data.duration) &&
        data.duration > 0
      ) {
        const durationMs = Math.floor(data.duration * 1000);
        endsAt = startedAt + durationMs;
      }
    }

    const action = data.mediaType === "video" ? "Watching" : "Listening to";

    const payload = {
      name: "Multi-Platform Media",
      action,
      imgSrc: data.art || undefined,
      title,
      link: url,
      subtitle,
      startedAt,
    };

    if (typeof endsAt === "number") {
      payload.endsAt = endsAt;
    }

    rpc.request(payload);
  };

  rpc.on("ready", () => {
    const data = mediaWatcher.getCurrentTrack();
    if (!data || !data.isPlaying) return;
    makeRequest(data);
  });

  mediaWatcher.on("initial", (data) => {
    if (data.isPlaying) makeRequest(data);
  });

  mediaWatcher.on("trackChanged", (data) => {
    if (data.isPlaying) makeRequest(data);
  });

  mediaWatcher.on("isPlayingChanged", (data) => {
    if (data.isPlaying) {
      makeRequest(data);
    } else {
      rpc.request(undefined);
    }
  });
};

main();
