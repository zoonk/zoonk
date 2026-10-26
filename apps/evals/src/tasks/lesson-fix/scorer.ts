import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type FixLessonDraftParams } from "@zoonk/ai/tasks/v2/lesson-writer/fix";
import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { checkWrittenLesson } from "@zoonk/core/library/quality/code-checks";
import { checkLessonPrograms } from "@zoonk/core/library/quality/program-checks";
import { findQuestionBases } from "@zoonk/core/library/steps/question-bases";
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

/** The lesson's screens as production converts them, with the problems its code checks find. */
function checkLesson(input: FixLessonDraftParams, lesson: WrittenLesson) {
  return checkWrittenLesson({
    allowActivityFallback: true,
    language: input.language,
    lesson,
    level: input.level,
    spec: input.spec,
    writtenAnswers: input.writtenAnswers,
  });
}

/**
 * Questions that rested on a sentence of an earlier screen before the fix and no longer do: the
 * fix reworded that sentence, or the question's quote, so the player has nothing to mark.
 */
function lostBases({
  after,
  input,
}: {
  after: { lesson: WrittenLesson; screens: ReturnType<typeof checkLesson>["screens"] };
  input: FixLessonDraftParams;
}): number[] {
  const before = { lesson: input.lesson, screens: checkLesson(input, input.lesson).screens };
  const kept = new Set(findQuestionBases(after).bases.map((basis) => basis.question));

  return findQuestionBases(before)
    .bases.map((basis) => basis.question)
    .filter((question) => !kept.has(question));
}

/**
 * A fix passes when the fixed lesson passes every code check production runs
 * after the fix pass (code activities run too), keeps the pictures its
 * questions are about and the sentences they rest on (every basis quoted exactly), and rewrote
 * every screen a problem named. Whether a reviewer's problem is really fixed is judged in
 * production by the second review, not here.
 */
export const scoreLessonFix: TaskScorer<LessonFixExpected> = async ({ output, testCase }) => {
  const input = testCase.userInput as FixLessonDraftParams;
  const expected = testCase.expected;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs expected values.`);
  }

  const { changedScreens, lesson } = JSON.parse(output) as FixOutput;

  const checked = checkLesson(input, lesson);

  const problems = [
    ...checked.problems,
    ...(await checkLessonPrograms(checked.screens)),
    ...findQuestionBases({ lesson, screens: checked.screens }).problems,
  ].map(
    (problem) => `Screen ${problem.screen === null ? "-" : problem.screen + 1}: ${problem.problem}`,
  );

  const untouched = expected.screens.filter((screen) => !changedScreens.includes(screen));
  const lost = lostPictures(input.lesson, lesson);
  const unbased = lostBases({ after: { lesson, screens: checked.screens }, input });

  if (unbased.length > 0) {
    problems.push(
      `Screens ${unbased.map((screen) => screen + 1).join(", ")} lost the sentence their question rests on.`,
    );
  }

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
