const hasFocus = document.hasFocus();
const main = async () => {
  const {sleep} = await import("./utils.js");

  document.addEventListener("yt-player-updated", async (event) => {

    const details = await getPlayerDetails();
    if (!details) return;
    
    const video = document.querySelector("video");


    video.onplaying = () => {
      sendData(video, details, "play")
    }
    video.onpause = () => {
      sendData(video, details, "paused")
    }
    if (hasFocus) {
      sendData(video, details, "play")
    }

  })

  const sendData = (videoEl, details, name) => {
    const messageEvent = new CustomEvent("SendToLoader", { 
      detail: {
      currentTime: Math.round(videoEl.currentTime),
      duration: Math.round(videoEl.duration),
      name,
      ...details, 
      paused: videoEl.paused
    }
  });
    window.dispatchEvent(messageEvent);
  }
  

  let isRunning = false
  
  const getPlayerDetails = async () => {
    if (isRunning) return;
    isRunning = true;
    const videoUrl = document.getElementById("movie_player")?.getVideoUrl?.();
    if (!videoUrl) {
      console.log("video not found, trying again")
      await sleep(1000);
      return getPlayerDetails();
    }
    const videoId = videoUrl.split("v=")[1]
    isRunning = false;

    const ogDetails = await getOEmbedJSON(videoId)


    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
  
  
    return {
      channelName: ogDetails.authorName,
      title: ogDetails.title,
      thumbnailUrl,
      url: "https://www.youtube.com/watch?v=" + videoId
    }

  }
  
}



const cache = {};
const cachedKeys = [];
const addToCache = (key, value) => {
  // limit cache size to 10 elements
  if (cachedKeys.length >= 10) {
    const keyToRemove = cachedKeys.shift();
    delete cache[keyToRemove];
  }

  cache[key] = value;
  cachedKeys.push(key);
}
const getOEmbedJSON = async videoId => {
  if (cache[videoId]) {
    return cache[videoId];
  }
  const response = await fetch("https://www.youtube.com/oembed?url=http%3A//youtube.com/watch%3Fv%3D" + videoId + "&format=json");
  if (!response.ok) {
      return null;
  }
  const data = await response.json();


  const res = {
    title: data.title,
    authorName: data.author_name,
    authorUrl: data.author_url,
  }

  addToCache(videoId, res)

  return res;
}

main();