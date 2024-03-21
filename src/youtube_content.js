var mainScript = document.createElement("script");
mainScript.src = chrome.runtime.getURL("youtube_inject.js");
(document.head || document.documentElement).appendChild(mainScript);


const main = async () => {
  const { WebSocketRPC } = await import("./WebSocketRPC.js");
  const { ExtensionRPC } = await import("./ExtensionRPC.js");
  const {secondsToMilliseconds} = await import("./utils.js");
  const {getConnectionMethod, getDisabledActivities, ACTIVITY} = await import("./options.js");


  const disabledActivities = await getDisabledActivities();

  if (disabledActivities.includes(ACTIVITY.YOUTUBE)) return;
  
  

  let lastData = null;

  const method = await getConnectionMethod();

  const rpc = new (method === "BROWSER" ? ExtensionRPC : WebSocketRPC)("1484242629762916352");

  rpc.connect();

  rpc.on("ready", () => {
    if (lastData?.paused) return;
    makeRequest(lastData, true);
  });
  

  let pauseTimeoutId = null

  const makeRequest = (data, force = false) => {
    if (!force && compareJSON(lastData, data)) return;

    if (data?.paused || !data) {
      pauseTimeoutId = setTimeout(() => {
        rpc.request(undefined);
      }, 2000)
      return 
    }
    clearTimeout(pauseTimeoutId);

    if (!data.duration) return;

    rpc.request({
      name: "YouTube",
      action: "Watching",
      imgSrc: data.thumbnailUrl,
      title: data.title,
      link: data.url,
      subtitle: data.channelName,
      startedAt: Date.now() - secondsToMilliseconds(data.currentTime),
      endsAt:
        Date.now() -
        secondsToMilliseconds(data.currentTime) +
        secondsToMilliseconds(data.duration),
    });


  }



  window.addEventListener("SendToLoader", function (message) {
    makeRequest(message.detail);
    lastData = message.detail;  
  })
}
main();

const compareJSON = (a, b) => {
  return JSON.stringify(a) === JSON.stringify(b);
}