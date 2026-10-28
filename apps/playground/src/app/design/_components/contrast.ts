type Rgba = { alpha: number; blue: number; green: number; red: number };

const CHANNEL_MAX = 255;
const LINEAR_THRESHOLD = 0.04045;
const LINEAR_SCALE = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_SCALE = 1.055;
const GAMMA = 2.4;
const RED_WEIGHT = 0.2126;
const GREEN_WEIGHT = 0.7152;
const BLUE_WEIGHT = 0.0722;
const FLARE = 0.05;

let context: CanvasRenderingContext2D | null = null;

/** The browser converts any computed color by painting one pixel, so nothing here parses color syntax. */
function toRgba(color: string): Rgba {
  context ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });

  if (!context) {
    return { alpha: 1, blue: 0, green: 0, red: 0 };
  }

  context.clearRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(0, 0, 1, 1).data;

  return { alpha: alpha / CHANNEL_MAX, blue, green, red };
}

function linear(channel: number): number {
  const value = channel / CHANNEL_MAX;

  return value <= LINEAR_THRESHOLD
    ? value / LINEAR_SCALE
    : ((value + GAMMA_OFFSET) / GAMMA_SCALE) ** GAMMA;
}

function luminance({ blue, green, red }: Rgba): number {
  return RED_WEIGHT * linear(red) + GREEN_WEIGHT * linear(green) + BLUE_WEIGHT * linear(blue);
}

function over(color: Rgba, surface: Rgba): Rgba {
  const mix = (top: number, bottom: number) => top * color.alpha + bottom * (1 - color.alpha);

  return {
    alpha: 1,
    blue: mix(color.blue, surface.blue),
    green: mix(color.green, surface.green),
    red: mix(color.red, surface.red),
  };
}

/** WCAG 2's contrast ratio, with see-through colors laid over their surface and the page first. */
export function contrastRatio({
  color,
  page,
  surface,
}: {
  color: string;
  page: string;
  surface: string;
}): number {
  const base = over(toRgba(surface), toRgba(page));
  const lighter = luminance(over(toRgba(color), base));
  const darker = luminance(base);

  return (Math.max(lighter, darker) + FLARE) / (Math.min(lighter, darker) + FLARE);
}
