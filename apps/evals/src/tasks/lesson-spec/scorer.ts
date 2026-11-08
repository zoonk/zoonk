import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import {
  type LessonScreenKind,
  type LessonSpec,
  getLessonSpecIssues,
} from "@zoonk/ai/tasks/lesson-spec/rules";
import { readsNoviceRules } from "@zoonk/ai/tasks/novice-rules";
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

const QUESTION_KINDS: ReadonlySet<LessonScreenKind> = new Set([
  "activity",
  "application",
  "check",
  "guess",
]);

function getQuestionPictureProblem(lessons: LessonSpec[]): string | null {
  const shown = lessons
    .flatMap((lesson) => lesson.screens)
    .some((screen) => QUESTION_KINDS.has(screen.kind) && screen.visual);

  return shown
    ? null
    : "No question shows a picture, so the learner never answers by looking at what the lesson teaches them to recognize.";
}

function checkExpected({
  expected,
  lessons,
}: {
  expected: LessonSpecExpected | undefined;
  lessons: LessonSpec[];
}): { count: number; problems: string[] } {
  const results = [
    expected?.pictures === "some" || expected?.pictures === "none"
      ? getPictureProblem({ expected, lessons })
      : undefined,
    (expected?.avoidTemplates?.length ?? 0) > 0
      ? getTemplateProblem({ expected, lessons })
      : undefined,
    expected?.questionPicture ? getQuestionPictureProblem(lessons) : undefined,
  ].filter((result) => result !== undefined);

  return { count: results.length, problems: results.filter((result) => result !== null) };
}

function checkLessonSpecs({
  expected,
  level,
  novice,
  output,
}: {
  expected: LessonSpecExpected | undefined;
  level: LessonLevel;
  novice: boolean;
  output: string;
}): CodeCheckResult {
  const lessons = parseLessons(output);

  const results = lessons.map((lesson, index) => ({
    lesson,
    problems: getLessonSpecIssues({ level, novice, spec: lesson }).map(
      (issue) => `Lesson ${index + 1} ("${lesson.title}"): ${issue.detail}`,
    ),
  }));

  const passing = results.filter((result) => result.problems.length === 0);
  const expectedChecks = checkExpected({ expected, lessons });

  return {
    judgedOutput: JSON.stringify({ lessons: passing.map((result) => result.lesson) }, null, 2),
    passed:
      passing.length === 0
        ? 0
        : passing.length + expectedChecks.count - expectedChecks.problems.length,
    problems:
      lessons.length === 0
        ? ["The output has no valid lesson specs."]
        : [...results.flatMap((result) => result.problems), ...expectedChecks.problems],
    total: Math.max(lessons.length, 1) + expectedChecks.count,
  };
}

export const checkLessonSpecOutput: TaskCodeChecks<LessonSpecExpected> = ({ output, testCase }) => {
  const level = getLevel(testCase.userInput);
  const { exams, material } = testCase.userInput;
  const materialText = typeof material === "string" ? material : undefined;

  const novice = readsNoviceRules({
    exams: Array.isArray(exams) ? exams : [],
    level,
    material: materialText,
  });

  return checkLessonSpecs({ expected: testCase.expected, level, novice, output });
};

export const scoreLessonSpec: TaskScorer<LessonSpecExpected> = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkLessonSpecOutput({ output: value, testCase }),
    output,
    scoreCategories: LESSON_SPEC_SCORE_CATEGORIES,
    testCase,
  });
