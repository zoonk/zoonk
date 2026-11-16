import { describe, expect, it } from "vitest";
import { toLanguageAimView } from "./language-aims";

describe(toLanguageAimView, () => {
  it("a half-band aim keeps its label beside the band its choice matches", () => {
    const view = toLanguageAimView({ level: "none", targetScore: "B1+" });

    expect(view.aim).toBe("B1");
    expect(view.label).toBe("B1+");
    expect(view.choices.map((choice) => choice.aim)).toContain("B1");
  });

  it("a whole-band aim is its own label", () => {
    expect(toLanguageAimView({ targetScore: "B2" })).toMatchObject({ aim: "B2", label: "B2" });
  });
});
