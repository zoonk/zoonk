import { describe, expect, it } from "vitest";
import { oklchToRgb, readModes, readTailwindPalette, toArgbHex } from "./palette.mts";
import { readSubjects, subjectPalette } from "./subject-palette.mts";

describe(readSubjects, () => {
  const css = `
:root {
  --background: #fff;
  --foreground: oklch(0.185 0.004 286);
}
@media (prefers-color-scheme: light) and (prefers-contrast: more) {
  :root {
    --foreground: #000;
  }
}
:root {
  @variant dark {
    --background: #000;
  }
}
:root {
  @variant dark {
    @media (prefers-contrast: more) {
      --foreground: #fff;
    }
  }
}
[data-subject] {
  --subject-chroma: 0.84;
  --subject-hue: 290;
  --subject: oklch(0.68 calc(0.12 * var(--subject-chroma)) var(--subject-hue));
  --subject-text: oklch(0.47 calc(0.1 * var(--subject-chroma)) var(--subject-hue));
  --subject-tint: color-mix(in srgb, var(--subject) 13%, transparent);

  @variant dark {
    --subject: oklch(0.76 calc(0.11 * var(--subject-chroma)) var(--subject-hue));
  }

  @media (prefers-contrast: more) {
    --subject-text: var(--foreground);
    --subject-tint: transparent;

    @variant dark {
      --subject: oklch(0.86 calc(0.09 * var(--subject-chroma)) var(--subject-hue));
    }
  }
}
[data-subject="math"] {
  --subject-hue: 222;
  --subject-chroma: 0.5;
}
`;

  const subjects = readSubjects(css);
  const modes = readModes(css);
  const palette = readTailwindPalette("");

  it("fills each subject's hue and chroma into the formulas its mode cascades to", () => {
    expect([...subjects.keys()]).toStrictEqual(["math"]);
    expect(subjects.get("math")?.light.get("subject")).toBe("oklch(0.68 0.06 222)");
    expect(subjects.get("math")?.dark.get("subject")).toBe("oklch(0.76 0.055 222)");
    expect(subjects.get("math")?.darkMoreContrast.get("subject")).toBe("oklch(0.86 0.045 222)");
    expect(subjects.get("math")?.lightMoreContrast.get("subject-text")).toBe("var(--foreground)");
  });

  it("lays the tint on the mode's background and reads the mode's own tokens", () => {
    const math = subjects.get("math");

    if (!math) {
      throw new Error("No math subject");
    }

    const light = subjectPalette({ palette, subject: math.light, tokens: modes.light });

    const contrast = subjectPalette({
      palette,
      subject: math.lightMoreContrast,
      tokens: modes.lightMoreContrast,
    });

    expect(light.get("subject")).toBe(
      toArgbHex(oklchToRgb({ chroma: 0.06, hue: 222, lightness: 0.68 })),
    );

    expect(light.get("subject-tint")).not.toBe(light.get("subject"));
    expect(contrast.get("subject-text")).toBe("0xFF000000");
    expect(contrast.get("subject-tint")).toBe("0xFFFFFFFF");
  });
});
