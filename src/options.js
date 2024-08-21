export const CONNECTION_METHOD = {
  BROWSER: "BROWSER",
  RPC_SERVER: "RPC_SERVER",
};

export const ACTIVITY = {
  SPOTIFY: "SPOTIFY",
  YOUTUBE: "YOUTUBE",
  ATOMICRADIO: "ATOMICRADIO",
};

/**
 * Retrieves the connection method from the local chrome storage.
 *
 * @return {Promise<keyof typeof CONNECTION_METHOD>} A promise that resolves to an object containing the connection method.
 */
export const getConnectionMethod = async () => {
  const res = await chrome.storage.local.get("METHOD");
  return res.METHOD || CONNECTION_METHOD.BROWSER;
};

export const getDisabledActivities = async () => {
  const res = await chrome.storage.local.get("DISABLED_ACTIVITIES");
  return res.DISABLED_ACTIVITIES || [];
};

export const setConnectionMethod = async (method) => {
  await chrome.storage.local.set({ METHOD: method });
};

export const updateDisabledActivity = async (activity, action = "disable") => {
  const activities = await getDisabledActivities();

  if (action === "disable") {
    activities.push(activity);
  } else {
    activities.splice(activities.indexOf(activity), 1);
  }

  await chrome.storage.local.set({
    DISABLED_ACTIVITIES: [...new Set(activities)],
  });
};

/**
 * @return {Promise<string[]>}
 */
export const getYouTubeChannelWhitelist = async () => {
  const res = await chrome.storage.local.get("YOUTUBE_CHANNEL_WHITELIST");

  return res.YOUTUBE_CHANNEL_WHITELIST || [];
};
export const addYouTubeChannelToWhitelist = async (channelName) => {
  const channels = await getYouTubeChannelWhitelist();
  const uniques = new Set([channelName, ...channels]);
  await chrome.storage.local.set({ YOUTUBE_CHANNEL_WHITELIST: [...uniques] });
};

export const removeYouTubeChannelFromWhitelist = async (channelName) => {
  const channels = await getYouTubeChannelWhitelist();
  const uniques = channels.filter((c) => c !== channelName);
  await chrome.storage.local.set({ YOUTUBE_CHANNEL_WHITELIST: [...uniques] });
};

export const isYouTubeChannelWhitelisted = async (channelName) => {
  const channels = await getYouTubeChannelWhitelist();
  if (!channels.length) return true;
  return channels.includes(channelName);
};
