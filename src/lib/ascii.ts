/** Renders the background-free portrait as ASCII: the silhouette is exact, the face is not. */

const RAMP = ' .:-=+*#%@';

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function asciiPortrait(src: string, cols: number): Promise<string[]> {
  const img = await loadImage(src);
  // Terminal cells are roughly twice as tall as they are wide.
  const rows = Math.round(cols * (img.naturalHeight / img.naturalWidth) * 0.5);
  const cv = document.createElement('canvas');
  cv.width = cols;
  cv.height = rows;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.imageSmoothingQuality = 'high';
  c.drawImage(img, 0, 0, cols, rows);
  const d = c.getImageData(0, 0, cols, rows).data;

  const out: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) {
      const o = (y * cols + x) * 4;
      const a = d[o + 3] / 255;
      if (a < 0.35) {
        line += ' ';
        continue;
      }
      const lum = (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255;
      // Dark clothes become dense glyphs so the whole silhouette reads; skin stays light.
      const density = 0.3 + 0.7 * (1 - lum);
      line += RAMP[Math.min(RAMP.length - 1, Math.max(1, Math.round(density * (RAMP.length - 1))))];
    }
    out.push(line.replace(/\s+$/, ''));
  }
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
}
