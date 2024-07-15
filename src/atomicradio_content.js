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

  if (disabledActivities.includes(ACTIVITY.ATOMICRADIO)) return;

  /**
   * @return {Promise<HTMLElement>} The now playing widget element
   */
  const atomicradioReady = async () => {
    const playBar = document.querySelector(".player");
    if (!playBar) {
      await sleep(1000);
      return atomicradioReady();
    }
    return playBar;
  };

  console.info("atomicradio RPC is ready!");

  class atomicradio {
    constructor(widgetEl) {
      this.checkForChanges();
      const playButtonEl = document.querySelector("#play-button");
      const spacedId = document.querySelector("#spaceId");
      const endingAt = document.querySelector("#endingAt");
      console.log(spacedId.textContent);
      console.log(endingAt.textContent);

      const linkChangeObserver = new MutationObserver(
        throttleFunction(() => {
          this.checkForChanges();
        }, 10)
      );

      linkChangeObserver.observe(widgetEl, {
        subtree: true,
        attributes: true,
        childList: true,
      });
      linkChangeObserver.observe(playButtonEl, {
        subtree: true,
        attributes: true,
        childList: true,
      });
      this.beforePlaying = null;

      this.events = {};
    }
    async checkForChanges(seeked = false) {
      await sleep(100);
      const before = !this.beforePlaying
        ? undefined
        : { ...this.beforePlaying };
      this.beforePlaying = this.getPlayingTrack();

      if (!before) return;

      if (
        before?.title + before?.artists !==
        this.beforePlaying?.title + this.beforePlaying?.artists
      ) {
        if (!this.beforePlaying.isPlaying) return;
        this.emit("linkChanged", this.beforePlaying);
        return;
      }
      if (before?.isPlaying !== this.beforePlaying.isPlaying || seeked) {
        this.emit("isPlayingChanged", this.beforePlaying);
      }
    }
    getPlayingTrack() {
      const trackData = JSON.parse(localStorage.getItem("currentTrack"));
      var artists = trackData.artist;
      const artwork = trackData.artwork;
      const duration = Date.parse(trackData.duration);
      const space = document.querySelector("#spaceId");
      const endingAt = Date.parse(trackData.endingAt);
      const startingAt = Date.parse(trackData.startingAt);
      var title = trackData.title;
      title = title.length >= 28 ? title.slice(0, 28) + ".." : title;
      artists = artists.length >= 28 ? artists.slice(0, 28) + ".." : artists;
      const link = `https://atomic.radio/${space.textContent}`;
      const isPlaying = !!document.querySelector("#play-button");

      return {
        title: title,
        art: artwork || "",
        space: space.textContent,
        artists: artists,
        link,
        startedAt: startingAt,
        endingAt: endingAt,
        duration: duration,
        isPlaying,
      };
    }

    on(event, callback) {
      this.events[event] = callback;
    }
    emit(event, data) {
      this.events?.[event]?.(data);
    }
  }

  const method = await getConnectionMethod();

  const rpc = new (method === "BROWSER" ? ExtensionRPC : WebSocketRPC)(
    "1484242629762916352"
  );
  const readyWidget = await atomicradioReady();

  const _atomicradio = new atomicradio(readyWidget);
  rpc.connect();

  const makeRequest = (data) => {
    rpc.request({
      name: "atomicradio",
      action: "Listening to",
      imgSrc: data.art,
      title: data.title,
      link: data.link,
      subtitle: data.artists,
      startedAt: data.startedAt,
      endsAt: data.endingAt,
    });
  };

  rpc.on("ready", () => {
    const data = _atomicradio.getPlayingTrack();
    if (!data || !data.isPlaying) return;
    makeRequest(data);
  });

  _atomicradio.on("linkChanged", (data) => {
    makeRequest(data);
  });

  _atomicradio.on("isPlayingChanged", (data) => {
    if (data.isPlaying) {
      makeRequest(data);
    } else {
      rpc.request(undefined);
    }
  });
};
main();
