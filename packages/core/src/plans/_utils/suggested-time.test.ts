import { describe, expect, it } from "vitest";
import { getSuggestedTime } from "./suggested-time";

describe(getSuggestedTime, () => {
  it("suggests the time that covers everything, up to four hours a day", () => {
    expect(getSuggestedTime({ coreMinutes: 45, recommendedMinutes: 240 })).toStrictEqual({
      kind: "everything",
      minutes: 240,
    });
  });

  it("suggests the time that reaches every topic when covering everything takes longer", () => {
    expect(getSuggestedTime({ coreMinutes: 210, recommendedMinutes: 625 })).toStrictEqual({
      kind: "everyTopic",
      minutes: 210,
    });
  });

  it.each([
    { coreMinutes: 255, recommendedMinutes: 805 },
    { coreMinutes: 300, recommendedMinutes: null },
    { coreMinutes: null, recommendedMinutes: null },
  ])("suggests no day longer than four hours: %o", (time) => {
    expect(getSuggestedTime(time)).toBeNull();
  });
});
