import { describe, expect, it } from "vitest";
import { toMaterialTranscript } from "./material-transcript";

describe(toMaterialTranscript, () => {
  it("empties a page that holds only illegible markers in headings and lists", () => {
    expect(
      toMaterialTranscript("# [illegible]\n\n1. [illegible]\n2. [illegible]\n- [illegible]"),
    ).toBe("");
  });

  it("keeps a page whose readable lines sit beside illegible ones", () => {
    const page = "# Physics formulas\n\ndensity = mass / volume\n\n[illegible]";

    expect(toMaterialTranscript(`${page}\n`)).toBe(page);
  });

  it("keeps a page that is only a number", () => {
    expect(toMaterialTranscript("12")).toBe("12");
  });
});
