import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import sharp from "sharp";

const NEAR_SOLID_CHANNEL_RANGE_MAX = 8;
const NEAR_SOLID_CHANNEL_STDEV_MAX = 2;
const RGB_CHANNEL_COUNT = 3;

type ImageStats = { channels: { max: number; min: number; stdev: number }[] };

/**
 * Detects whether one color channel has almost no variation across the image.
 * A real illustration can be minimal, but it should still have enough decoded
 * pixel variation to avoid looking like a blank full-frame color fill.
 */
function isNearSolidChannel({ max, min, stdev }: { max: number; min: number; stdev: number }) {
  return max - min <= NEAR_SOLID_CHANNEL_RANGE_MAX && stdev <= NEAR_SOLID_CHANNEL_STDEV_MAX;
}

/**
 * Checks whether every visible color channel is effectively uniform so generated
 * images that decode to a blank frame can be retried before we store them.
 * The generation prompt asks for a clean white educational illustration, so a
 * full-frame near-solid result is not a valid creative choice for these assets.
 */
function hasOnlyNearSolidPixels({ channels }: ImageStats) {
  const colorChannels = channels.slice(0, RGB_CHANNEL_COUNT);

  return colorChannels.every((channel) => isNearSolidChannel(channel));
}

/**
 * Reads decoded pixel statistics instead of trusting file size or metadata,
 * because the failing asset was a valid WebP container whose real problem was
 * that every decoded pixel was the same color.
 */
export async function isNearSolidImage({ image }: { image: Buffer }): Promise<SafeReturn<boolean>> {
  const { data, error } = await safeAsync(() => sharp(image).stats());

  if (error) {
    logError("Error inspecting generated image quality:", error);
    return { data: null, error };
  }

  return { data: hasOnlyNearSolidPixels(data), error: null };
}
