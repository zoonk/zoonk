import { describe, expect, it } from "vitest";
import { normalizeIconName, toIconNeed } from "./icon-need";

describe(normalizeIconName, () => {
  it("keeps short lowercase English names, so two lessons asking for one thing share it", () => {
    expect(normalizeIconName("  A Rubber   Stamp. ")).toBe("rubber stamp");
    expect(normalizeIconName("t-shirt")).toBe("t-shirt");
    expect(normalizeIconName("piggy bank")).toBe("piggy bank");
  });

  it("refuses names that can't be a shared icon: digits, another script, long phrases", () => {
    expect(normalizeIconName("form 1040")).toBeNull();
    expect(normalizeIconName("balança")).toBeNull();
    expect(normalizeIconName("天秤")).toBeNull();
    expect(normalizeIconName("a very long name for one small icon")).toBeNull();
    expect(normalizeIconName("")).toBeNull();
  });
});

describe(toIconNeed, () => {
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

  it("asks for nothing without a usable name", () => {
    expect(toIconNeed({ description: "x", name: "ação", searchWords: [] })).toBeNull();
    expect(toIconNeed(null)).toBeNull();
  });
});
