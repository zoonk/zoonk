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
  it("shows a finished chapter over everything else an activity did", () => {
    const pick = pickDayMoment({
      ceremony: null,
      finishedChapter: CHAPTER,
      missionMoment: ALL_MISSIONS,
      reached: { energy: 90, level: BELT },
    });

    expect(pick).toBe("chapter");
  });

  it("shows the belt's new number over the day's missions", () => {
    const pick = pickDayMoment({
      ceremony: null,
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

  it("shows the day's missions all done over one mission and Energy", () => {
    const pick = pickDayMoment({
      ceremony: null,
      missionMoment: ALL_MISSIONS,
      reached: { energy: 90, level: null },
    });

    expect(pick).toBe("missions");
  });

  it("shows one mission done when nothing rarer happened, and never Energy moving", () => {
    const pick = pickDayMoment({
      ceremony: null,
      missionMoment: ONE_MISSION,
      reached: { energy: 80, level: null },
    });

    expect(pick).toBe("mission");
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
