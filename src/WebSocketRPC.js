const PORT_RANGES = [6463, 6472];

export class WebSocketRPC {
  constructor(appId) {
    this.ws = null;
    this.greeted = false;
    this.greetedTimeoutId = null;
    this.appId = appId;

    this.queuedForReconnect = false;
    this.events = {};

    this.maxRetryCount = 2;
    this.retryCount = 0;
  }
  connect(port = PORT_RANGES[0]) {
    console.log("Connecting to port " + port);
    this.ws = new WebSocket(`ws://localhost:${port}?appId=${this.appId}`);

    this.ws.onopen = () => {
      console.log("Connected!");
      this.greetedTimeoutId = setTimeout(() => {
        try {
          this.ws.close();
        } catch {}
      }, 2000);
    };

    this.ws.onmessage = (event) => {
      const payload = safeParseJson(event.data);
      if (!payload) return this.tryNextPort(port);
      if (payload.name === "HELLO_NERIMITY_RPC") {
        this.retryCount = 0;
        clearTimeout(this.greetedTimeoutId);
        this.greeted = true;
        this.ws.send(JSON.stringify({ name: "HELLO_NERIMITY_RPC" }));
        console.log("Received HELLO_NERIMITY_RPC");
        this.emit("ready");
        return;
      }
      if (!this.greeted) return;
    };

    this.ws.onclose = (event) => {
      clearTimeout(this.greetedTimeoutId);
      this.tryNextPort(port);
    };
  }
  tryNextPort(currentPort) {
    if (this.queuedForReconnect) return;
    this.queuedForReconnect = true;
    setTimeout(() => {
      try {
        this.ws.close();
      } catch {}
      if (currentPort >= PORT_RANGES[1]) {
        if (this.retryCount >= this.maxRetryCount) {
          console.log("Failed all ports. Giving up.");
          return;
        }
        console.log("Failed all ports. Trying again in 10 seconds...");
        setTimeout(() => {
          this.retryCount++;
          this.queuedForReconnect = false;
          this.connect(PORT_RANGES[0]);
        }, 10000);
        return;
      }
      console.log("Failed, trying next port...");
      this.queuedForReconnect = false;
      this.connect(currentPort + 1);
    }, 500);
  }

  /**
   * @param {{
   *   name: string,
   *   action?: string,
   *   title?: string,
   *   subtitle?: string,
   *   imgSrc?: string,
   *   startedAt?: number,
   *   endsAt?: number
   *   speed?: number
   * } | undefined} opts - the options for the request
   */
  request(opts) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const clonedOpts = opts ? { ...opts } : undefined;
    if (clonedOpts?.title) {
      clonedOpts.title = overflowEllipsis(clonedOpts.title);
    }
    if (clonedOpts?.subtitle) {
      clonedOpts.subtitle = overflowEllipsis(clonedOpts.subtitle);
    }
    if (clonedOpts) {
      clonedOpts.updatedAt = Date.now();
    }
    this.ws.send(
      JSON.stringify({
        name: "UPDATE_RPC",
        data: clonedOpts,
      })
    );
  }

  on(event, callback) {
    this.events[event] = callback;
  }
  emit(event, data) {
    this.events?.[event]?.(data);
  }
}

const overflowEllipsis = (str, maxLength = 30) => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
};

const safeParseJson = (str) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
};

const extensionId = chrome.runtime.id;

const toastsContainerId = extensionId + "-toasts";

const getToastContainer = () => {
  const existingContainer = document.getElementById(toastsContainerId);
  if (existingContainer) return existingContainer;
  const newContainer = document.createElement("div");

  newContainer.id = toastsContainerId;
  newContainer.style.position = "fixed";

  newContainer.style.display = "flex";
  newContainer.style.flexDirection = "column";
  newContainer.style.gap = "6px";

  newContainer.style.top = "10px";
  newContainer.style.right = "10px";
  newContainer.style.color = "white";
  newContainer.style.zIndex = "11111111111111111111111";

  document.body.appendChild(newContainer);

  return newContainer;
};

const createToastElement = (text) => {
  const toastElement = document.createElement("div");
  toastElement.classList.add("toast");

  toastElement.style.display = "flex";
  toastElement.style.alignItems = "center";

  toastElement.style.background = "#3a3e43";
  toastElement.style.borderRadius = "6px";

  toastElement.style.paddingLeft = "16px";
  toastElement.style.height = "36px";
  toastElement.style.width = "200px";
  toastElement.style.fontSize = "14px";
  toastElement.style.boxShadow = "0 0 8px 4px rgba(0,0,0,0.4)";

  toastElement.innerHTML = `
    <div style="position: absolute; left: 0; width: 4px; border-radius: 99px; height: 16px; background: red;"></div>
    ${text}
  `;

  return toastElement;
};

const addToast = () => {
  const container = getToastContainer();
  const toastElement = createToastElement("Test!");

  container.appendChild(toastElement);
  // setTimeout(() => {
  //   container.removeChild(toastElement);
  // }, 3000);
};

// setTimeout(() => {
//   addToast()
//   addToast()
//   addToast()
// }, 100);
