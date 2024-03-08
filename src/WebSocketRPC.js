const PORT_RANGES = [6463, 6472];

export class WebSocketRPC {
  constructor(appId) {
    this.ws = null;
    this.greeted = false;
    this.greetedTimeoutId = null;
    this.appId = appId;

    this.queuedForReconnect = false;
    this.events = {};
  }
  connect(port = PORT_RANGES[0]) {
    console.log("Connecting to port " + port);
    this.ws = new WebSocket(`ws://localhost:${port}?appId=${this.appId}`);

    this.ws.onopen = () => {
      console.log("Connected!");
      this.greetedTimeoutId = setTimeout(() => {
        this.tryNextPort(port);
      }, 2000);
    };

    this.ws.onmessage = (event) => {
      const payload = safeParseJson(event.data);
      if (!payload) return this.tryNextPort(port);
      if (payload.name === "HELLO_NERIMITY_RPC") {
        clearTimeout(this.greetedTimeoutId);
        this.greeted = true;
        this.ws.send(JSON.stringify({ name: "HELLO_NERIMITY_RPC" }));
        console.log("Received HELLO_NERIMITY_RPC");
        this.emit("ready")
        return;
      }
      if (!this.greeted) return;
    };

    this.ws.onclose = (event) => {
      this.tryNextPort(port);
    }
    this.ws.onerror = () => {
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
        console.log("Failed all ports. Trying again in 2 seconds...");
        setTimeout(() => {
          this.queuedForReconnect = false;
          this.connect(PORT_RANGES[0]);
        }, 2000)
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
   * } | undefined} opts - the options for the request
   */
  request(opts) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(
      JSON.stringify({
        name: "UPDATE_RPC",
        data: opts,
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

const safeParseJson = (str) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
};