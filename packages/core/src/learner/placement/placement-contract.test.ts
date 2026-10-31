import { describe, expect, it } from "vitest";
import { getOwnLevel } from "./placement-contract";

function storedLevel(level: string) {
  return getOwnLevel({ goal: { details: { level } } });
}

describe(getOwnLevel, () => {
  it("prefers the request's level, then the one stored on the goal", () => {
    expect(getOwnLevel({ goal: { details: { level: "basic" } }, level: "advanced" })).toBe(
      "advanced",
    );

    expect(getOwnLevel({ goal: { details: { level: "intermediate" } } })).toBe("intermediate");
    expect(getOwnLevel({ goal: { details: {} } })).toBeNull();
  });

  it("reads a language's level test result on the same scale", () => {
    expect(
      ["A1", "A2+", "B1+", "B2", "C1", "intermediário"].map((level) => storedLevel(level)),
    ).toStrictEqual(["none", "basic", "intermediate", "intermediate", "advanced", null]);
  });
});
