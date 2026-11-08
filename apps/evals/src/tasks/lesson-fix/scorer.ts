import { isDeepStrictEqual } from "node:util";
import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type FixLessonDraftParams } from "@zoonk/ai/tasks/lesson-writer/fix";
import { type WrittenLesson } from "@zoonk/ai/tasks/lesson-writer/schema";
import { checkWrittenLesson } from "@zoonk/core/library/quality/code-checks";
import { checkLessonPrograms } from "@zoonk/core/library/quality/program-checks";
import { findQuestionBases } from "@zoonk/core/library/steps/question-bases";
import { type LessonFixExpected } from "./test-cases";

type FixOutput = { changedScreens: number[]; lesson: WrittenLesson };

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

function checkLesson(input: FixLessonDraftParams, lesson: WrittenLesson) {
  return checkWrittenLesson({
    allowActivityFallback: true,
    language: input.language,
    lesson,
    level: input.level,
    material: input.material,
    shortAnswers: input.shortAnswers,
    spec: input.spec,
  });
}

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

export const scoreLessonFix: TaskScorer<LessonFixExpected> = async ({ output, testCase }) => {
  const input = testCase.userInput as FixLessonDraftParams;
  const expected = testCase.expected;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs expected values.`);
  }

  const { changedScreens, lesson } = JSON.parse(output) as FixOutput;

  if (expected.real) {
    const changed = lesson.screens.flatMap((screen, index) =>
      isDeepStrictEqual(screen, input.lesson.screens[index]) ? [] : [index],
    );

    const summaryChanged = !isDeepStrictEqual(lesson.summary, input.lesson.summary);

    if (expected.real === "citation") {
      const kept =
        JSON.stringify(lesson.screens[3]).includes("§ 2º") &&
        changed.length === 0 &&
        !summaryChanged;

      return createFixedScore({
        conclusion: kept
          ? "Kept the correct citation and all content."
          : "Changed correct content.",
        score: kept ? 10 : 6,
      });
    }

    const fixed =
      [13, 15].every((index) => changed.includes(index)) &&
      summaryChanged &&
      changed.every((index) => index === 13 || index === 15);

    return createFixedScore({
      conclusion: fixed
        ? "Updated both claims and the summary; inspect the factual correction."
        : "Missed a repeated claim or changed unrelated screens.",
      score: fixed ? 10 : 6,
    });
  }

  const checked = checkLesson(input, lesson);

  const problems = [...checked.problems, ...(await checkLessonPrograms(checked.screens))].map(
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
