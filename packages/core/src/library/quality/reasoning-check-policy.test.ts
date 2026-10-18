import { describe, expect, it } from "vitest";
import { writtenTemperatureLesson } from "./_test-utils/written-lessons";
import { getReasoningCheckReason } from "./reasoning-check-policy";

/** A lesson with no math anywhere, so only the sample can pick it. */
function wordsOnlyLesson() {
  const lesson = writtenTemperatureLesson();
  return { ...lesson, screens: lesson.screens.filter((screen) => screen.kind === "hookGuess") };
}

const never = () => 1;
const always = () => 0;

describe(getReasoningCheckReason, () => {
  it("reviews advanced, exam, high-stakes and math lessons every time", () => {
    const base = { categories: [], forExam: false, lesson: wordsOnlyLesson(), random: never };

    expect(getReasoningCheckReason({ ...base, level: "advanced" })).toBe("advanced");
    expect(getReasoningCheckReason({ ...base, forExam: true, level: "beginner" })).toBe("exam");

    expect(
      getReasoningCheckReason({ ...base, categories: ["arts", "health"], level: "beginner" }),
    ).toBe("highStakesSubject");

    expect(
      getReasoningCheckReason({ ...base, lesson: writtenTemperatureLesson(), level: "beginner" }),
    ).toBe("math");
  });

  it("samples the rest", () => {
    const base = {
      categories: ["arts"],
      forExam: false,
      lesson: wordsOnlyLesson(),
      level: "beginner" as const,
    };

    expect(getReasoningCheckReason({ ...base, random: always })).toBe("sample");
    expect(getReasoningCheckReason({ ...base, random: never })).toBeNull();
  });
});
