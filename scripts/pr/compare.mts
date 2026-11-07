import { join } from "node:path";
import sharp from "sharp";
import { VIEWPORTS } from "../verify/viewports.mts";
import { type Sides, pairItems } from "./media.mts";

const BYTES_PER_PIXEL = 4;

type Box = { height: number; width: number; x: number; y: number };

/** In image pixels; `share` is the part of them that differ. */
type ShotChange = { box?: Box; height: number; share: number; width: number };

async function readPixels(image: Buffer | string) {
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, height: info.height, width: info.width };
}

type Pixels = Awaited<ReturnType<typeof readPixels>>;

function pixelAt(image: Pixels, x: number, y: number): number | undefined {
  return x < image.width && y < image.height
    ? image.data.readUInt32BE((y * image.width + x) * BYTES_PER_PIXEL)
    : undefined;
}

/** Shots of different sizes compare from their top-left corner; what only one covers counts as changed. */
export async function compareShots(
  before: Buffer | string,
  after: Buffer | string,
): Promise<ShotChange> {
  const [first, second] = await Promise.all([readPixels(before), readPixels(after)]);
  const width = Math.max(first.width, second.width);
  const height = Math.max(first.height, second.height);
  let changed = 0;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = pixelAt(first, x, y);

      if (color === undefined || color !== pixelAt(second, x, y)) {
        changed += 1;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  return {
    box:
      changed > 0
        ? { height: bottom - top + 1, width: right - left + 1, x: left, y: top }
        : undefined,
    height,
    share: changed / (width * height),
    width,
  };
}

type PairChange = { change: ShotChange; row: string; scale: number };

/** One pair at a time: a full-page shot decodes to tens of megabytes. */
export async function compareSides(out: string, sides: Sides): Promise<PairChange[]> {
  const changes: PairChange[] = [];

  for (const { after, before, row } of pairItems(sides, "shot")) {
    if (after && before) {
      // oxlint-disable-next-line no-await-in-loop -- See above.
      const change = await compareShots(
        join(out, "before", before.file),
        join(out, "after", after.file),
      );

      changes.push({ change, row, scale: VIEWPORTS[after.viewport].deviceScaleFactor ?? 1 });
    }
  }

  return changes;
}

function percent(share: number): string {
  const shown = (share * 100).toFixed(1);
  return shown === "0.0" ? "under 0.1%" : `${shown}%`;
}

/** In CSS pixels, the unit `shot`'s `clip` takes. */
export function describeChange({ change, row, scale }: PairChange): string {
  if (!change.box) {
    return `${row}: nothing changed, left out of media.md`;
  }

  const css = (pixels: number) => Math.round(pixels / scale);
  const { box } = change;

  return `${row}: ${percent(change.share)} changed, x ${css(box.x)}–${css(box.x + box.width)}, y ${css(box.y)}–${css(box.y + box.height)} of ${css(change.width)}×${css(change.height)}`;
}
