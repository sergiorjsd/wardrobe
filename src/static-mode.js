// "static" mode is the read-only build published to GitHub Pages
// (`npm run build:static`). There is no API and no image proxy there:
// the gallery reads site-data/wardrobe.json produced by `npm run export:static`.

export const STATIC_MODE = import.meta.env.MODE === "static";

export const WARDROBE_URL = STATIC_MODE
  ? `${import.meta.env.BASE_URL}site-data/wardrobe.json`
  : "/api/import/wardrobe";

// Paths in wardrobe.json are relative to site-data/ (e.g. "library/import-x.webp").
export function staticAsset(src) {
  if (!STATIC_MODE || typeof src !== "string" || !src.startsWith("library/")) return src;
  return `${import.meta.env.BASE_URL}site-data/${src}`;
}

export function resolveItemAssets(item) {
  if (!STATIC_MODE) return item;
  return {
    ...item,
    image: staticAsset(item.image),
    thumbnail: staticAsset(item.thumbnail),
    modeledImage: staticAsset(item.modeledImage),
  };
}
