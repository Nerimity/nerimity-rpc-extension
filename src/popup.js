import {
  getConnectionMethod,
  getDisabledActivities,
  setConnectionMethod,
  updateDisabledActivity,
  addYouTubeChannelToWhitelist,
  getYouTubeChannelWhitelist,
  removeYouTubeChannelFromWhitelist,
} from "./options.js";
const rpcItemsContainer = document.getElementById("rpc-items");
const rpcMethodItems = document.getElementById("rpc-method-items");
const noticeItemsContainer = document.getElementById("notice-items");

const isBrave = !!navigator.brave?.isBrave;

rpcItemsContainer.addEventListener("click", (e) => {
  const rpcItem = e.target.closest(".rpc-item");
  if (!rpcItem) return;
  const rpcId = rpcItem.getAttribute("data-id");

  const checkbox = rpcItem.querySelector(".rpc-checkbox");
  if (e.target.closest(".rpc-settings-icon")) {
    if (rpcId === "YOUTUBE") {
      toggleYouTubeSettingsVisibility(rpcItem);
    }
    return;
  }

  checkbox.checked = !checkbox.checked;

  updateDisabledActivity(rpcId, checkbox.checked ? "enable" : "disable");

  showNotice("reload", "Changes will take effect after reloading the page.");
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs && tabs.length > 0) {
    chrome.runtime
      .sendMessage({
        action: "popup-to-content",
        tabId: tabs[0].id,
        data: { action: "popup-opened" },
      })
      .catch(console.log);
  }
});

const sendYoutubeWhitelistUpdated = () => {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.runtime
        .sendMessage({
          action: "popup-to-content",
          tabId: tab.id,
          data: { action: "yt-whitelist-updated" },
        })
        .catch(console.log);
    });
  });
};

let ytChannelName = "";
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "content-to-popup") {
    if (request.data.action === "yt-channel-name") {
      ytChannelName = request.data.channelName;
    }
  }
});

async function toggleYouTubeSettingsVisibility() {
  const existingContainerEl = document.getElementById(
    "youtube-settings-container"
  );

  if (existingContainerEl) {
    existingContainerEl.remove();
    return;
  }
  const containerEl = document.createElement("div");

  containerEl.id = "youtube-settings-container";
  containerEl.classList.add("settings-container");
  containerEl.innerHTML = `
    <a href="#" class="back-button">Back</a>
    <div class="settings-title">Whitelist Channels</div>
    <div class="youtube-whitelist-input-container">
      <input type="text" placeholder="YouTube username" id="youtube-username" value="${ytChannelName}" />
      <button id="youtube-add-button">Add</button>
    </div>
    <div id="youtube-channel-list"></div>
  
  `;

  document.body.appendChild(containerEl);

  const listChannels = async () => {
    const listEl = document.getElementById("youtube-channel-list");
    listEl.innerHTML = "";
    const channels = await getYouTubeChannelWhitelist();

    let str = "";
    for (const channel of channels) {
      str += `<div id="youtube-channel-item">
        <div id="youtube-channel-name">${channel}</div>
        <img class="delete-button" src="delete.svg" />
      </div>`;
    }

    listEl.innerHTML = str;
  };
  listChannels();

  containerEl.onclick = async (e) => {
    if (e.target.closest(".back-button")) {
      toggleYouTubeSettingsVisibility();
      return;
    }
    if (e.target.closest("#youtube-add-button")) {
      const usernameInput = document.getElementById("youtube-username");
      usernameInput.focus();
      const username = usernameInput.value;
      usernameInput.value = "";
      if (!username) {
        return;
      }

      await addYouTubeChannelToWhitelist(username);
      listChannels();
      sendYoutubeWhitelistUpdated()
    }
    if (e.target.closest(".delete-button")) {
      const item = e.target.closest("#youtube-channel-item");
      const username = item.querySelector("#youtube-channel-name").textContent;

      await removeYouTubeChannelFromWhitelist(username);

      listChannels();
      sendYoutubeWhitelistUpdated();
    }
  };
}

