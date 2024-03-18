const rpcItemsContainer = document.getElementById("rpc-items");
const noticeItemsContainer = document.getElementById("notice-items");

const isBrave = !!navigator.brave?.isBrave

rpcItemsContainer.addEventListener("click", (e) => {
  const rpcItem = e.target.closest(".rpc-item");
  if (!rpcItem) return;
  const rpcTitle = rpcItem.getAttribute("data-title");

  const checkbox = rpcItem.querySelector(".rpc-checkbox");

  checkbox.checked = !checkbox.checked;

  showNotice("reload", "Changes will take effect after reloading the page.");


})


const addRPCItem = (title, img, description) => {
  const html = `
  <div class="rpc-item" data-title="${title}">
    <img class="rpc-image" src="${img}" />
    <div class="rpc-details">
      <div class="rpc-title">${title}</div>
      <div class="rpc-description">${description}</div>

      </div>
      <input type="checkbox" class="rpc-checkbox" checked />
  </div>
  `

  rpcItemsContainer.innerHTML += html;
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


addRPCItem("Spotify", "spotify.svg","Share music details and progress on Nerimity!");
addRPCItem("YouTube", "youtube.svg","Share video details and progress on Nerimity!");

if (isBrave) {
  showNotice("brave", "Brave Users: You must disable Brave Shields in order to use this extension!");
}