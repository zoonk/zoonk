import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { describe, expect, it } from "vitest";
import { pickDayMoment } from "./pick-day-moment";

const BELT = { color: "white", level: 3 } as const;
const CHAPTER = { chapterId: "chapter", goalId: "goal", title: "Atoms" };

function missions({ done, paid }: { done: number; paid: boolean }): MissionMomentView {
  const kinds = ["review", "somethingNew", "practice"] as const;

  return {
    completed: done > 0 ? ["review"] : [],
    fullMeal: { bonus: 50, paid },
    missions: kinds.map((kind, index) => ({
      done: index < done ? 1 : 0,
      kind,
      status: index < done ? "done" : "todo",
      total: 1,
    })),
  };
}

const ALL_MISSIONS = missions({ done: 3, paid: true });
const ONE_MISSION = missions({ done: 1, paid: false });

describe(pickDayMoment, () => {
  it("shows the belt's new number over everything else an activity did", () => {
    const pick = pickDayMoment({
      ceremony: null,
      finishedChapter: CHAPTER,
      missionMoment: ALL_MISSIONS,
      reached: { energy: 90, level: BELT },
    });

    expect(pick).toBe("belt");
  });

  it("leaves the belt to its ceremony when the activity earned a new belt", () => {
    const pick = pickDayMoment({
      ceremony: { kind: "belt" },
      missionMoment: null,
      reached: { energy: null, level: BELT },
    });

    expect(pick).toBeNull();
  });

  it("puts the day's missions all done before a finished chapter", () => {
    const pick = pickDayMoment({
      ceremony: null,
      finishedChapter: CHAPTER,
      missionMoment: ALL_MISSIONS,
      reached: { energy: 90, level: null },
    });

    expect(pick).toBe("missions");
  });

  it("shows a finished chapter when nothing rarer happened", () => {
    const pick = pickDayMoment({
      ceremony: null,
      finishedChapter: CHAPTER,
      missionMoment: ONE_MISSION,
      reached: { energy: 80, level: null },
    });

    expect(pick).toBe("chapter");
  });

  it("gives one mission done and Energy moving no moment: the day's bar shows the progress", () => {
    const pick = pickDayMoment({
      ceremony: null,
      missionMoment: ONE_MISSION,
      reached: { energy: 80, level: null },
    });

    expect(pick).toBeNull();
  });

  it("shows nothing extra when the activity moved none of them", () => {
    const pick = pickDayMoment({
      ceremony: null,
      missionMoment: missions({ done: 0, paid: false }),
      reached: { energy: null, level: null },
    });

    expect(pick).toBeNull();
  });
});