rpcMethodItems.addEventListener("click", (e) => {
  const rpcItem = e.target.closest(".rpc-item");
  if (!rpcItem) return;
  const rpcId = rpcItem.getAttribute("data-id");

  const checkbox = rpcItem.querySelector(".rpc-checkbox");

  const isChecked = checkbox.checked;
  if (isChecked) return;

  const radioBoxes = rpcMethodItems.querySelectorAll(".rpc-checkbox");

  for (const item of radioBoxes) {
    item.checked = false;
  }

  checkbox.checked = !checkbox.checked;

  setConnectionMethod(rpcId);

  showNotice("reload", "Changes will take effect after reloading the page.");

  if (rpcId === "RPC_SERVER" && isBrave) {
    showNotice(
      "brave",
      `Brave Users: You must allow localhost access for this extension to work. <a href="https://github.com/Nerimity/nerimity-rpc-extension/blob/main/README.md#brave-browser-rpc-server">Click here to learn more.</a>`
    );
  } else {
    hideNotice("brave");
  }
});

const addRPCItem = (id, title, img, description, checked, settingsIcon) => {
  const html = `
  <div class="rpc-item" data-id="${id}">
    <img class="rpc-image" src="${img}" />
    <div class="rpc-details">
      <div class="rpc-title">${title}</div>
      <div class="rpc-description">${description}</div>
      </div>
      ${
        settingsIcon
          ? `<img class="rpc-settings-icon" src="settings.svg" />`
          : ``
      }
      <input type="checkbox" class="rpc-checkbox" ${checked ? "checked" : ""} />
  </div>
  `;

  rpcItemsContainer.innerHTML += html;
};

const addMethodItem = (title, id, description, checked = false) => {
  // <img class="rpc-image" src="${img}" />
  const html = `
  <div class="rpc-item" data-id="${id}">
    <div class="rpc-details">
      <div class="rpc-title">${title}</div>
      <div class="rpc-description">${description}</div>

      </div>
      <input type="radio" class="rpc-checkbox" ${checked ? "checked" : ""} />
  </div>
  `;

  rpcMethodItems.innerHTML += html;
};

const showNotice = (id, message) => {
  const existingContainer = document.getElementById("notice-" + id);
  const noticeContainer = existingContainer || document.createElement("div");
  noticeContainer.id = "notice-" + id;

  noticeContainer.className = "rpc-notice";
  noticeContainer.innerHTML = message;

  if (!existingContainer) {
    noticeItemsContainer.appendChild(noticeContainer);
  }
};

const hideNotice = (id) => {
  const existingContainer = document.getElementById("notice-" + id);
  if (existingContainer) {
    existingContainer.remove();
  }
};

const addRPCItems = async () => {
  const disabledActivities = await getDisabledActivities();

  addRPCItem(
    "SPOTIFY",
    "Spotify",
    "spotify.svg",
    "Share music details and progress on Nerimity!",
    !disabledActivities.includes("SPOTIFY")
  );
  addRPCItem(
    "YOUTUBE",
    "YouTube",
    "youtube.svg",
    "Share video details and progress on Nerimity!",
    !disabledActivities.includes("YOUTUBE"),
    true
  );
  addRPCItem(
    "ATOMICRADIO",
    "atomicradio",
    "atomicradio_logo.png",
    "Share which space and song you're hearing to on Nerimity!",
    !disabledActivities.includes("ATOMICRADIO")
  );
};

const addMethods = async () => {
  const method = await getConnectionMethod();

  if (isBrave && method === "RPC_SERVER") {
    showNotice(
      "brave",
      `Brave Users: You must allow localhost access for this extension to work. <a target="_blank" rel="noopener noreferrer" href="https://github.com/Nerimity/nerimity-rpc-extension/blob/main/README.md#brave-browser-rpc-server">Click here to learn more.</a>`
    );
  }

  addMethodItem(
    "Browser RPC",
    "BROWSER",
    "Connect to an opened Nerimity tab in browser.",
    method === "BROWSER"
  );
  addMethodItem(
    "RPC Server",
    "RPC_SERVER",
    "Connect to the Nerimity Desktop app using RPC.",
    method === "RPC_SERVER"
  );
};

addMethods();
addRPCItems();
