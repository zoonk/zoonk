import { type Task } from "@/lib/types";
import {
  type LanguageLessonActivities,
  generateLanguageLessonActivities,
} from "@zoonk/ai/tasks/language/language-lesson";
import { PLAIN_LANGUAGE_CRITERION, readCriteria } from "../plain-language-criterion";
import {
  LANGUAGE_LESSON_ACTIVITIES_SCORE_CATEGORIES,
  checkLanguageLessonActivities,
  scoreLanguageLessonActivities,
} from "./scorer";
import {
  type LanguageLessonActivitiesExpected,
  type LanguageLessonActivitiesInput,
  TEST_CASES,
} from "./test-cases";

export const languageLessonActivitiesTask: Task<
  LanguageLessonActivitiesInput,
  LanguageLessonActivities,
  LanguageLessonActivitiesExpected
> = {
  codeChecks: checkLanguageLessonActivities,
  criteria: readCriteria(LANGUAGE_LESSON_ACTIVITIES_SCORE_CATEGORIES, PLAIN_LANGUAGE_CRITERION),
  description:
    "Add the dialogue and pattern table a published language lesson lacks, from its own words, sentences and tip, or neither where they don't fit",
  generate: generateLanguageLessonActivities,
  id: "language-lesson-activities",
  name: "Language lesson activities",
  priorities: {
    distribution: "shared",
    first: "quality",
    reads: "A checker and a staff approver read the screens, then learners do",
    reason: "The screens join a shared lesson every learner of the pair reads",
    waits: "A staff person drafting a batch of fixes",
  },
  score: scoreLanguageLessonActivities,
  scoreCategories: LANGUAGE_LESSON_ACTIVITIES_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
