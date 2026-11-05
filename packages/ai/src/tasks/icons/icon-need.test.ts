import { describe, expect, it } from "vitest";
import { toIconNeed } from "./icon-need";

function named(name: string) {
  return toIconNeed({ description: "A drawing", name, searchWords: [] })?.name ?? null;
}

describe(toIconNeed, () => {
  it("keeps short lowercase English names, so two lessons asking for one thing share it", () => {
    expect(named("  A Rubber   Stamp. ")).toBe("rubber stamp");
    expect(named("t-shirt")).toBe("t-shirt");
    expect(named("piggy bank")).toBe("piggy bank");
  });

  it("asks for nothing a shared icon can't be named: digits, another script, a long phrase", () => {
    expect(named("form 1040")).toBeNull();
    expect(named("balança")).toBeNull();
    expect(named("天秤")).toBeNull();
    expect(named("a very long name for one small icon")).toBeNull();
    expect(named("")).toBeNull();
    expect(toIconNeed(null)).toBeNull();
  });

  it("cleans the search words and drops the ones that repeat the name or aren't English", () => {
    expect(
      toIconNeed({
        description: "A wooden stamp — over a red ink pad",
        name: "Rubber stamp",
        searchWords: ["rubber stamp", "Seal", "carimbo", "ink pad", "approval"],
      }),
    ).toStrictEqual({
      description: "A wooden stamp, over a red ink pad",
      name: "rubber stamp",
      searchWords: ["seal", "carimbo", "ink pad", "approval"],
    });
  });
});
