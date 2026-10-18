import { describe, expect, it } from "vitest";
import { blankStem, commonStem, nextOpenBlank, splitForm } from "./pattern-cells";

describe("pattern cells", () => {
  it("finds the stem every form shares", () => {
    expect(commonStem(["hablo", "hablas", "habla", "hablamos"])).toBe("habl");
    expect(commonStem(["soy", "eres", "es"])).toBe("");
    expect(commonStem(["como"])).toBe("como");
  });

  it("splits a form into its stem and ending", () => {
    expect(splitForm("hablamos", "habl")).toStrictEqual({ ending: "amos", stem: "habl" });
    expect(splitForm("soy", "")).toStrictEqual({ ending: "", stem: "soy" });
    expect(splitForm("habl", "habl")).toStrictEqual({ ending: "", stem: "habl" });
  });

  it("leaves the ending off a blank's answer", () => {
    expect(blankStem(["áis", "éis", "en"], "coméis")).toBe("com");
    expect(blankStem(["os", "emos"], "comemos")).toBe("com");
  });

  it("moves to the next blank still open", () => {
    expect(nextOpenBlank({ blanks: [4, 5], current: null, filled: {} })).toBe(4);
    expect(nextOpenBlank({ blanks: [4, 5], current: 4, filled: { "4": "éis" } })).toBe(5);
    expect(nextOpenBlank({ blanks: [4, 5], current: 5, filled: { "5": "en" } })).toBe(4);

    expect(
      nextOpenBlank({ blanks: [4, 5], current: 5, filled: { "4": "éis", "5": "en" } }),
    ).toBeNull();
  });
});
