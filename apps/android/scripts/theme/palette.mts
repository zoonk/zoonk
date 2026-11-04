import { type Rgba, oklchToRgb, over, parseHex } from "./color.mts";

export type CssBlock = { children: CssBlock[]; declarations: Map<string, string>; prelude: string };

export type Mode = "dark" | "darkMoreContrast" | "light" | "lightMoreContrast";

export const PALETTE_TOKENS = [
  "background",
  "foreground",
  "card",
  "popover",
  "primary",
  "primary-foreground",
  "muted",
  "muted-foreground",
  "faint",
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
  "viz-accent",
  "viz-secondary",
  "viz-highlight",
  "viz-grid",
] as const;

/** Main draws these with opacity (`bg-success/9`); Material's container roles need a color. */
export const TINTS = {
  "destructive-tint": { share: 0.09, token: "destructive" },
  "success-tint": { share: 0.09, token: "success" },
} as const;

const OKLCH =
  /^oklch\(\s*(?<lightness>[\d.]+%?)\s+(?<chroma>[\d.]+)\s+(?<hue>[\d.]+|none)\s*(?:\/\s*(?<alpha>[\d.]+%?))?\s*\)$/u;

const COLOR_MIX = /^color-mix\(in srgb,\s*(?<color>.+?)\s+(?<share>[\d.]+)%,\s*transparent\)$/u;
const VARIABLE = /^var\(--(?<name>[\w-]+)\)$/u;

const PERCENT = 100;

function parseNumber(text: string): number {
  return text.endsWith("%") ? Number(text.slice(0, -1)) / PERCENT : Number(text);
}

function stripComments(css: string): string {
  return css.replaceAll(/\/\*[\s\S]*?\*\//gu, "");
}

/** Only as much CSS as `globals.css` uses: blocks, custom properties, statements and strings. */
export function parseCss(css: string): CssBlock {
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

export function tokensAt(root: CssBlock, preludes: string[]): Map<string, string> {
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

/** As the browser cascades them: dark with more contrast overrides dark, which overrides light. */
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

export type Lookup = {
  clipToSrgb?: boolean;
  palette: Map<string, string>;
  tokens: Map<string, string>;
};

function lookUp(variable: string, { palette, tokens }: Lookup): string {
  // `var(--color-primary)` is Tailwind's name for the `--primary` token.
  const value =
    tokens.get(variable) ?? tokens.get(variable.replace(/^color-/u, "")) ?? palette.get(variable);

  if (!value) {
    throw new Error(`Unknown variable --${variable}`);
  }

  return value;
}

function parseOklch(value: string, clipToSrgb: boolean | undefined): Rgba | undefined {
  const parts = OKLCH.exec(value)?.groups;

  if (!parts?.lightness || !parts.chroma || !parts.hue) {
    return undefined;
  }

  const color = oklchToRgb({
    chroma: parseNumber(parts.chroma),
    clipToSrgb,
    hue: parts.hue === "none" ? 0 : parseNumber(parts.hue),
    lightness: parseNumber(parts.lightness),
  });

  return { ...color, alpha: parts.alpha ? parseNumber(parts.alpha) : 1 };
}

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

  const color = parseOklch(value, lookup.clipToSrgb) ?? parseHex(value);

  if (!color) {
    throw new Error(`Unsupported color value ${value}`);
  }

  return color;
}

/** See-through colors are laid on the mode's background, so every role is opaque. */
export function resolveColor({ name, ...lookup }: Lookup & { name: string }): Rgba {
  const background = parseColor(lookUp("background", lookup), lookup);
  return over(parseColor(lookUp(name, lookup), lookup), background);
}

export function modePalette(lookup: Lookup): Map<string, Rgba> {
  const background = resolveColor({ ...lookup, name: "background" });
  const colors = new Map<string, Rgba>();

  for (const name of PALETTE_TOKENS) {
    colors.set(name, resolveColor({ ...lookup, name }));
  }

  for (const [name, tint] of Object.entries(TINTS)) {
    const color = resolveColor({ ...lookup, name: tint.token });
    colors.set(name, over({ ...color, alpha: tint.share }, background));
  }

  return colors;
}
