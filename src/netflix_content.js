const main = async () => {
    const { WebSocketRPC } = await import(chrome.runtime.getURL("./WebSocketRPC.js"));
    const { ExtensionRPC } = await import(chrome.runtime.getURL("./ExtensionRPC.js"));
    const { getConnectionMethod, getDisabledActivities, ACTIVITY } = await import(chrome.runtime.getURL("./options.js"));
    const { sleep, throttleFunction } = await import(chrome.runtime.getURL("./utils.js"));

    const disabledActivities = await getDisabledActivities();
    if (disabledActivities.includes(ACTIVITY.NETFLIX)) return;

    // ── extraction logic (inspired by Discord-Netflix) ────────────────────────

    const getMetadata = () => {
        // Netflix UI elements only exist when controls are visible (mouse move)
        const titleContainer = document.querySelector('[data-uia="video-title"]');
        const playerDiv = document.querySelector('[data-uia="player"]');
        const video = document.querySelector('video');

        if (!video || location.pathname.indexOf('/watch/') === -1) return null;

        const videoId = playerDiv?.dataset?.videoid || location.pathname.split('/').pop();
        
        // Series Title (h4) or Movie Title (textContent)
        const mainTitle = titleContainer?.querySelector('h4')?.textContent || titleContainer?.textContent;
        
        // If we don't have a title yet, don't send anything to avoid "Netflix Video"
        if (!mainTitle) return null;
        
        // Episode info (S1:E1 etc)
        const secondaryInfo = Array.from(titleContainer?.querySelectorAll('span') || [])
            .map(s => s.textContent)
            .join(' ') || "";

        // Use a public official Netflix logo URL for reliable display
        const posterUrl = "https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.png";

        return {
            title: mainTitle,
            subtitle: secondaryInfo,
            videoId,
            posterUrl,
            isPlaying: !video.paused,
            currentTime: video.currentTime,
            duration: video.duration
        };
    };

    // ── RPC setup ─────────────────────────────────────────────────────────────

    const method = await getConnectionMethod();
    const rpc = new (method === "BROWSER" ? ExtensionRPC : WebSocketRPC)("1484242629762916352");

    let lastKey = null;

    const makeRequest = () => {
        const data = getMetadata();
        
        if (!data || !data.isPlaying) {
            if (lastKey !== null) {
                rpc.request(undefined);
                lastKey = null;
            }
            return;
        }

        const key = `${data.videoId}|${data.title}|${data.subtitle}`;
        if (key === lastKey) return;
        lastKey = key;

        rpc.request({
            name: "Netflix",
            action: "Watching",
            imgSrc: data.posterUrl,
            title: data.title,
            link: location.href,
            subtitle: data.subtitle,
            startedAt: Date.now() - (data.currentTime * 1000),
            endsAt: Date.now() + ((data.duration - data.currentTime) * 1000)
        });
    };

    rpc.connect();
    rpc.on("ready", () => makeRequest());

    // Netflix is an SPA, we need to poll and observe
    setInterval(makeRequest, 3000);

    // Watch for UI changes (controls appearing/disappearing)
    new MutationObserver(throttleFunction(makeRequest, 500))
        .observe(document.body, { childList: true, subtree: true });
};

main();
