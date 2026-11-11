import "server-only";
import { isDeepStrictEqual } from "node:util";
import {
  type FixLanguageLessonParams,
  type LanguageLessonContent,
  fixLanguageLesson,
} from "@zoonk/ai/tasks/language/language-lesson";
import { checkLanguageLesson } from "@zoonk/ai/tasks/language/language-lesson-check";
import { type LibraryProvenance } from "../_utils/library-rows";
import { readCurrentLessonVersion } from "../lessons/lesson-versions";
import { BACKGROUND_TIER } from "../quality/_utils/published-versions";
import { listLanguageReviewScreens } from "./_utils/language-review-screens";
import { republishLanguageLesson } from "./_utils/save-language-lesson";
import {
  type LanguageLessonCheckPlan,
  cleanWrittenLanguageLesson,
  storeLanguageLesson,
} from "./write-language-lesson-content";

type Analytics = Parameters<typeof checkLanguageLesson>[0]["analytics"];

/** `screen` indexes the screens learners see, or is null for the whole lesson. */
export type LessonProblem = FixLanguageLessonParams["problems"][number];

type ReviewContext = {
  analytics?: Analytics;
  lessonId: string;
  plan: LanguageLessonCheckPlan;
  workflowRunId: string;
};

export type LanguageLessonFix =
  | { status: "replaced" | "unchanged" | "unfixed" }
  | { lesson: LanguageLessonContent; provenance: LibraryProvenance; status: "fixed" };

function toTaskAnalytics({ analytics, workflowRunId }: ReviewContext): Analytics {
  return { ...analytics, contentScope: "shared", traceId: workflowRunId };
}

function listScreens({
  lesson,
  plan,
}: {
  lesson: LanguageLessonContent;
  plan: LanguageLessonCheckPlan;
}) {
  return listLanguageReviewScreens({
    content: lesson,
    learnerLanguage: plan.inputs.learnerLanguage,
    targetLanguage: plan.inputs.targetLanguage,
  });
}

async function isReplaced({ lessonId, plan }: ReviewContext): Promise<boolean> {
  return (await readCurrentLessonVersion(lessonId)) !== plan.version;
}

async function review({
  context,
  lesson,
}: {
  context: ReviewContext;
  lesson: LanguageLessonContent;
}): Promise<LessonProblem[]> {
  const { plan } = context;

  const { data } = await checkLanguageLesson({
    ...plan.inputs.writerInput,
    analytics: toTaskAnalytics(context),
    screens: listScreens({ lesson, plan }),
    serviceTier: BACKGROUND_TIER,
    writerModel: plan.writerModel,
  });

  return data.issues.map((issue) => ({
    problem: `${issue.problem} Fix: ${issue.fix}`,
    screen: issue.screen,
    source: "review" as const,
  }));
}

/** Internal workflow bridge: null when the plan's version is no longer the one learners get. */
export async function reviewLanguageLesson(
  context: ReviewContext,
): Promise<LessonProblem[] | null> {
  if (await isReplaced(context)) {
    return null;
  }

  return review({ context, lesson: context.plan.lesson });
}

/**
 * Internal workflow bridge: the lesson's writer fixes what `problems` name. It may leave the lesson
 * unchanged when it finds them wrong; its answer is final.
 */
export async function writeLanguageLessonFix({
  problems,
  ...context
}: ReviewContext & { problems: LessonProblem[] }): Promise<LanguageLessonFix> {
  if (await isReplaced(context)) {
    return { status: "replaced" };
  }

  const { plan } = context;

  const { data, provenance } = await fixLanguageLesson({
    ...plan.inputs.writerInput,
    analytics: toTaskAnalytics(context),
    lesson: plan.lesson,
    model: plan.writerModel,
    problems,
    screens: listScreens({ lesson: plan.lesson, plan }),
    serviceTier: BACKGROUND_TIER,
  });

  const fixed = cleanWrittenLanguageLesson({ content: data, inputs: plan.inputs });

  if (!fixed) {
    return { status: "unfixed" };
  }

  return isDeepStrictEqual(fixed, plan.lesson)
    ? { status: "unchanged" }
    : { lesson: fixed, provenance, status: "fixed" };
}

/**
 * Internal workflow bridge: what still blocks the fixed lesson, or null when the plan's version was
 * replaced. A finding the writer saw on a screen it left unchanged is final, matched by screen, not
 * wording; a lesson-wide finding always blocks.
 */
export async function reviewLanguageLessonFix({
  fixed,
  flaggedScreens,
  ...context
}: ReviewContext & { fixed: LanguageLessonContent; flaggedScreens: (number | null)[] }): Promise<
  LessonProblem[] | null
> {
  if (await isReplaced(context)) {
    return null;
  }

  const before = listScreens({ lesson: context.plan.lesson, plan: context.plan });
  const after = listScreens({ lesson: fixed, plan: context.plan });
  const problems = await review({ context, lesson: fixed });

  return problems.filter(
    ({ screen }) =>
      screen === null ||
      !flaggedScreens.includes(screen) ||
      !isDeepStrictEqual(before[screen], after[screen]),
  );
}

/** Internal workflow bridge: null when the plan's version is no longer the one learners get. */
export async function publishLanguageLessonFix({
  lessonId,
  plan,
  provenance,
  lesson,
}: {
  lesson: LanguageLessonContent;
  lessonId: string;
  plan: LanguageLessonCheckPlan;
  provenance: LibraryProvenance;
}): Promise<number | null> {
  if ((await readCurrentLessonVersion(lessonId)) !== plan.version) {
    return null;
  }

  const rows = await storeLanguageLesson({
    content: lesson,
    inputs: plan.inputs,
    lessonId,
    provenance,
  });

  return republishLanguageLesson({ ...rows, replaces: plan.version });
}
