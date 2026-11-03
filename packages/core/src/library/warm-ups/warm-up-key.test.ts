import { describe, expect, it } from "vitest";
import { getWarmUpKey } from "./warm-up-key";

const shared = { generalGoal: "  Apí culture! ", ownerId: null, targetLanguage: null };

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

  it("does not name private, unexplained or empty subjects", () => {
    expect(getWarmUpKey({ ...shared, kind: "learn", ownerId: "learner" })).toBeNull();
    expect(getWarmUpKey({ ...shared, generalGoal: null, kind: "learn" })).toBeNull();
    expect(getWarmUpKey({ ...shared, generalGoal: " ! ", kind: "learn" })).toBeNull();
    expect(getWarmUpKey({ ...shared, kind: "explain" })).toBeNull();
  });
});
