import { describe, expect, it } from "vitest";
import { getWarmUpKey } from "./warm-up-key";

const shared = {
  generalGoal: "  Apí culture! ",
  language: "en",
  ownerId: null,
  targetLanguage: null,
};

describe(getWarmUpKey, () => {
  it("normalizes the general goal with the Library's identity rules", () => {
    expect(getWarmUpKey({ ...shared, kind: "learn" })).toBe("learn::api-culture");

    expect(getWarmUpKey({ ...shared, generalGoal: "APÍ CULTURE", kind: "learn" })).toBe(
      "learn::api-culture",
    );
  });

  it("separates kinds and language pairs", () => {
    expect(getWarmUpKey({ ...shared, kind: "exam" })).toBe("exam::api-culture");

    expect(getWarmUpKey({ ...shared, kind: "language", targetLanguage: "es" })).toBe(
      "language:es:api-culture",
    );
  });

  it("never hands a C++ deck to a C or C# goal", () => {
    const keys = ["Learn C programming", "Learn C++ programming", "Learn C# programming"].map(
      (generalGoal) => getWarmUpKey({ ...shared, generalGoal, kind: "learn" }),
    );

    expect(new Set(keys).size).toBe(3);
  });

  it("does not name private, unexplained or empty subjects", () => {
    expect(getWarmUpKey({ ...shared, kind: "learn", ownerId: "learner" })).toBeNull();
    expect(getWarmUpKey({ ...shared, generalGoal: null, kind: "learn" })).toBeNull();
    expect(getWarmUpKey({ ...shared, generalGoal: " ! ", kind: "learn" })).toBeNull();
    expect(getWarmUpKey({ ...shared, kind: "explain" })).toBeNull();
  });
});
