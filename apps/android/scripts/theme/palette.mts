/**
 * Reads Zoonk's color tokens from `packages/ui/src/styles/globals.css` in its four modes and turns
 * them into opaque sRGB colors for the Android theme. See `generate-palette.mts`.
 */

/** An sRGB color, each channel from 0 to 1 and gamma-encoded, as browsers composite it. */
type Rgba = { alpha: number; blue: number; green: number; red: number };

type CssBlock = { children: CssBlock[]; declarations: Map<string, string>; prelude: string };

export type Mode = "dark" | "darkMoreContrast" | "light" | "lightMoreContrast";

/** The tokens the theme maps onto Material roles and `ZoonkColors`, in the palette's order. */
export const PALETTE_TOKENS = [
  "background",
  "foreground",
  "card",
  "popover",
  "primary",
  "primary-foreground",
  "muted",
  "muted-foreground",
  "surface-3",
  "border",
  "input",
  "selected-tint",
  "success",
  "success-text",
  "destructive",
  "destructive-text",
  "warning",
  "warning-text",
  "brain",
  "brain-text",
  "energy",
  "kind-review",
  "kind-mock",
  "kind-conversation",
  "kind-mind-map",
  "belt-white",
  "belt-yellow",
  "belt-orange",
  "belt-green",
  "belt-blue",
  "belt-purple",
  "belt-brown",
  "belt-red",
  "belt-gray",
  "belt-black",
] as const;

/**
 * Tints main draws with opacity on a token (`bg-success/9` under a right answer), kept as their
 * own colors so Material's container roles can hold them.
 */
export const TINTS = {
  "destructive-tint": { share: 0.09, token: "destructive" },
  "success-tint": { share: 0.09, token: "success" },
} as const;

const OKLCH =
  /^oklch\(\s*(?<lightness>[\d.]+%?)\s+(?<chroma>[\d.]+)\s+(?<hue>[\d.]+|none)\s*(?:\/\s*(?<alpha>[\d.]+%?))?\s*\)$/u;

const COLOR_MIX = /^color-mix\(in srgb,\s*(?<color>.+?)\s+(?<share>[\d.]+)%,\s*transparent\)$/u;
const VARIABLE = /^var\(--(?<name>[\w-]+)\)$/u;
const HEX = /^#(?<hex>[\da-f]{3}|[\da-f]{6})$/iu;

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

/** The sRGB transfer function. */
const SRGB = {
  exponent: 2.4,
  linearLimit: 0.0031308,
  linearSlope: 12.92,
  offset: 0.055,
  scale: 1.055,
};

const DEGREES_PER_HALF_TURN = 180;
const CHANNEL_MAX = 255;
const HEX_RADIX = 16;
const PERCENT = 100;

function parseNumber(text: string): number {
  return text.endsWith("%") ? Number(text.slice(0, -1)) / PERCENT : Number(text);
}

function toGamma(linear: number): number {
  const channel = Math.min(1, Math.max(0, linear));

  return channel <= SRGB.linearLimit
    ? SRGB.linearSlope * channel
    : SRGB.scale * channel ** (1 / SRGB.exponent) - SRGB.offset;
}

/**
 * OKLCH to sRGB, clipped per channel the way browsers draw an out-of-gamut color on an sRGB
 * screen.
 */
