import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type FixLessonDraftParams } from "@zoonk/ai/tasks/v2/lesson-writer/fix";
import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { checkWrittenLesson } from "@zoonk/core/library/quality/code-checks";
import { checkLessonPrograms } from "@zoonk/core/library/quality/program-checks";
import { type LessonFixExpected } from "./test-cases";

type FixOutput = { changedScreens: number[]; lesson: WrittenLesson };

/**
 * Screens whose question was asked about its pictures (picture options, or a picture whose
 * numbers mark parts) and lost them in the fix: without them it can't be answered.
 */
function lostPictures(before: WrittenLesson, after: WrittenLesson): number[] {
  return before.screens.flatMap((screen, index) => {
    if (screen.kind !== "check") {
      return [];
    }

    const hadParts = Boolean(screen.image?.parts);
    const hadOptionPictures = screen.options.some((option) => option.picture);

    if (!hadParts && !hadOptionPictures) {
      return [];
    }

    const fixed = after.screens[index];

    const kept =
      fixed?.kind === "check" &&
      (!hadParts || Boolean(fixed.image?.parts)) &&
      (!hadOptionPictures || fixed.options.every((option) => option.picture));

    return kept ? [] : [index];
  });
}

/**
 * A fix passes when the fixed lesson passes every code check production runs
 * after the fix pass (code activities run too), keeps the pictures its
 * questions are about, and rewrote every screen a problem named. Whether a reviewer's problem is really fixed is judged in
 * production by the second review, not here.
 */
export const scoreLessonFix: TaskScorer<LessonFixExpected> = async ({ output, testCase }) => {
  const input = testCase.userInput as FixLessonDraftParams;
  const expected = testCase.expected;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs expected values.`);
  }

  const { changedScreens, lesson } = JSON.parse(output) as FixOutput;

  const checked = checkWrittenLesson({
    allowActivityFallback: true,
    language: input.language,
    lesson,
    level: input.level,
    spec: input.spec,
  });

  const problems = [...checked.problems, ...(await checkLessonPrograms(checked.screens))].map(
    (problem) => `Screen ${problem.screen === null ? "-" : problem.screen + 1}: ${problem.problem}`,
  );

  const untouched = expected.screens.filter((screen) => !changedScreens.includes(screen));
  const lost = lostPictures(input.lesson, lesson);

  if (lost.length > 0) {
    problems.push(
      `Screens ${lost.map((screen) => screen + 1).join(", ")} lost the pictures their question is about.`,
    );
  }

  if (problems.length > 0) {
    return createFixedScore({ conclusion: problems.join(" "), score: 6 });
  }

  if (untouched.length > 0) {
    return createFixedScore({
      conclusion: `Didn't rewrite screens ${untouched.map((screen) => screen + 1).join(", ")}.`,
      score: 8,
    });
  }

  return createFixedScore({
    conclusion: "Every problem's screen was rewritten and the lesson passes the code checks.",
    score: 10,
  });
};
