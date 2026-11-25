import { describe, expect, it } from "vitest";
import { toMaterialTranscript } from "./material-transcript";

describe(toMaterialTranscript, () => {
  it("empties a page the model calls unreadable, whatever note it wrote", () => {
    expect(toMaterialTranscript({ readable: false, text: "[Nothing to write]" })).toBe("");
  });

  it("empties a page that holds only illegible markers in headings and lists", () => {
    expect(
      toMaterialTranscript({
        readable: true,
        text: "# [illegible]\n\n1. [illegible]\n2. [illegible]\n- [illegible]",
      }),
    ).toBe("");
  });

  it("empties a skeleton whose lines join illegible markers with punctuation", () => {
    expect(
      toMaterialTranscript({
        readable: true,
        text: "# [illegible] — [illegible]\n\n1. [illegible]\n2. [illegible], [illegible]",
      }),
    ).toBe("");
  });

  it("keeps a page whose readable lines sit beside illegible ones", () => {
    const page = "# Physics formulas\n\ndensity = mass / volume\n\n[illegible]";

    expect(toMaterialTranscript({ readable: true, text: `${page}\n` })).toBe(page);
  });

  it("keeps a page that is only a figure line", () => {
    const page = "[Diagram: Sol → produtores → consumidores]";

    expect(toMaterialTranscript({ readable: true, text: page })).toBe(page);
  });

  it("keeps a page that is only a number", () => {
    expect(toMaterialTranscript({ readable: true, text: "12" })).toBe("12");
  });
});
