const throttleFunction = (func, delay) => {
    let prev = 0;
    return (...args) => {
        let now = new Date().getTime();

        if (now - prev > delay) {
            prev = now;
            return func(...args);
        }
    }
}

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * @return {Promise<HTMLElement>} The now playing widget element
 */
const spotifyReady = async () => {
    const nowPlayingWidget = document.querySelector("[data-testid=now-playing-widget]");
    if (!nowPlayingWidget) {
        await sleep(1000);
        return spotifyReady();
    }
    return nowPlayingWidget;
}


class Spotify {
    constructor(widgetEl) {
        this.checkForChanges()
        const playButtonEl = document.querySelector("[data-testid=control-button-playpause]")

        const linkChangeObserver = new MutationObserver(throttleFunction(() => {
            this.checkForChanges()
        }, 10));
        
        linkChangeObserver.observe(widgetEl, {subtree: true, attributes: true, childList: true});
        linkChangeObserver.observe(playButtonEl, {subtree: true, attributes: true, childList: true});

        this.beforePlaying = null;

        // document.querySelector("[data-testid=playback-progressbar]").addEventListener("click", () => {
        //     console.log("yay")
        // })

        this.events = {};
    }
    async checkForChanges() {
        const before = !this.beforePlaying ? undefined : {...this.beforePlaying};
        this.beforePlaying = this.getPlayingTrack();

        if (before?.title + before?.artists !== this.beforePlaying?.title + this.beforePlaying?.artists) {
            if (!this.beforePlaying.isPlaying) return;
            this.emit("linkChanged", this.beforePlaying)
            return;
        }
        if (before?.isPlaying !== this.beforePlaying.isPlaying) {
            this.emit("isPlayingChanged", this.beforePlaying)
        }
    }
    getPlayingTrack() {
        const titleEl = document.querySelector("[data-testid=context-item-link")
        const artists = document.querySelector("[data-testid=context-item-info-subtitles]")
        const albumArt = document.querySelector("[data-testid=cover-art-image]")
        const position = document.querySelector("[data-testid=playback-position]");
        const duration = document.querySelector("[data-testid=playback-duration]");
        const state = document.querySelector("[data-testid=control-button-playpause]");

        const link = titleEl.getAttribute("href");
        const isPlaying = state.getAttribute("aria-label") === "Pause";   

        return {
            title: titleEl.textContent,
            art: albumArt.src,
            artists: artists.textContent,
            position: position.textContent,
            link,
            duration: duration.textContent,
            isPlaying
        }
    }

    on(event, callback) {
        this.events[event] = callback;
    }
    emit(event, data) {
        this.events?.[event]?.(data);
    }
}




const main = async () => {
    const {WebSocketRPC} = await import("./WebSocketRPC.js");
    const rpc = new WebSocketRPC("1477289858211946496");
    rpc.connect();

    const readyWidget = await spotifyReady()
    const spotify = new Spotify(readyWidget);

    spotify.on("linkChanged", (data) => {
        rpc.request({
            name: "Spotify",
            action: "Listening to",
            imgSrc: data.art,
            title: data.title,
        })
    })
    spotify.on("isPlayingChanged", (data) => {
        if (data.isPlaying) {
            rpc.request({
                name: "Spotify",
                action: "Listening to",
                imgSrc: data.art,
                title: data.title,
            }) 
        } else {
            rpc.request(undefined)
        }
    })

    
}
main();