// Exports the local wardrobe (data/library.json + data/imported/*) into
// public/site-data so it can be published as a read-only static gallery
// (e.g. GitHub Pages). Run it at home after importing, commit the result.
//
//   npm run export:static                 garment cutouts only (default)
//   npm run export:static -- --with-modeled   also include modeled photos
//
// Modeled photos are generated from your reference photo, so they show you.
// They are left out unless you opt in.

import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const THUMB_WIDTH = 480;
const FULL_WIDTH = 1280;

const root = process.cwd();
const withModeled = process.argv.includes("--with-modeled");
const dataDir = path.resolve(root, process.env.WARDROBE_DATA_DIR || "data");
const sourceDir = path.join(dataDir, "imported");
const outDir = path.resolve(root, "public/site-data");
const libraryOut = path.join(outDir, "library");

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.warn("sharp is not installed: copying the original PNGs without resizing.");
}

async function readLibrary() {
  try {
    const records = JSON.parse(await readFile(path.join(dataDir, "library.json"), "utf8"));
    if (!Array.isArray(records)) throw new Error("library.json is not an array");
    return records;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`No library found at ${path.join(dataDir, "library.json")}. Import some clothes first.`);
      process.exit(1);
    }
    throw error;
  }
}

async function exists(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

// Returns the output path relative to site-data/, e.g. "library/import-x.webp".
async function writeImage(sourceFile, baseName, width) {
  if (!sharp) {
    const name = `${baseName}.png`;
    await copyFile(sourceFile, path.join(libraryOut, name));
    return `library/${name}`;
  }
  const name = `${baseName}.webp`;
  await sharp(sourceFile)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(path.join(libraryOut, name));
  return `library/${name}`;
}

const records = await readLibrary();
await rm(outDir, { recursive: true, force: true });
await mkdir(libraryOut, { recursive: true });

const exported = [];
let skipped = 0;
let modeledCount = 0;

for (const record of records) {
  const id = String(record.id || "");
  if (!/^[\w.-]+$/.test(id)) { skipped += 1; continue; }

  const garmentName = path.basename(String(record.image || ""));
  const garmentFile = path.join(sourceDir, garmentName);
  if (!garmentName || !(await exists(garmentFile))) {
    console.warn(`Skipping ${id}: garment image not found (${garmentName || "no image"}).`);
    skipped += 1;
    continue;
  }

  const image = await writeImage(garmentFile, id, FULL_WIDTH);
  const thumbnail = await writeImage(garmentFile, `${id}-thumb`, THUMB_WIDTH);

  let modeledImage = null;
  if (withModeled && record.modeledImage) {
    const modeledName = path.basename(String(record.modeledImage));
    const modeledFile = path.join(sourceDir, modeledName);
    if (await exists(modeledFile)) {
      modeledImage = await writeImage(modeledFile, `${id}-modeled`, FULL_WIDTH);
      modeledCount += 1;
    }
  }

  const { importJobId, ...rest } = record; // internal job reference, not needed on the site
  exported.push({ ...rest, image, thumbnail, modeledImage });
}

await writeFile(path.join(outDir, "wardrobe.json"), `${JSON.stringify(exported, null, 2)}\n`);

console.log(`Exported ${exported.length} piece(s) to ${path.relative(root, outDir)}${skipped ? ` (${skipped} skipped)` : ""}.`);
console.log(withModeled
  ? `Included ${modeledCount} modeled photo(s). They show your likeness and will be public.`
  : "Modeled photos were NOT included (use --with-modeled to include them).");
