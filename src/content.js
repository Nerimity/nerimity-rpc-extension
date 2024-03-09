
const hostnameToFunc = {
    "open.spotify.com": () => import('./spotify.js'),
    "www.youtube.com": () => import('./youtube.js'),
    
}



const main = async () => {
    const func = hostnameToFunc[location.hostname];
    if (func) {
        await func();
    }
}

main()




