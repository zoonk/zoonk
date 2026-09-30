import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { type LessonSpec, getLessonSpecIssues } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { isJsonObject } from "@zoonk/utils/json";
import { LESSON_SPEC_SCORE_CATEGORIES } from "./score-categories";

type LessonLevel = Parameters<typeof getLessonSpecIssues>[0]["level"];

/**
 * Saved outputs can be edited or come from an older shape, so the scorer
 * checks the fields the size and shape rules read before trusting them.
 */
function isLessonSpec(value: unknown): value is LessonSpec {
  return (
    isJsonObject(value) &&
    typeof value.title === "string" &&
    typeof value.estimatedMinutes === "number" &&
    Array.isArray(value.skills) &&
    Array.isArray(value.screens) &&
    value.screens.every((screen) => isJsonObject(screen) && Array.isArray(screen.skills))
  );
}

function parseLessons(output: string): LessonSpec[] {
  try {
    const parsed: unknown = JSON.parse(output);
    const lessons = isJsonObject(parsed) ? parsed.lessons : null;

    return Array.isArray(lessons) ? lessons.filter((lesson) => isLessonSpec(lesson)) : [];
  } catch {
    return [];
  }
}

function getLevel(userInput: Record<string, unknown>): LessonLevel {
  const { level } = userInput;

  if (typeof level !== "string") {
    throw new TypeError("Lesson-spec test cases require a level.");
  }

  return level as LessonLevel;
}

/**
 * Each lesson is one part: it passes when it meets the size and shape rules
 * (1 to 3 skills, 5 to 12 screens, 2 to 5 minutes, a hook first, a check
 * every 2 or 3 screens, one application last, worked examples for hard
 * skills). Only passing lessons reach the judge.
 */
function checkLessonSpecs({
  level,
  output,
}: {
  level: LessonLevel;
  output: string;
}): CodeCheckResult {
  const lessons = parseLessons(output);

  const results = lessons.map((lesson, index) => ({
    lesson,
    problems: getLessonSpecIssues({ level, spec: lesson }).map(
      (issue) => `Lesson ${index + 1} ("${lesson.title}"): ${issue.detail}`,
    ),
  }));

  const passing = results.filter((result) => result.problems.length === 0);

  return {
    judgedOutput: JSON.stringify({ lessons: passing.map((result) => result.lesson) }, null, 2),
    passed: passing.length,
    problems:
      lessons.length === 0
        ? ["The output has no valid lesson specs."]
        : results.flatMap((result) => result.problems),
    total: Math.max(lessons.length, 1),
  };
}

export const scoreLessonSpec: TaskScorer = ({ output, testCase }) => {
  const level = getLevel(testCase.userInput);

  return scoreWithCodeChecks({
    check: (value) => checkLessonSpecs({ level, output: value }),
    output,
    scoreCategories: LESSON_SPEC_SCORE_CATEGORIES,
    testCase,
  });
};
