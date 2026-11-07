import { join } from "node:path";
import sharp from "sharp";
import { type Sides, pairItems } from "./media.mts";

const BYTES_PER_PIXEL = 4;

type Box = { height: number; width: number; x: number; y: number };

/** In the shots' own pixels; `share` is the part of them that differ. */
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

/** Shots of different sizes compare from their top-left corner: what only one covers changed. */
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
      if (pixelAt(first, x, y) !== pixelAt(second, x, y)) {
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

type PairChange = { change: ShotChange; row: string };

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

      changes.push({ change, row });
    }
  }

  return changes;
}

function percent(share: number): string {
  const shown = (share * 100).toFixed(1);
  return shown === "0.0" ? "under 0.1%" : `${shown}%`;
}

export function describeChange({ change: { box, height, share, width }, row }: PairChange): string {
  return box
    ? `${row}: ${percent(share)} changed, x ${box.x}–${box.x + box.width}, y ${box.y}–${box.y + box.height} of ${width}×${height} px`
    : `${row}: nothing changed, left out of media.md`;
}
