import { describe, expect, it } from "vitest";
import { getSuggestedTime } from "./suggested-time";

describe(getSuggestedTime, () => {
  it("suggests the time that covers everything, however long a day it takes", () => {
    expect(getSuggestedTime({ coreMinutes: 45, recommendedMinutes: 900 })).toStrictEqual({
      kind: "everything",
      minutes: 900,
    });
  });

  it("suggests the time that reaches every topic when no day can cover everything", () => {
    expect(getSuggestedTime({ coreMinutes: 300, recommendedMinutes: null })).toStrictEqual({
      kind: "everyTopic",
      minutes: 300,
    });
  });

  it("suggests nothing when no day can reach every topic either", () => {
    expect(getSuggestedTime({ coreMinutes: null, recommendedMinutes: null })).toBeNull();
  });
});
