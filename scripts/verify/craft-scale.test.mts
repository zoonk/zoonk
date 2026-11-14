/* oxlint-disable no-magic-numbers -- The fixtures are font sizes in pixels. */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "vitest";
import { readTypeScale, typeScale } from "./craft-scale.mts";

describe("reading the type scale", () => {
  it("resolves the roles' and the shared pieces' classes through utilities and themes", () => {
    const css = `
      @theme inline { --text-tiny: 0.625rem; }
      @utility text-lead {
        font-size: 1.0625rem;
        color: var(--muted-foreground);
        @media (width >= 40rem) { font-size: 1.125rem; }
      }
    `;

    const sources = [
      'className: "text-lead"',
      'cn("text-sm text-muted-foreground sm:text-[0.84375rem]", "text-[13px] text-tiny/4")',
    ];

    assert.deepEqual(
      typeScale({ css, sources, theme: "--text-sm: 0.875rem;" }),
      [10, 13, 13.5, 14, 17, 18],
    );
  });

  it("does not turn a screen's one-off size into part of the shared scale", () => {
    const root = mkdtempSync(join(tmpdir(), "zoonk-type-scale-"));

    try {
      for (const [path, source] of Object.entries({
        "apps/playground/src/design-system/type.ts": 'export const title = "text-xl";',
        "packages/learn/src/screen.tsx": 'export const readout = "text-4xl";',
        "packages/player/src/screen.tsx": 'export const letter = "text-6xl";',
        "packages/ui/node_modules/tailwindcss/theme.css":
          "--text-sm: .875rem; --text-xl: 1.25rem; --text-4xl: 2.25rem; --text-6xl: 3.75rem;",
        "packages/ui/src/button.tsx": 'export const button = "text-sm";',
        "packages/ui/src/styles/globals.css": "",
      })) {
        const absolute = join(root, path);
        mkdirSync(dirname(absolute), { recursive: true });
        writeFileSync(absolute, source);
      }

      assert.deepEqual(readTypeScale(root), [14, 20]);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
