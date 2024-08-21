const main = async () => {
  const { sleep } = await import("./utils.js");

  const videoElement = () => document.querySelector("video");
  const moviePlayerElement = () => document.getElementById("movie_player");
  const isPlayerVisible = () =>
    !moviePlayerElement() ? false : isVisible(moviePlayerElement());

  const isAdShowing = () =>
    document.getElementsByClassName("ad-showing").length;

  let lastVisibleState = false;

  setInterval(() => {
    const isVisible = isAdShowing() ? false : isPlayerVisible();
    if (lastVisibleState === isVisible) return;
    lastVisibleState = isVisible;
    if (isVisible) return handleRPC();
    dispatchEvent({ paused: true });
  }, 1000);

  const handleRPC = async () => {
    const videoEl = videoElement();
    if (!videoEl) return;

    const makeEvent = async () => {
      const details = await getPlayerDetails();
      return {
        speed: videoEl.playbackRate,
        currentTime: Math.round(videoEl.currentTime),
        duration: Math.round(videoEl.duration),
        ...details,
        paused: videoEl.paused,
      };
    };

    videoEl.onpause = () => {
      dispatchEvent({ paused: true });
    };

    videoEl.onplaying = async () => {
      dispatchEvent(await makeEvent());
    };
    videoEl.onratechange = async () => {
      dispatchEvent(await makeEvent());
    };

    dispatchEvent(await makeEvent());
  };

  const getPlayerDetails = async () => {
    const videoUrl = document.getElementById("movie_player")?.getVideoUrl?.();
    if (!videoUrl) {
      await sleep(1000);
      return getPlayerDetails();
    }
    const videoId = videoUrl.split("v=")[1];

    const ogDetails = await getOEmbedJSON(videoId);

    if (!ogDetails) {
      return;
    }

    if (!lastVisibleState) {
      return;
    }

    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

    const isYTMusic = location.href.startsWith("https://music.youtube.com");

    const res = {
      channelName: ogDetails.authorName,
      title: ogDetails.title,
      thumbnailUrl,
      url: `https://${isYTMusic ? "music." : ""}youtube.com/watch?v=` + videoId,
    };

    return res;
  };
};

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
};
const getOEmbedJSON = async (videoId) => {
  if (cache[videoId]) {
    return cache[videoId];
  }
  const response = await fetch(
    "https://www.youtube.com/oembed?url=http%3A//youtube.com/watch%3Fv%3D" +
      videoId +
      "&format=json"
  );
  if (!response.ok) {
    return null;
  }
  const data = await response.json();

  const res = {
    title: data.title,
    authorName: data.author_name,
    authorUrl: data.author_url,
  };

  addToCache(videoId, res);

  return res;
};

const dispatchEvent = (detail) => {
  const messageEvent = new CustomEvent("SendToLoader", { detail });
  window.dispatchEvent(messageEvent);
};

function isVisible(element) {
  return element && element.offsetWidth > 0 && element.offsetHeight > 0;
}

main();
