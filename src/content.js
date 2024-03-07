document.onclick = async (e) => {
    console.log(await getPlayingTrack())
}


const getPlayingTrack = async () => {
    await sleep(2000)
    const titleEl = document.querySelector("[data-testid=context-item-link")
    const artists = document.querySelector("[data-testid=context-item-info-subtitles]")
    const albumArt = document.querySelector("[data-testid=cover-art-image]")

    const position = document.querySelector("[data-testid=playback-position]");
    const duration = document.querySelector("[data-testid=playback-duration]");

    const state = document.querySelector("[data-testid=control-button-playpause]");
    const isPlaying = state.getAttribute("aria-label") === "Pause";



    
    return {
        title: titleEl.textContent,
        art: albumArt.src,
        artists: artists.textContent,
        position: position.textContent,
        duration: duration.textContent,
        isPlaying
    }
}

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}