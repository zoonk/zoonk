import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { defineScoreCategories } from "@/lib/score-categories";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { type writeLessonActivities } from "@zoonk/ai/tasks/lesson-writer/activities";
import { checkWrittenActivities } from "@zoonk/core/library/lessons/written-activities";
import { publishedLesson } from "../lesson-activity-plan/published-lessons";
import { type LessonActivitiesInput } from "./test-cases";

export const LESSON_ACTIVITIES_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations:
      "Every answer, output, trace and explanation is correct, and the check grades what the learner did. Score at most 5 for a wrong answer or an explanation that says something false.",
    id: "accuracy",
    label: "Accuracy",
    weight: 40,
  },
  {
    expectations:
      "The activity follows its brief and fits the lesson as it stands: its situation, names, numbers and notation, using only what earlier screens taught. In a codeRunner, the edited line is the lesson's move, the starter code doesn't already print the expected output, only the right edit prints it, and each likely mistake prints something else with feedback that names that mistake. The prompt says what to do with the content in one sentence, never how to work the screen and never the expected output.",
    id: "fitsLesson",
    label: "Fits the lesson and the template",
    weight: 40,
  },
  {
    expectations:
      "Learner-facing text is short, warm and plain, in the lesson's language, with code set as code.",
    id: "style",
    label: "Language and style",
    weight: 20,
  },
]);

type Output = Awaited<ReturnType<typeof writeLessonActivities>>["data"];

export const checkLessonActivities: TaskCodeChecks = async ({ output, testCase }) => {
  const input = testCase.userInput as LessonActivitiesInput;
  const indexes = input.activities.map(({ screen }) => screen - 1);

  const checked = await checkWrittenActivities({
    indexes,
    language: publishedLesson(input.lessonId).language,
    written: JSON.parse(output) as Output,
  });

  const problems = checked.flatMap(({ index, problems: found }) =>
    found.map((problem) => `Screen ${index + 1}: ${problem}`),
  );

  return {
    judgedOutput: JSON.stringify(
      checked.map(({ converted, index }) => ({
        screen: index + 1,
        ...(converted.ok ? { content: converted.content } : {}),
      })),
    ),
    passed: checked.filter(({ problems: found }) => found.length === 0).length,
    problems,
    total: checked.length,
  };
};

export const scoreLessonActivities: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkLessonActivities({ output: value, testCase }),
    output,
    scoreCategories: LESSON_ACTIVITIES_SCORE_CATEGORIES,
    testCase,
  });
