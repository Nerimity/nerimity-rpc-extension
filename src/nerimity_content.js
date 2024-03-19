let port = null
let pingTimeout = null;
window.addEventListener('message', function(ev) {
    if (ev.data.name === "NERIMITY_READY") {
        port?.disconnect?.();
        clearInterval(pingTimeout);
        port = chrome.runtime.connect({name: "nerimity_client"});
        port.onMessage.addListener(function(msg) {
            window.postMessage(msg, "*");
        });
        port.postMessage(ev.data);
    }
}, true); 