import { describe, expect, it } from "vitest";
import { getChapterWindow } from "./chapter-window";

const done = "done" as const;
const current = "current" as const;
const upcoming = "upcoming" as const;

describe(getChapterWindow, () => {
  it("starts one row before the next chapter, so the next one stays in sight", () => {
    const states = [done, done, done, done, done, current, upcoming, upcoming, upcoming];
    expect(getChapterWindow({ states })).toStrictEqual({ end: 8, start: 4 });
  });

  it("follows the chapter the learner is in when done and open chapters interleave", () => {
    const states = [upcoming, done, upcoming, done, done, upcoming, current, upcoming];
    expect(getChapterWindow({ states })).toStrictEqual({ end: 8, start: 4 });
  });

  it("starts at the top when the next chapter is the first", () => {
    expect(
      getChapterWindow({ states: [current, upcoming, upcoming, upcoming, upcoming] }),
    ).toStrictEqual({ end: 4, start: 0 });
  });

  it("fills the window back from the end near the phase's last chapters", () => {
    const states = [done, done, done, done, done, done, current];
    expect(getChapterWindow({ states })).toStrictEqual({ end: 7, start: 3 });
  });

  it("shows the first chapters of a finished phase and every chapter of a short one", () => {
    expect(getChapterWindow({ states: [done, done, done, done, done] })).toStrictEqual({
      end: 4,
      start: 0,
    });

    expect(getChapterWindow({ states: [done, current] })).toStrictEqual({ end: 2, start: 0 });
  });

  it("starts before an upcoming chapter in a phase not reached yet", () => {
    expect(getChapterWindow({ states: [upcoming, upcoming] })).toStrictEqual({ end: 2, start: 0 });
  });
});
