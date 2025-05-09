var mainScript = document.createElement("script");
mainScript.src = chrome.runtime.getURL("youtube_inject.js");
(document.head || document.documentElement).appendChild(mainScript);


const main = async () => {
  const { WebSocketRPC } = await import(
    chrome.runtime.getURL("./WebSocketRPC.js")
  );
  const { ExtensionRPC } = await import(
    chrome.runtime.getURL("./ExtensionRPC.js")
  );
  const { secondsToMilliseconds } = await import(
    chrome.runtime.getURL("./utils.js")
  );
  const {
    getConnectionMethod,
    getDisabledActivities,
    ACTIVITY,
    isYouTubeChannelWhitelisted,
  } = await import(chrome.runtime.getURL("./options.js"));

  const disabledActivities = await getDisabledActivities();

  if (disabledActivities.includes(ACTIVITY.YOUTUBE)) return;

  let lastData = null;

  let channelName = "";

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "from-popup") {
      const action = request.data.action;

      if (action === "yt-whitelist-updated") {
        makeRequest(lastData, true);
      }

      if (action === "popup-opened") {
        chrome.runtime.sendMessage({
        action: "content-to-popup",
        data: { action: "yt-channel-name", channelName },
      });
      }
    }
  });


  const method = await getConnectionMethod();

  const rpc = new (method === "BROWSER" ? ExtensionRPC : WebSocketRPC)(
    "1484242629762916352"
  );

  rpc.connect();

  rpc.on("ready", () => {
    if (lastData?.paused) return;
    makeRequest(lastData, true);
  });

  let pauseTimeoutId = null;

  const makeRequest = async (data, force = false) => {
    const isYTMusic = location.href.startsWith("https://music.youtube.com");

    if (!isYTMusic) {
      channelName = data?.channelName || "";
    }

    if (!force && compareJSON(lastData, data)) return;
    let isWhitelisted =
      data?.channelName &&
      (await isYouTubeChannelWhitelisted(data?.channelName));

    if (isYTMusic) {
      isWhitelisted = true;
    }

    if (!isWhitelisted || data?.paused || !data) {
      pauseTimeoutId = setTimeout(() => {
        rpc.request(undefined);
      }, 2000);
      return;
    }
    clearTimeout(pauseTimeoutId);

    if (!data.duration) return;

    rpc.request({
      name: isYTMusic ? "YT Music" : "YouTube",
      action: isYTMusic ? "Listening to" : "Watching",
      imgSrc: data.thumbnailUrl,
      title: data.title,
      link: data.url,
      subtitle: data.channelName,
      startedAt: Date.now() - secondsToMilliseconds(data.currentTime),
      speed: data.speed,
      endsAt: data.liveStream
        ? undefined
        : Date.now() -
          secondsToMilliseconds(data.currentTime) +
          secondsToMilliseconds(data.duration),
    });
  };

  window.addEventListener("SendToLoader", function (message) {
    makeRequest(message.detail);
    lastData = message.detail;
  });
};
main();

const compareJSON = (a, b) => {
  return JSON.stringify(a) === JSON.stringify(b);
};
