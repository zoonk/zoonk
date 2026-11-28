import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { defineScoreCategories } from "@/lib/score-categories";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { type LanguageLessonActivities } from "@zoonk/ai/tasks/language/language-lesson";
import { listDroppedLanguageActivities } from "@zoonk/core/library/language/activities";
import {
  type LanguageLessonActivitiesExpected,
  type LanguageLessonActivitiesInput,
} from "./test-cases";

const TEMPLATES = ["dialogue", "patternTable"] as const;

export const LANGUAGE_LESSON_ACTIVITIES_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Every target-language line, reply and form is grammatical, natural and in the requested variant, and every translation has exactly its meaning. Each reply's "why" and the explanation say only true things. In a table, every model and answer form is right for its row. Score at most 5 for a wrong form, a wrong translation or a false reason.`,
    id: "accuracy",
    label: "Accuracy",
    weight: 40,
  },
  {
    expectations: `The screens build on this lesson as it stands: its words, sentences and tip, at its level, with the polite or informal form its situation calls for. A dialogue has exactly one best reply, answering the other person's last line, and every other reply is wrong there for one reason a learner would fall for. A table practices the tip's own set of endings. The explanation is a takeaway for the next conversation and doesn't repeat the best reply's reason. Score at most 6 for a screen that teaches something the lesson didn't, or a wrong reply that would also be fine to say.`,
    id: "fitsLesson",
    label: "Fits the lesson",
    weight: 40,
  },
  {
    expectations: `Text in the learner's language (scene, prompt, reasons, explanation, meanings) is short, natural and in that language, and target-language fields hold no learner-language words.`,
    id: "style",
    label: "Language and style",
    weight: 20,
  },
]);

function parseActivities(output: string): LanguageLessonActivities | null {
  try {
    return JSON.parse(output) as LanguageLessonActivities;
  } catch {
    return null;
  }
}

export const checkLanguageLessonActivities: TaskCodeChecks<LanguageLessonActivitiesExpected> = ({
  output,
  testCase,
}) => {
  const input = testCase.userInput as LanguageLessonActivitiesInput;
  const activities = parseActivities(output);

  if (!activities) {
    const problems = ["The output isn't a table and a dialogue."];
    return { blockingProblems: problems, judgedOutput: output, passed: 0, problems, total: 1 };
  }

  const misplaced = TEMPLATES.flatMap((template) => {
    const expected = testCase.expected?.[template];
    const written = activities[template] !== null;

    if (expected === undefined || expected === written) {
      return [];
    }

    return [
      expected ? `The lesson needs a ${template}.` : `The lesson has no place for a ${template}.`,
    ];
  });

  const dropped = listDroppedLanguageActivities({
    content: activities,
    targetLanguage: input.targetLanguage,
  });

  const problems = [...misplaced, ...dropped];

  return {
    judgedOutput: output,
    passed: TEMPLATES.length - Math.min(problems.length, TEMPLATES.length),
    problems,
    total: TEMPLATES.length,
  };
};

export const scoreLanguageLessonActivities: TaskScorer<LanguageLessonActivitiesExpected> = ({
  output,
  testCase,
}) =>
  scoreWithCodeChecks({
    check: (value) => checkLanguageLessonActivities({ output: value, testCase }),
    output,
    scoreCategories: LANGUAGE_LESSON_ACTIVITIES_SCORE_CATEGORIES,
    testCase,
  });
