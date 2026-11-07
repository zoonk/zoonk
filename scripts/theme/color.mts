export type Rgba = { alpha: number; blue: number; green: number; red: number };

/** OKLab to LMS and LMS to linear sRGB (Björn Ottosson's matrices, as CSS Color 4 defines them). */
const OKLAB_TO_LMS = {
  long: { a: 0.3963377774, b: 0.2158037573 },
  medium: { a: -0.1055613458, b: -0.0638541728 },
  short: { a: -0.0894841775, b: -1.291485548 },
};

const LMS_TO_SRGB = {
  blue: { long: -0.0041960863, medium: -0.7034186147, short: 1.707614701 },
  green: { long: -1.2684380046, medium: 2.6097574011, short: -0.3413193965 },
  red: { long: 4.0767416621, medium: -3.3077115913, short: 0.2309699292 },
};

const SRGB = {
  exponent: 2.4,
  gammaLimit: 0.04045,
  linearLimit: 0.0031308,
  linearSlope: 12.92,
  offset: 0.055,
  scale: 1.055,
};

// Linear sRGB -> XYZ D65 -> linear P3: https://drafts.csswg.org/css-color-4/#color-conversion-code
const SRGB_TO_P3 = {
  blue: { blue: 0.9105199286149166, green: 0.07239744066396347, red: 0.017082630721120033 },
  green: { blue: 0, green: 0.9668058011490382, red: 0.03319419885096158 },
  red: { blue: 0, green: 0.17753803128563772, red: 0.8224619687143623 },
};

const DEGREES_PER_HALF_TURN = 180;
const CHANNEL_MAX = 255;
const HEX_RADIX = 16;
const HEX = /^#(?<hex>[\da-f]{3}|[\da-f]{6})$/iu;

function toGamma(linear: number): number {
  const magnitude = Math.abs(linear);

  return magnitude <= SRGB.linearLimit
    ? SRGB.linearSlope * linear
    : Math.sign(linear) * (SRGB.scale * magnitude ** (1 / SRGB.exponent) - SRGB.offset);
}

function toLinear(channel: number): number {
  const magnitude = Math.abs(channel);

  return magnitude <= SRGB.gammaLimit
    ? channel / SRGB.linearSlope
    : Math.sign(channel) * ((magnitude + SRGB.offset) / SRGB.scale) ** SRGB.exponent;
}

export function toDisplayP3(color: Rgba): Rgba {
  const red = toLinear(color.red);
  const green = toLinear(color.green);
  const blue = toLinear(color.blue);

  const channel = (weights: { blue: number; green: number; red: number }) =>
    toGamma(weights.red * red + weights.green * green + weights.blue * blue);

  return {
    alpha: color.alpha,
    blue: channel(SRGB_TO_P3.blue),
    green: channel(SRGB_TO_P3.green),
    red: channel(SRGB_TO_P3.red),
  };
}

/** Android clips to sRGB; Apple keeps extended channels until conversion to Display P3. */
export function oklchToRgb({
  chroma,
  clipToSrgb = true,
  hue,
  lightness,
}: {
  chroma: number;
  clipToSrgb?: boolean;
  hue: number;
  lightness: number;
}): Rgba {
  const angle = (hue * Math.PI) / DEGREES_PER_HALF_TURN;
  const a = chroma * Math.cos(angle);
  const b = chroma * Math.sin(angle);

  const cone = (weights: { a: number; b: number }) =>
    (lightness + weights.a * a + weights.b * b) ** 3;

  const long = cone(OKLAB_TO_LMS.long);
  const medium = cone(OKLAB_TO_LMS.medium);
  const short = cone(OKLAB_TO_LMS.short);

  const channel = (weights: { long: number; medium: number; short: number }) => {
    const linear = weights.long * long + weights.medium * medium + weights.short * short;
    return toGamma(clipToSrgb ? Math.min(1, Math.max(0, linear)) : linear);
  };

  return {
    alpha: 1,
    blue: channel(LMS_TO_SRGB.blue),
    green: channel(LMS_TO_SRGB.green),
    red: channel(LMS_TO_SRGB.red),
  };
}

/** Lays a see-through color over an opaque one, in gamma-encoded sRGB as browsers composite. */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const mix = (front: number, back: number) => front * top.alpha + back * (1 - top.alpha);

  return {
    alpha: 1,
    blue: mix(top.blue, bottom.blue),
    green: mix(top.green, bottom.green),
    red: mix(top.red, bottom.red),
  };
}

function hexChannel(value: number): string {
  return Math.round(value * CHANNEL_MAX)
    .toString(HEX_RADIX)
    .toUpperCase()
    .padStart(2, "0");
}

export function toArgbHex(color: Rgba): string {
  return `0xFF${hexChannel(color.red)}${hexChannel(color.green)}${hexChannel(color.blue)}`;
}

export function parseHex(value: string): Rgba | undefined {
  const hex = HEX.exec(value)?.groups?.hex;

  if (!hex) {
    return undefined;
  }

  const full = hex.length === 3 ? hex.replaceAll(/./gu, "$&$&") : hex;

  const [red = 0, green = 0, blue = 0] = (full.match(/../gu) ?? []).map(
    (pair) => Number.parseInt(pair, HEX_RADIX) / CHANNEL_MAX,
  );

  return { alpha: 1, blue, green, red };
}
