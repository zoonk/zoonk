import { describe, expect, it } from "vitest";
import { oklchToRgb, toArgbHex, toDisplayP3 } from "./color.mts";
import { readModes, readTailwindPalette, resolveColor } from "./palette.mts";

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

describe(toDisplayP3, () => {
  const precision = 6;

  it.each([
    {
      expected: { blue: 0.9886237, green: 0.4912186, red: 0.2664224 },
      name: "Tailwind blue-500",
      oklch: { chroma: 0.214, hue: 259.815, lightness: 0.623 },
    },
    {
      expected: { blue: 0.3743069, green: 0.7747542, red: 0.3087344 },
      name: "Tailwind green-500",
      oklch: { chroma: 0.219, hue: 149.579, lightness: 0.723 },
    },
  ])(
    "preserves $name outside sRGB using the CSS Color 4 reference values",
    ({ expected, oklch }) => {
      const extended = oklchToRgb({ ...oklch, clipToSrgb: false });
      const p3 = toDisplayP3(extended);

      expect(p3.red).toBeCloseTo(expected.red, precision);
      expect(p3.green).toBeCloseTo(expected.green, precision);
      expect(p3.blue).toBeCloseTo(expected.blue, precision);
      expect(p3).not.toStrictEqual(toDisplayP3(oklchToRgb(oklch)));
    },
  );

  it("preserves every neutral channel and alpha across the sRGB range", () => {
    const steps = 100;
    const alpha = 0.5;

    for (const step of Array.from({ length: steps + 1 }, (_, index) => index)) {
      const channel = step / steps;
      const p3 = toDisplayP3({ alpha, blue: channel, green: channel, red: channel });

      expect(p3.red).toBeCloseTo(channel, precision);
      expect(p3.green).toBeCloseTo(channel, precision);
      expect(p3.blue).toBeCloseTo(channel, precision);
      expect(p3.alpha).toBe(alpha);
    }
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
