import { isDeepStrictEqual } from "node:util";
import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type LanguageLessonContent } from "@zoonk/ai/tasks/language/language-lesson";
import { parseLesson } from "../language-lesson/scorer";
import { type LanguageLessonFixExpected, type LanguageLessonFixInput } from "./test-cases";

/** A fix changes the item a finding names and what quotes it, never the rest of the lesson. */
const MAX_CHANGED_ITEMS = 2;

function countChangedItems(before: LanguageLessonContent, after: LanguageLessonContent): number {
  const lists = ["words", "sentences", "practice"] as const;

  const items = lists.flatMap((list) =>
    before[list].map((item, index) => !isDeepStrictEqual(item, after[list][index])),
  );

  const parts = (["tip", "writing", "summary"] as const).map(
    (part) => !isDeepStrictEqual(before[part], after[part]),
  );

  return [...items, ...parts].filter(Boolean).length;
}

export const scoreLanguageLessonFix: TaskScorer<LanguageLessonFixExpected> = ({
  output,
  testCase,
}) => {
  const { expected } = testCase;
  const input = testCase.userInput as LanguageLessonFixInput;
  const fixed = parseLesson(output);

  if (!expected || !fixed) {
    return createFixedScore({ conclusion: "The output isn't a lesson.", score: 0 });
  }

  const changed = countChangedItems(input.lesson, fixed);

  if ("kept" in expected) {
    return changed === 0
      ? createFixedScore({ conclusion: "Declined the wrong finding.", score: 10 })
      : createFixedScore({
          conclusion: `Followed a wrong finding: ${changed} parts changed.`,
          score: 4,
        });
  }

  const { field, index, list } = expected.item;
  const value = Object.entries(fixed[list][index] ?? {}).find(([key]) => key === field)?.[1];

  if (JSON.stringify(value).includes(expected.gone)) {
    return createFixedScore({ conclusion: `Left “${expected.gone}” in its ${field}.`, score: 4 });
  }

  return changed > MAX_CHANGED_ITEMS
    ? createFixedScore({ conclusion: `Fixed it, but changed ${changed} parts.`, score: 7 })
    : createFixedScore({ conclusion: "Fixed only what the finding names.", score: 10 });
};
