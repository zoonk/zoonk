import { describe, expect, it } from "vitest";
import { getFreshStart, getLightMinutes } from "./fresh-start";

const THURSDAY = new Date("2026-10-01T00:00:00Z");
const MONDAY = new Date("2026-09-28T00:00:00Z");
const LAST_MONTH = new Date("2026-08-31T00:00:00Z");

describe(getFreshStart, () => {
  it("welcomes the learner back after two days away, before anything else", () => {
    expect(
      getFreshStart({
        isFirstDay: false,
        isNewPhase: true,
        lastStudyDate: MONDAY,
        startDate: LAST_MONTH,
        today: THURSDAY,
      }),
    ).toBe("welcomeBack");
  });

  it("starts a new phase or a new week fresh", () => {
    const tuesday = new Date("2026-09-29T00:00:00Z");

    expect(
      getFreshStart({
        isFirstDay: false,
        isNewPhase: true,
        lastStudyDate: MONDAY,
        startDate: LAST_MONTH,
        today: tuesday,
      }),
    ).toBe("newPhase");

    expect(
      getFreshStart({
        isFirstDay: false,
        isNewPhase: false,
        lastStudyDate: new Date("2026-09-27T00:00:00Z"),
        startDate: LAST_MONTH,
        today: MONDAY,
      }),
    ).toBe("newWeek");
  });

  it("keeps a normal day normal, and a first day isn't a comeback", () => {
    const wednesday = new Date("2026-09-30T00:00:00Z");

    expect(
      getFreshStart({
        isFirstDay: false,
        isNewPhase: false,
        lastStudyDate: MONDAY,
        startDate: LAST_MONTH,
        today: wednesday,
      }),
    ).toBeNull();

    // Set up on Monday and not studied yet: two days in, nothing to come back from.
    expect(
      getFreshStart({
        isFirstDay: false,
        isNewPhase: false,
        lastStudyDate: null,
        startDate: MONDAY,
        today: wednesday,
      }),
    ).toBeNull();
  });

  it("welcomes back a learner who set the goal up days ago and hasn't studied since", () => {
    // Rafaela set up her goal on Monday, opened Today and left; she's back on Thursday.
    expect(
      getFreshStart({
        isFirstDay: false,
        isNewPhase: false,
        lastStudyDate: null,
        startDate: MONDAY,
        today: THURSDAY,
      }),
    ).toBe("welcomeBack");

    // The same when she never opened Today before: the goal's first session isn't its first day.
    expect(
      getFreshStart({
        isFirstDay: true,
        isNewPhase: false,
        lastStudyDate: null,
        startDate: MONDAY,
        today: THURSDAY,
      }),
    ).toBe("welcomeBack");
  });

  it("counts the days away from the goal's start when the last study day was before it", () => {
    // Studied another goal last month, started this one on Monday: Wednesday is its third day.
    expect(
      getFreshStart({
        isFirstDay: false,
        isNewPhase: false,
        lastStudyDate: LAST_MONTH,
        startDate: MONDAY,
        today: new Date("2026-09-30T00:00:00Z"),
      }),
    ).toBeNull();
  });

  it("says nothing on a goal's first day, even on a Monday, in a later phase or after a break", () => {
    expect(
      getFreshStart({
        isFirstDay: true,
        isNewPhase: true,
        lastStudyDate: LAST_MONTH,
        startDate: MONDAY,
        today: MONDAY,
      }),
    ).toBeNull();

    expect(
      getFreshStart({
        isFirstDay: true,
        isNewPhase: false,
        lastStudyDate: null,
        startDate: MONDAY,
        today: MONDAY,
      }),
    ).toBeNull();
  });

  it("counts from the last study day when the plan's start is still ahead", () => {
    expect(
      getFreshStart({
        isFirstDay: false,
        isNewPhase: false,
        lastStudyDate: MONDAY,
        startDate: new Date("2026-10-05T00:00:00Z"),
        today: THURSDAY,
      }),
    ).toBe("welcomeBack");
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
