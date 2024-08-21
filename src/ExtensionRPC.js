export class ExtensionRPC {
  constructor(appId) {
    this.port = null;
    this.greeted = false;
    this.greetedTimeoutId = null;
    this.appId = appId;

    this.events = {};
  }
  connect() {
    this.port = chrome.runtime.connect({ name: "rpc_client" });

    this.port.onMessage.addListener((msg) => {
      if (msg.name === "connected") {
        this.emit("ready");
      }
    });
  }

  /**
   * @param {{
   *   name: string,
   *   action?: string,
   *   title?: string,
   *   subtitle?: string,
   *   imgSrc?: string,
   *   startedAt?: number,
   *   endsAt?: number,
   *   speed?: number
   * } | undefined} opts - the options for the request
   */
  request(opts) {
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

    this.port.postMessage({
      name: "UPDATE_RPC",
      data: clonedOpts,
    });
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
