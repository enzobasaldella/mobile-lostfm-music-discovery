import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pngjs from 'pngjs';

// Extract the supplied white mark without redrawing it. Its luminance becomes
// alpha, preserving the original anti-aliased edges and removing the black box.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = pngjs.PNG.sync.read(readFileSync(join(root, 'assets', 'lostfm-mark.png')));
let left = source.width;
let top = source.height;
let right = 0;
let bottom = 0;

for (let y = 0; y < source.height; y++) {
  for (let x = 0; x < source.width; x++) {
    const index = (y * source.width + x) * 4;
    if (source.data[index] > 25) {
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
}

if (right <= left || bottom <= top) throw new Error('No white logo found in source image.');
const padding = 3;
left = Math.max(0, left - padding);
top = Math.max(0, top - padding);
right = Math.min(source.width - 1, right + padding);
bottom = Math.min(source.height - 1, bottom + padding);
const output = new pngjs.PNG({ width: right - left + 1, height: bottom - top + 1 });

for (let y = 0; y < output.height; y++) {
  for (let x = 0; x < output.width; x++) {
    const from = ((y + top) * source.width + (x + left)) * 4;
    const to = (y * output.width + x) * 4;
    const alpha = source.data[from] < 8 ? 0 : source.data[from];
    output.data[to] = 255;
    output.data[to + 1] = 255;
    output.data[to + 2] = 255;
    output.data[to + 3] = alpha;
  }
}

writeFileSync(join(root, 'assets', 'lostfm-mark-transparent.png'), pngjs.PNG.sync.write(output));
