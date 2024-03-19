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
