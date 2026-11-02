import { describe, expect, it } from "vitest";
import { oklchToRgb, readModes, readTailwindPalette, resolveColor, toArgbHex } from "./palette.mts";

const globals = `
@source "../apps/**/*.{ts,tsx}";
:root {
  /* the page */
  --background: var(--color-white);
  --foreground: oklch(0.185 0.004 286);
  --border: oklch(0 0 0 / 10%);
  --success: oklch(62.3% 0.214 259.815);
  --selected-tint: color-mix(in srgb, var(--foreground) 50%, transparent);
  --ring: var(--color-foreground);
}
@media (prefers-color-scheme: light) and (prefers-contrast: more) {
  :root {
    --foreground: var(--color-black);
  }
}
:root {
  @variant dark {
    --background: var(--color-black);
  }
}
:root {
  @variant dark {
    @media (prefers-contrast: more) {
      --background: #fff;
    }
  }
}
`;

const tailwind = `@theme default { --color-white: #fff; --color-black: #000; }`;

describe(oklchToRgb, () => {
  it("matches sRGB's primaries and Tailwind's published values", () => {
    expect(toArgbHex(oklchToRgb({ chroma: 0, hue: 0, lightness: 1 }))).toBe("0xFFFFFFFF");

    expect(toArgbHex(oklchToRgb({ chroma: 0.25768, hue: 29.2339, lightness: 0.62796 }))).toBe(
      "0xFFFF0000",
    );

    expect(toArgbHex(oklchToRgb({ chroma: 0, hue: 0, lightness: 0.922 }))).toBe("0xFFE5E5E5");
  });
});

describe(readModes, () => {
  const modes = readModes(globals);
  const palette = readTailwindPalette(tailwind);

  const color = (mode: keyof typeof modes, name: string) =>
    toArgbHex(resolveColor({ name, palette, tokens: modes[mode] }));

  it("cascades each mode over the one it builds on", () => {
    expect(modes.light.get("foreground")).toBe("oklch(0.185 0.004 286)");
    expect(modes.lightMoreContrast.get("foreground")).toBe("var(--color-black)");
    expect(modes.dark.get("background")).toBe("var(--color-black)");
    expect(modes.dark.get("foreground")).toBe("oklch(0.185 0.004 286)");
    expect(modes.darkMoreContrast.get("background")).toBe("#fff");
  });

  it("flattens see-through colors and mixes onto each mode's background", () => {
    expect(color("light", "border")).toBe("0xFFE6E6E6");
    expect(color("dark", "border")).toBe("0xFF000000");
    expect(color("light", "selected-tint")).toBe("0xFF89898A");
    expect(color("light", "success")).toBe("0xFF2B7FFF");
  });
});
