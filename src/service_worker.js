let nerimityClients = [];
let rpcClients = [];



const sendReadyToAll = () => {
  rpcClients.forEach(c => c.postMessage({name: "connected"}));
};


setInterval(() => {
  for (let i = 0; i < nerimityClients.length; i++) {
    const clientPort = nerimityClients[i];
    clientPort.postMessage({name: "ping"});
  }
  for (let i = 0; i < rpcClients.length; i++) {
    const clientPort = rpcClients[i];
    clientPort.postMessage({name: "ping"});
  }
}, 10_000);

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name === "nerimity_client") {
    nerimityClients.push(port);

    if (nerimityClients.length === 1) {
      sendReadyToAll();
    }


    port.onDisconnect.addListener(function () {
      const index = nerimityClients.indexOf(port);
      if (index === 0) {
        sendReadyToAll();
      }
      nerimityClients = nerimityClients.filter(c => c !== port);
    });


    return;
  }


  if (port.name === "rpc_client") {
    rpcClients.push(port);

    if (rpcClients.length === 1) {
      sendReadyToAll();
    }

    port.onMessage.addListener(function (msg) {
      nerimityClients[0]?.postMessage({...msg, id: port.sender.tab.id});
    });

    port.onDisconnect.addListener(function () {
      rpcClients = rpcClients.filter(c => c !== port);
      nerimityClients[0]?.postMessage({name: "UPDATE_RPC", id: port.sender.tab.id});
    });
  }
});


let popupWindowId = null; 

chrome.windows.onCreated.addListener((window) => {
  if (window.type === 'popup') {
    popupWindowId = window.id;
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    popupWindowId = null;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "popup-to-content") {
    const tabId = request.tabId;
    chrome.tabs.sendMessage(tabId, {
      action: "from-popup",
      data: request.data
    }).catch(console.log);
  }
  if (request.action === "content-to-popup") {
    chrome.runtime.sendMessage( {
      action: "from-content",
      data: request.data
    }).catch(console.log);
  }
});

