import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import sharp from "sharp";

const NEAR_SOLID_CHANNEL_RANGE_MAX = 8;
const NEAR_SOLID_CHANNEL_STDEV_MAX = 2;
const RGB_CHANNEL_COUNT = 3;

type ImageStats = { channels: { max: number; min: number; stdev: number }[] };

function isNearSolidChannel({ max, min, stdev }: { max: number; min: number; stdev: number }) {
  return max - min <= NEAR_SOLID_CHANNEL_RANGE_MAX && stdev <= NEAR_SOLID_CHANNEL_STDEV_MAX;
}

function hasOnlyNearSolidPixels({ channels }: ImageStats) {
  const colorChannels = channels.slice(0, RGB_CHANNEL_COUNT);

  return colorChannels.every((channel) => isNearSolidChannel(channel));
}

export async function isNearSolidImage({ image }: { image: Buffer }): Promise<SafeReturn<boolean>> {
  const { data, error } = await safeAsync(() => sharp(image).stats());

  if (error) {
    logError("Error inspecting generated image quality:", error);
    return { data: null, error };
  }

  return { data: hasOnlyNearSolidPixels(data), error: null };
}
