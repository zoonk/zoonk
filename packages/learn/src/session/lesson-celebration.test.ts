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
    correctCount: 1,
    energyDelta: 0.2,
    incorrectCount: 0,
    isFirstCompletion: true,
    nextReviewAt: null,
    reached: { energy: null, level: null },
    seconds: 60,
    studyBlock: null,
    totalBrainPower: 241,
    ...overrides,
  };
}

describe(getLessonCelebration, () => {
  it("celebrates a lesson on its own from what the lesson reached", () => {
    const completion = lessonCompletion({ reached: { energy: 80, level: LEVEL_TWO } });

    expect(getLessonCelebration(completion)).toStrictEqual({
      brainPower: 1,
      ceremony: null,
      missionMoment: null,
      reached: { energy: 80, level: LEVEL_TWO },
    });
  });

  it("celebrates a day's block (a quick explanation's) from the block: its missions, its own points and the bonus's level", () => {
    const missions = [{ done: 1, kind: "askBuddy", status: "done", total: 1 }];

    const studyBlock = {
      brainPower: 51,
      ceremony: null,
      completedMissions: ["askBuddy"],
      fullMeal: { bonus: 50, paid: true },
      missions,
      reached: { energy: 80, level: LEVEL_TWO },
    } as unknown as NonNullable<LibraryLessonCompletion["studyBlock"]>;

    expect(getLessonCelebration(lessonCompletion({ studyBlock }))).toStrictEqual({
      brainPower: 1,
      ceremony: null,
      missionMoment: { completed: ["askBuddy"], fullMeal: { bonus: 50, paid: true }, missions },
      reached: { energy: 80, level: LEVEL_TWO },
    });
  });
});
