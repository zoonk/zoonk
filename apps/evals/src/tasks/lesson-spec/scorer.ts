import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { type LessonSpec, getLessonSpecIssues } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { isJsonObject } from "@zoonk/utils/json";
import { LESSON_SPEC_SCORE_CATEGORIES } from "./score-categories";
import { type LessonSpecExpected } from "./visual-test-cases";

type LessonLevel = Parameters<typeof getLessonSpecIssues>[0]["level"];

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

function getPictureProblem({
  expected,
  lessons,
}: {
  expected: LessonSpecExpected | undefined;
  lessons: LessonSpec[];
}): string | null {
  const pictures = lessons.flatMap((lesson) => lesson.screens).filter((screen) => screen.visual);

  if (expected?.pictures === "some" && pictures.length === 0) {
    return "No screen plans a picture, though the learner would have to imagine what the lesson shows.";
  }

  if (expected?.pictures === "none" && pictures.length > 0) {
    return `Plans ${pictures.length} picture(s) where the words alone are clear.`;
  }

  return null;
}

function getTemplateProblem({
  expected,
  lessons,
}: {
  expected: LessonSpecExpected | undefined;
  lessons: LessonSpec[];
}): string | null {
  const avoided = new Set(expected?.avoidTemplates);

  const planned = lessons
    .flatMap((lesson) => lesson.screens)
    .flatMap((screen) => (screen.activityTemplate ? [screen.activityTemplate] : []))
    .filter((template) => avoided.has(template));

  return planned.length > 0
    ? `Plans ${[...new Set(planned)].join(" and ")}, which would only decorate this skill.`
    : null;
}

function checkLessonSpecs({
  expected,
  level,
  output,
}: {
  expected: LessonSpecExpected | undefined;
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
  const hasPictureCheck = expected?.pictures !== undefined && expected.pictures !== "any";
  const pictureProblem = hasPictureCheck ? getPictureProblem({ expected, lessons }) : null;
  const hasTemplateCheck = (expected?.avoidTemplates?.length ?? 0) > 0;
  const templateProblem = hasTemplateCheck ? getTemplateProblem({ expected, lessons }) : null;
  const extraChecks = Number(hasPictureCheck) + Number(hasTemplateCheck);

  return {
    judgedOutput: JSON.stringify({ lessons: passing.map((result) => result.lesson) }, null, 2),
    passed:
      passing.length +
      (hasPictureCheck && !pictureProblem ? 1 : 0) +
      (hasTemplateCheck && !templateProblem ? 1 : 0),
    problems:
      lessons.length === 0
        ? ["The output has no valid lesson specs."]
        : [
            ...results.flatMap((result) => result.problems),
            ...(pictureProblem ? [pictureProblem] : []),
            ...(templateProblem ? [templateProblem] : []),
          ],
    total: Math.max(lessons.length, 1) + extraChecks,
  };
}

export const scoreLessonSpec: TaskScorer<LessonSpecExpected> = ({ output, testCase }) => {
  const level = getLevel(testCase.userInput);

  return scoreWithCodeChecks({
    check: (value) => checkLessonSpecs({ expected: testCase.expected, level, output: value }),
    output,
    scoreCategories: LESSON_SPEC_SCORE_CATEGORIES,
    testCase,
  });
};