export function oklchToRgb({
  chroma,
  hue,
  lightness,
}: {
  chroma: number;
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

  const channel = (weights: { long: number; medium: number; short: number }) =>
    toGamma(weights.long * long + weights.medium * medium + weights.short * short);

  return {
    alpha: 1,
    blue: channel(LMS_TO_SRGB.blue),
    green: channel(LMS_TO_SRGB.green),
    red: channel(LMS_TO_SRGB.red),
  };
}

/** Lays a see-through color over an opaque one, in gamma-encoded sRGB as browsers composite. */
function over(top: Rgba, bottom: Rgba): Rgba {
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

/** `0xFFRRGGBB`, as Compose's `Color(Long)` takes it. */
export function toArgbHex(color: Rgba): string {
  return `0xFF${hexChannel(color.red)}${hexChannel(color.green)}${hexChannel(color.blue)}`;
}

function stripComments(css: string): string {
  return css.replaceAll(/\/\*[\s\S]*?\*\//gu, "");
}

/**
 * Splits a stylesheet into nested blocks and their `--custom-property` declarations. Enough CSS for
 * `globals.css`: blocks, declarations, at-rule statements and quoted strings.
 */
function parseCss(css: string): CssBlock {
  const text = stripComments(css);
  const root: CssBlock = { children: [], declarations: new Map(), prelude: "" };
  const stack = [root];
  let buffer = "";
  let quote: string | null = null;

  for (const character of text) {
    const current = stack.at(-1) ?? root;

    if (quote) {
      buffer += character;
      quote = character === quote ? null : quote;
    } else if (character === '"' || character === "'") {
      buffer += character;
      quote = character;
    } else if (character === "{") {
      const block: CssBlock = { children: [], declarations: new Map(), prelude: buffer.trim() };
      current.children.push(block);
      stack.push(block);
      buffer = "";
    } else if (character === ";" || character === "}") {
      const declaration = /^(?<name>--[\w-]+)\s*:\s*(?<value>[\s\S]+)$/u.exec(buffer.trim());

      if (declaration?.groups?.name && declaration.groups.value) {
        current.declarations.set(declaration.groups.name.slice(2), declaration.groups.value.trim());
      }

      if (character === "}") {
        stack.pop();
      }

      buffer = "";
    } else {
      buffer += character;
    }
  }

  return root;
}

/** The declarations of the block reached through `preludes`, one nesting level per prelude. */
function tokensAt(root: CssBlock, preludes: string[]): Map<string, string> {
  const search = (blocks: CssBlock[], path: string[]): Map<string, string> | undefined => {
    const [head, ...rest] = path;

    for (const block of blocks.filter((candidate) => candidate.prelude === head)) {
      const found = rest.length === 0 ? block.declarations : search(block.children, rest);

      if (found && found.size > 0) {
        return found;
      }
    }

    return undefined;
  };

  const tokens = search(root.children, preludes);

  if (!tokens) {
    throw new Error(`globals.css has no tokens under ${preludes.join(" > ")}`);
  }

  return tokens;
}

/**
 * Each mode's tokens as the browser cascades them: light is `:root`, the more-contrast and dark
 * blocks override it, and dark with more contrast overrides dark.
 */
export function readModes(globalsCss: string): Record<Mode, Map<string, string>> {
  const root = parseCss(globalsCss);
  const light = tokensAt(root, [":root"]);
  const dark = new Map([...light, ...tokensAt(root, [":root", "@variant dark"])]);

  return {
    dark,
    darkMoreContrast: new Map([
      ...dark,
      ...tokensAt(root, [":root", "@variant dark", "@media (prefers-contrast: more)"]),
    ]),
    light,
    lightMoreContrast: new Map([
      ...light,
      ...tokensAt(root, [
        "@media (prefers-color-scheme: light) and (prefers-contrast: more)",
        ":root",
      ]),
    ]),
  };
}

/** Tailwind's palette (`--color-blue-800`), which `globals.css` refers to with `var(--color-*)`. */
export function readTailwindPalette(themeCss: string): Map<string, string> {
  const palette = new Map<string, string>();

  for (const block of parseCss(themeCss).children) {
    for (const [name, value] of block.declarations) {
      if (name.startsWith("color-")) {
        palette.set(name, value);
      }
    }
  }

  return palette;
}

type Lookup = { palette: Map<string, string>; tokens: Map<string, string> };

/** A variable's value: a mode's token, or Tailwind's palette color. */
function lookUp(variable: string, { palette, tokens }: Lookup): string {
  // `var(--color-primary)` is Tailwind's name for the `--primary` token.
  const value =
    tokens.get(variable) ?? tokens.get(variable.replace(/^color-/u, "")) ?? palette.get(variable);

  if (!value) {
    throw new Error(`Unknown variable --${variable}`);
  }

  return value;
}

function parseOklch(value: string): Rgba | undefined {
  const parts = OKLCH.exec(value)?.groups;

  if (!parts?.lightness || !parts.chroma || !parts.hue) {
    return undefined;
  }

  const color = oklchToRgb({
    chroma: parseNumber(parts.chroma),
    hue: parts.hue === "none" ? 0 : parseNumber(parts.hue),
    lightness: parseNumber(parts.lightness),
  });

  return { ...color, alpha: parts.alpha ? parseNumber(parts.alpha) : 1 };
}

function parseHex(value: string): Rgba | undefined {
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

/** A CSS color value as `globals.css` writes them, variables followed. */
function parseColor(value: string, lookup: Lookup): Rgba {
  const variable = VARIABLE.exec(value)?.groups?.name;

  if (variable) {
    return parseColor(lookUp(variable, lookup), lookup);
  }

  const mix = COLOR_MIX.exec(value)?.groups;

  if (mix?.color && mix.share) {
    return { ...parseColor(mix.color, lookup), alpha: Number(mix.share) / PERCENT };
  }

  if (value === "transparent") {
    return { alpha: 0, blue: 0, green: 0, red: 0 };
  }

  const color = parseOklch(value) ?? parseHex(value);

  if (!color) {
    throw new Error(`Unsupported color value ${value}`);
  }

  return color;
}

/** A mode's token as an opaque color: see-through colors are laid on the mode's background. */
export function resolveColor({ name, ...lookup }: Lookup & { name: string }): Rgba {
  const background = parseColor(lookUp("background", lookup), lookup);
  return over(parseColor(lookUp(name, lookup), lookup), background);
}

/** Every palette color of one mode, tints included, as `0xFFRRGGBB`. */
export function modePalette(lookup: Lookup): Map<string, string> {
  const background = resolveColor({ ...lookup, name: "background" });
  const colors = new Map<string, string>();

  for (const name of PALETTE_TOKENS) {
    colors.set(name, toArgbHex(resolveColor({ ...lookup, name })));
  }

  for (const [name, tint] of Object.entries(TINTS)) {
    const color = resolveColor({ ...lookup, name: tint.token });
    colors.set(name, toArgbHex(over({ ...color, alpha: tint.share }, background)));
  }

  return colors;
}
