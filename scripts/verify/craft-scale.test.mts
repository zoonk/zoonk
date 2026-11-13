/* oxlint-disable no-magic-numbers -- The fixtures are font sizes in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { typeScale } from "./craft-scale.mts";

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
});
