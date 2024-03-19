import { getConnectionMethod, getDisabledActivities, setConnectionMethod, updateDisabledActivity } from "./options.js";
const rpcItemsContainer = document.getElementById("rpc-items");
const rpcMethodItems = document.getElementById("rpc-method-items");
const noticeItemsContainer = document.getElementById("notice-items");

const isBrave = !!navigator.brave?.isBrave


rpcItemsContainer.addEventListener("click", (e) => {
  const rpcItem = e.target.closest(".rpc-item");
  if (!rpcItem) return;
  const rpcId = rpcItem.getAttribute("data-id");

  const checkbox = rpcItem.querySelector(".rpc-checkbox");

  checkbox.checked = !checkbox.checked;

  updateDisabledActivity(rpcId, checkbox.checked ? "enable" : "disable");

  showNotice("reload", "Changes will take effect after reloading the page.");


})

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


})


const addRPCItem = (id, title, img, description, checked = true) => {
  const html = `
  <div class="rpc-item" data-id="${id}">
    <img class="rpc-image" src="${img}" />
    <div class="rpc-details">
      <div class="rpc-title">${title}</div>
      <div class="rpc-description">${description}</div>

      </div>
      <input type="checkbox" class="rpc-checkbox" ${checked ? "checked" : ''} />
  </div>
  `

  rpcItemsContainer.innerHTML += html;
}

const addMethodItem = (title, id, description, checked = false) => {
  // <img class="rpc-image" src="${img}" />
  const html = `
  <div class="rpc-item" data-id="${id}">
    <div class="rpc-details">
      <div class="rpc-title">${title}</div>
      <div class="rpc-description">${description}</div>

      </div>
      <input type="radio" class="rpc-checkbox" ${checked ? "checked" : ''} />
  </div>
  `

  rpcMethodItems.innerHTML += html;
}









const showNotice = (id, message) => {
  const existingContainer = document.getElementById("notice-" + id);
  const noticeContainer = existingContainer || document.createElement("div");
  noticeContainer.id = "notice-" + id;

  noticeContainer.className = "rpc-notice";
  noticeContainer.innerText = message;

  if (!existingContainer) {
    noticeItemsContainer.appendChild(noticeContainer);
  }
};



const addRPCItems = async () => {
  const disabledActivities = await getDisabledActivities();
  
  addRPCItem("SPOTIFY", "Spotify", "spotify.svg","Share music details and progress on Nerimity!", !disabledActivities.includes("SPOTIFY"));
  addRPCItem("YOUTUBE", "YouTube", "youtube.svg","Share video details and progress on Nerimity!", !disabledActivities.includes("YOUTUBE"));
}


const addMethods = async () => {
  const method = await getConnectionMethod();
  addMethodItem("Browser RPC", "BROWSER", "Connect to an opened Nerimity tab in browser.", method === "BROWSER")
  addMethodItem("RPC Server", "RPC_SERVER", "Connect to the Nerimity Desktop app using RPC.", method === "RPC_SERVER")
}

addMethods();
addRPCItems();


if (isBrave) {
  showNotice("brave", "Brave Users: You must disable Brave Shields in order to use this extension!");
}