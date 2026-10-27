// Theme loading. Sprite sheets (SVG or PNG) are rasterized once per scale
// into canvases so drawImage with source rects is fast and crisp.

export async function loadTheme(id = 'classic') {
  const base = `themes/${id}/`;
  const theme = await (await fetch(base + 'theme.json')).json();
  theme.base = base;
  return theme;
}

const images = new Map();
export function loadImage(url) {
  if (!images.has(url)) {
    images.set(url, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`image load failed: ${url}`));
      img.src = url;
    }));
  }
  return images.get(url);
}

const rasters = new Map();
export function rasterize(url, scale) {
  const key = `${url}@${scale}`;
  if (!rasters.has(key)) {
    rasters.set(key, loadImage(url).then(img => {
      const c = document.createElement('canvas');
      c.width = Math.ceil(img.naturalWidth * scale);
      c.height = Math.ceil(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return { canvas: c, scale };
    }));
  }
  return rasters.get(key);
}
