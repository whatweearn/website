/**
 * Renders the raster icons from the SVG.
 *
 *   pnpm exec tsx scripts/generate-icons.ts
 *
 * A one-off: the outputs are committed because they never change unless the
 * mark does. Kept so regenerating is a command rather than an archaeology
 * exercise.
 *
 * The Apple icon is deliberately square. iOS applies its own rounded mask, so
 * shipping pre-rounded corners produces a double-rounded shape with
 * transparent gaps at the edges.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

const ROOT = process.cwd();
const svg = readFileSync(join(ROOT, "src/app/icon.svg"), "utf8");
const squared = svg.replace('rx="7"', 'rx="0"');

/** Minimal ICO container around PNG frames. Supported since Windows Vista. */
function ico(frames: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);

  let offset = 6 + frames.length * 16;
  const entries: Buffer[] = [];
  for (const { size, png } of frames) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0);
    e.writeUInt8(size === 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...frames.map((f) => f.png)]);
}

async function main() {
  const apple = await sharp(Buffer.from(squared)).resize(180, 180).png().toBuffer();
  writeFileSync(join(ROOT, "src/app/apple-icon.png"), apple);

  const frames = await Promise.all(
    [16, 32, 48].map(async (size) => ({
      size,
      png: await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer(),
    })),
  );
  writeFileSync(join(ROOT, "src/app/favicon.ico"), ico(frames));

  console.log("wrote src/app/apple-icon.png (180, square — iOS masks it itself)");
  console.log("wrote src/app/favicon.ico (16, 32, 48)");
}

main().catch((e: unknown) => {
  console.error((e as Error).message);
  process.exitCode = 1;
});
