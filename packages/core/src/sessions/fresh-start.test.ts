import { describe, expect, it } from "vitest";
import { getFreshStart, getLightMinutes } from "./fresh-start";

const THURSDAY = new Date("2026-10-01T00:00:00Z");
const MONDAY = new Date("2026-09-28T00:00:00Z");

describe(getFreshStart, () => {
  it("welcomes the learner back after two days away, before anything else", () => {
    expect(getFreshStart({ isNewPhase: true, lastStudyDate: MONDAY, today: THURSDAY })).toBe(
      "welcomeBack",
    );
  });

  it("starts a new phase or a new week fresh", () => {
    const tuesday = new Date("2026-09-29T00:00:00Z");

    expect(getFreshStart({ isNewPhase: true, lastStudyDate: MONDAY, today: tuesday })).toBe(
      "newPhase",
    );

    expect(
      getFreshStart({
        isNewPhase: false,
        lastStudyDate: new Date("2026-09-27T00:00:00Z"),
        today: MONDAY,
      }),
    ).toBe("newWeek");
  });

  it("keeps a normal day normal, and a first day isn't a comeback", () => {
    const wednesday = new Date("2026-09-30T00:00:00Z");

    expect(
      getFreshStart({ isNewPhase: false, lastStudyDate: MONDAY, today: wednesday }),
    ).toBeNull();

    expect(getFreshStart({ isNewPhase: false, lastStudyDate: null, today: wednesday })).toBeNull();
  });
});

describe(getLightMinutes, () => {
  it("gives a light session a bit under half the usual time, rounded to five", () => {
    expect(getLightMinutes(45)).toBe(20);
    expect(getLightMinutes(60)).toBe(25);
    expect(getLightMinutes(20)).toBe(10);
    expect(getLightMinutes(5)).toBe(5);
  });
});
