import sharp from "sharp";

const LARGE_SIZE = 256;
const SMALL_SIZE = 96;
const MIN_SOURCE_SIZE = 256;
const MIN_DRAWN_SHARE = 0.03;
const MAX_DRAWN_SHARE = 0.97;
const BORDER_SHARE = 0.06;
const BORDER_BLUR_SHARE = 0.5;
const BORDER_ALPHA_THRESHOLD = 8;
const WEBP_QUALITY = 90;
const CHANNELS = 4;
const ALPHA = 3;
const COLOR_CHANNELS = [0, 1, 2] as const;
/** A light pixel a model drew as background instead of leaving it transparent. */
const BACKGROUND_LIGHTNESS = 235;
const TRANSPARENT = "rgba(0, 0, 0, 0)";
const WHITE = "#ffffff";

export class IconFileError extends Error {
  override name = "IconFileError";
}

type RawImage = { data: Buffer; height: number; width: number };

async function readRaw(image: Uint8Array): Promise<RawImage> {
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .catch((error: unknown) => {
      throw new IconFileError("The icon isn't an image we can read", { cause: error });
    });

  return { data, height: info.height, width: info.width };
}

function channelAt({ data }: RawImage, pixel: number, channel: number): number {
  return data[pixel * CHANNELS + channel] ?? 0;
}

function isLightAt(image: RawImage, pixel: number): boolean {
  return (
    channelAt(image, pixel, ALPHA) > 0 &&
    COLOR_CHANNELS.every((channel) => channelAt(image, pixel, channel) >= BACKGROUND_LIGHTNESS)
  );
}

function edgePixels({ height, width }: RawImage): number[] {
  const top = Array.from({ length: width }, (_, column) => column);
  const bottom = top.map((column) => (height - 1) * width + column);
  const left = Array.from({ length: height }, (_, row) => row * width);
  const right = left.map((pixel) => pixel + width - 1);
  return [...top, ...bottom, ...left, ...right];
}

function hasOpaqueCorners(image: RawImage): boolean {
  const { height, width } = image;
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  return corners.every((pixel) => channelAt(image, pixel, ALPHA) > 0);
}

function neighborsOf({ width }: RawImage, pixel: number): number[] {
  const column = pixel % width;

  return [
    column > 0 ? pixel - 1 : -1,
    column < width - 1 ? pixel + 1 : -1,
    pixel - width,
    pixel + width,
  ];
}

/** Clears the light background a model drew around the subject, from the edges inward. */
function clearDrawnBackground(image: RawImage): RawImage {
  const data = Buffer.from(image.data);
  const seen = new Uint8Array(image.width * image.height);
  const queue = edgePixels(image).filter((pixel) => isLightAt(image, pixel));

  for (const pixel of queue) {
    seen[pixel] = 1;
  }

  for (let pixel = queue.pop(); pixel !== undefined; pixel = queue.pop()) {
    data[pixel * CHANNELS + ALPHA] = 0;

    for (const next of neighborsOf(image, pixel)) {
      if (next >= 0 && next < seen.length && !seen[next] && isLightAt(image, next)) {
        seen[next] = 1;
        queue.push(next);
      }
    }
  }

  return { ...image, data };
}

function drawnShare(image: RawImage): number {
  const pixels = image.width * image.height;

  const drawn = Array.from({ length: pixels }).filter(
    (_, pixel) => channelAt(image, pixel, ALPHA) > 0,
  ).length;

  return drawn / pixels;
}

function toPng({ data, height, width }: RawImage): Promise<Buffer> {
  return sharp(data, { raw: { channels: CHANNELS, height, width } })
    .png()
    .toBuffer();
}

/** A white die-cut border around the drawing's own shape, so one file reads on light and dark. */
async function addStickerBorder(trimmed: Buffer): Promise<Buffer> {
  const pad = Math.round(LARGE_SIZE * BORDER_SHARE);
  const inner = LARGE_SIZE - pad * 2;

  const padded = await sharp(trimmed)
    .resize(inner, inner, { background: TRANSPARENT, fit: "contain" })
    .extend({ background: TRANSPARENT, bottom: pad, left: pad, right: pad, top: pad })
    .png()
    .toBuffer();

  // sharp runs a pipeline's threshold before its blur, so each runs on its own.
  const blurred = await sharp(padded)
    .extractChannel("alpha")
    .blur(pad * BORDER_BLUR_SHARE)
    .png()
    .toBuffer();

  const outline = await sharp(blurred).threshold(BORDER_ALPHA_THRESHOLD).png().toBuffer();

  const white = await sharp({
    create: { background: WHITE, channels: 3, height: LARGE_SIZE, width: LARGE_SIZE },
  })
    .joinChannel(outline)
    .png()
    .toBuffer();

  return sharp(white)
    .composite([{ input: padded }])
    .png()
    .toBuffer();
}

/**
 * Code's only check on a drawn icon: a readable square picture with a drawing on a transparent
 * background. A light background the model drew anyway is cleared; anything else throws.
 */
export async function toIconFiles(image: Uint8Array): Promise<{ large: Buffer; small: Buffer }> {
  const read = await readRaw(image);

  if (read.width < MIN_SOURCE_SIZE || read.height < MIN_SOURCE_SIZE) {
    throw new IconFileError(`The icon is too small (${read.width} by ${read.height})`);
  }

  const cleared = hasOpaqueCorners(read) ? clearDrawnBackground(read) : read;
  const share = drawnShare(cleared);

  if (share < MIN_DRAWN_SHARE || share > MAX_DRAWN_SHARE) {
    throw new IconFileError(
      `The icon has no drawing on a transparent background (${share.toFixed(2)} drawn)`,
    );
  }

  const trimmed = await sharp(await toPng(cleared))
    .trim({ threshold: 1 })
    .png()
    .toBuffer();

  const sticker = await addStickerBorder(trimmed);

  const [large, small] = await Promise.all([
    sharp(sticker).webp({ quality: WEBP_QUALITY }).toBuffer(),
    sharp(sticker).resize(SMALL_SIZE, SMALL_SIZE).webp({ quality: WEBP_QUALITY }).toBuffer(),
  ]);

  return { large, small };
}
