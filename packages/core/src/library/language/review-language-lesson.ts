import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type ServedSpeed, type ServiceTier } from "@zoonk/ai/provider-options";
import {
  type FixLanguageLessonParams,
  type LanguageLessonContent,
  fixLanguageLesson,
} from "@zoonk/ai/tasks/language/language-lesson";
import { checkLanguageLesson } from "@zoonk/ai/tasks/language/language-lesson-check";
import { holdBackLessonDraft } from "../generation/hold-back-lesson";
import { listLanguageReviewScreens } from "./_utils/language-review-screens";
import {
  type LanguageLessonDraft,
  cleanWrittenLanguageLesson,
} from "./write-language-lesson-content";

type Analytics = Parameters<typeof checkLanguageLesson>[0]["analytics"];

/** `screen` indexes the screens learners see, or is null for the whole lesson. */
export type LessonProblem = FixLanguageLessonParams["problems"][number];

type ReviewContext = {
  analytics?: Analytics;
  draft: LanguageLessonDraft;
  serviceTier?: ServiceTier;
};

export type LanguageLessonFix =
  | { status: "unchanged" }
  | { status: "unfixed" }
  | { draft: LanguageLessonDraft; status: "fixed" };

function listScreens({
  inputs,
  lesson,
}: {
  inputs: LanguageLessonDraft["inputs"];
  lesson: LanguageLessonContent;
}) {
  return listLanguageReviewScreens({
    content: lesson,
    learnerLanguage: inputs.learnerLanguage,
    targetLanguage: inputs.targetLanguage,
  });
}

/** Internal workflow bridge: the errors in a written lesson, before anyone sees it. */
export async function reviewLanguageLessonDraft(context: ReviewContext): Promise<LessonProblem[]> {
  const { draft } = context;

  const { data } = await checkLanguageLesson({
    ...draft.inputs.writerInput,
    analytics: context.analytics,
    screens: listScreens(draft),
    serviceTier: context.serviceTier,
    writerModel: draft.provenance.model,
  });

  return data.issues.map((issue) => ({
    problem: `${issue.problem} Fix: ${issue.fix}`,
    screen: issue.screen,
    source: "review" as const,
  }));
}

/**
 * Internal workflow bridge: the lesson's writer fixes what `problems` name. It may leave the lesson
 * unchanged when it finds them wrong; its answer is final.
 */
export async function fixLanguageLessonDraft({
  problems,
  speed,
  ...context
}: ReviewContext & { problems: LessonProblem[]; speed?: ServedSpeed }): Promise<LanguageLessonFix> {
  const { draft } = context;

  const { data, provenance } = await fixLanguageLesson({
    ...draft.inputs.writerInput,
    analytics: context.analytics,
    lesson: draft.lesson,
    model: draft.provenance.model,
    problems,
    screens: listScreens(draft),
    serviceTier: context.serviceTier,
    speed,
  });

  const lesson = cleanWrittenLanguageLesson({ content: data, inputs: draft.inputs });

  if (!lesson) {
    return { status: "unfixed" };
  }

  return isDeepStrictEqual(lesson, draft.lesson)
    ? { status: "unchanged" }
    : { draft: { ...draft, lesson, provenance }, status: "fixed" };
}

/**
 * Internal workflow bridge: what still blocks the fixed lesson. A finding the writer saw on a screen
 * it left unchanged is final, matched by screen, not wording; a lesson-wide finding always blocks.
 */
export async function reviewLanguageLessonFix({
  fixed,
  flaggedScreens,
  ...context
}: ReviewContext & { fixed: LanguageLessonDraft; flaggedScreens: (number | null)[] }): Promise<
  LessonProblem[]
> {
  const before = listScreens(context.draft);
  const after = listScreens(fixed);
  const problems = await reviewLanguageLessonDraft({ ...context, draft: fixed });

  return problems.filter(
    ({ screen }) =>
      screen === null ||
      !flaggedScreens.includes(screen) ||
      !isDeepStrictEqual(before[screen], after[screen]),
  );
}

/** Internal workflow bridge: keeps a lesson its fix couldn't clear from learners, for a redraft. */
export async function holdBackLanguageLessonDraft({
  draft,
  lessonId,
  problems,
  workflowRunId,
}: {
  draft: LanguageLessonDraft;
  lessonId: string;
  problems: LessonProblem[];
  workflowRunId: string;
}): Promise<void> {
  await holdBackLessonDraft({
    lessonId,
    model: draft.provenance.model,
    problems: problems.map(({ problem, screen }) => ({ problem, screen })),
    workflowRunId,
  });
}
