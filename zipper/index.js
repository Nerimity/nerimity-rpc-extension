import archiver from "archiver";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
const __dirname = dirname(fileURLToPath(import.meta.url));

const rawFirefoxManifest = await fs.promises.readFile(__dirname + '/../src/manifestFirefox.json');
const firefoxManifest = JSON.parse(rawFirefoxManifest.toString('utf-8'));

const rawChromeManifest = await fs.promises.readFile(__dirname + '/../src/manifestChrome.json');
const chromeManifest = JSON.parse(rawChromeManifest.toString('utf-8'));

const version = chromeManifest.version;

await zip("Chrome")
await zip("Firefox")
console.log(`Zipped Chrome and Firefox builds to builds/${version}`)


/**
 * A description of the entire function.
 *
 * @param {"Firefox" | "Chrome"} type - description of parameter
 */
async function zip(type) {

    await fs.promises.mkdir(__dirname + `/../builds/${version}`, {recursive: true});

    const outPath = __dirname + `/../builds/${version}/${type.toLowerCase()}.zip`;

    if (fs.existsSync(outPath)){
        await fs.promises.unlink(outPath);
    }

    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip');
    archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
          console.error(err);
        } else {
          throw err;
        }
    });
    // good practice to catch this error explicitly
    archive.on('error', function(err) {
        throw err;
    });

    const manifest = type === "Chrome" ? rawChromeManifest : rawFirefoxManifest;

    archive.append(manifest, { name: 'manifest.json' });

    archive.glob('**', {cwd:__dirname + '/../src', ignore: ["manifestFirefox.json", "manifestChrome.json"]});
    archive.pipe(output);

    await archive.finalize()

}
