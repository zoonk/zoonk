import { type LibraryLessonCompletion } from "@zoonk/core/lesson-player/contract";
import { describe, expect, it } from "vitest";
import { getLessonCelebration } from "./lesson-celebration";

const LEVEL_TWO = { color: "white", level: 2 } as const;

function lessonCompletion(
  overrides: Partial<LibraryLessonCompletion> = {},
): LibraryLessonCompletion {
  return {
    brainPower: 1,
    ceremony: null,
    certificates: [],
    correctCount: 1,
    energyDelta: 0.2,
    finishedChapter: null,
    incorrectCount: 0,
    isFirstCompletion: true,
    planReveal: null,
    reached: { energy: null, level: null },
    seconds: 60,
    studyBlock: null,
    totalBrainPower: 241,
    ...overrides,
  };
}

const MISSIONS = [{ done: 1, kind: "askBuddy", status: "done", total: 1 }];

function dayBlock(reached: LibraryLessonCompletion["reached"]) {
  return {
    brainPower: 51,
    ceremony: null,
    certificates: [],
    completedMissions: ["askBuddy"],
    fullMeal: { bonus: 50, paid: true },
    missions: MISSIONS,
    reached,
  } as unknown as NonNullable<LibraryLessonCompletion["studyBlock"]>;
}

describe(getLessonCelebration, () => {
  it("celebrates a lesson on its own from what the lesson reached", () => {
    const completion = lessonCompletion({ reached: { energy: 80, level: LEVEL_TWO } });

    expect(getLessonCelebration(completion)).toStrictEqual({
      brainPower: 1,
      ceremony: null,
      certificates: [],
      missionMoment: null,
      reached: { energy: 80, level: LEVEL_TWO },
    });
  });

  it("celebrates a day's block (a quick explanation's) from the block, its missions saying the day's bonus", () => {
    const studyBlock = dayBlock({ energy: 80, level: null });

    expect(getLessonCelebration(lessonCompletion({ studyBlock }))).toStrictEqual({
      brainPower: 1,
      ceremony: null,
      certificates: [],
      missionMoment: {
        completed: ["askBuddy"],
        fullMeal: { bonus: 50, paid: true },
        missions: MISSIONS,
      },
      reached: { energy: 80, level: null },
    });
  });

  it("counts the day's bonus in the block's points when a rarer moment shows instead of the missions", () => {
    const levelUp = lessonCompletion({ studyBlock: dayBlock({ energy: null, level: LEVEL_TWO }) });

    const chapterDone = lessonCompletion({
      finishedChapter: { chapterId: "chapter", goalId: "goal", title: "Atoms" },
      studyBlock: dayBlock({ energy: null, level: null }),
    });

    expect(getLessonCelebration(levelUp).brainPower).toBe(51);
    expect(getLessonCelebration(chapterDone).brainPower).toBe(51);
  });
});
