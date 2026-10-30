import { describe, expect, it } from "vitest";
import { getSuggestedTime } from "./suggested-time";

describe(getSuggestedTime, () => {
  it("suggests the time that covers everything, up to four hours a day", () => {
    expect(getSuggestedTime({ coreMinutes: null, recommendedMinutes: 240 })).toStrictEqual({
      kind: "everything",
      minutes: 240,
    });
  });

  it("suggests the time that reaches every topic when covering everything takes longer", () => {
    expect(getSuggestedTime({ coreMinutes: 45, recommendedMinutes: 300 })).toStrictEqual({
      kind: "everyTopic",
      minutes: 45,
    });
  });

  it.each([
    { coreMinutes: 300, recommendedMinutes: 900 },
    { coreMinutes: null, recommendedMinutes: null },
  ])("suggests nothing a day can't sensibly hold: %o", (time) => {
    expect(getSuggestedTime(time)).toBeNull();
  });
});
