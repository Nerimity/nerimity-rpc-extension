
export class ExtensionRPC {
  constructor(appId) {
    this.port = null;
    this.greeted = false;
    this.greetedTimeoutId = null;
    this.appId = appId;

    this.events = {};


  }
  connect() {
    this.port = chrome.runtime.connect({name: "rpc_client"});

    this.port.onMessage.addListener(msg => {
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
   *   endsAt?: number
   * } | undefined} opts - the options for the request
   */
  request(opts) {
    this.port.postMessage({
      name: "UPDATE_RPC",
      data: opts,
    });
  }

  on(event, callback) {
    this.events[event] = callback;
}
  emit(event, data) {
      this.events?.[event]?.(data);
  }

}