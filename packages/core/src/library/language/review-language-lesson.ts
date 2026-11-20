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
import { recordLessonQualityDecision } from "../quality/lesson-quality-decision";
import { toReviewProblems } from "../quality/lesson-review-problems";
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
async function checkLanguageDraft(context: ReviewContext) {
  const { draft } = context;

  const { data, provenance } = await checkLanguageLesson({
    ...draft.inputs.writerInput,
    analytics: context.analytics,
    screens: listScreens(draft),
    serviceTier: context.serviceTier,
    writerModel: draft.provenance.model,
  });

  return { problems: toReviewProblems(data.issues), reviewerRunId: provenance.runId };
}

function toEvidenceProblem({ problem, screen, source }: LessonProblem) {
  return { problem, screen, source: source === "check" ? ("code" as const) : ("review" as const) };
}

type LessonClaim = { lessonId: string; workflowRunId: string };
type ClaimedReview = ReviewContext & { claim?: LessonClaim };

function recordLanguageReview({
  blocking,
  claim,
  outcome,
  phase,
  reviewerRunId,
  writerRunId,
}: {
  blocking?: LessonProblem[];
  claim?: LessonClaim;
  outcome: "passed" | "needsFix" | "heldBack";
  phase: "firstReview" | "recheck";
  reviewerRunId?: string;
  writerRunId: string;
}) {
  if (!claim) {
    return;
  }

  return recordLessonQualityDecision({
    evidence: {
      attemptKey: claim.workflowRunId,
      blocking: blocking?.map((problem) => toEvidenceProblem(problem)),
      phase,
      reviewerRunId,
      writerRunId,
    },
    lessonId: claim.lessonId,
    outcome,
  });
}

export async function reviewLanguageLessonDraft(context: ClaimedReview): Promise<LessonProblem[]> {
  const { problems, reviewerRunId } = await checkLanguageDraft(context);

  await recordLanguageReview({
    blocking: problems,
    claim: context.claim,
    outcome: problems.length === 0 ? "passed" : "needsFix",
    phase: "firstReview",
    reviewerRunId,
    writerRunId: context.draft.provenance.runId,
  });

  return problems;
}

/**
 * Internal workflow bridge: the lesson's writer fixes what `problems` name. It may leave the lesson
 * unchanged when it finds them wrong; its answer is final.
 */
export async function fixLanguageLessonDraft({
  problems,
  speed,
  ...context
}: ClaimedReview & { problems: LessonProblem[]; speed?: ServedSpeed }): Promise<LanguageLessonFix> {
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

  if (isDeepStrictEqual(lesson, draft.lesson)) {
    await recordLanguageReview({
      claim: context.claim,
      outcome: "passed",
      phase: "recheck",
      writerRunId: draft.provenance.runId,
    });

    return { status: "unchanged" };
  }

  return { draft: { ...draft, lesson, provenance }, status: "fixed" };
}

/**
 * Internal workflow bridge: what still blocks the fixed lesson. A finding the writer saw on a screen
 * it left unchanged is final, matched by screen, not wording; a lesson-wide finding always blocks.
 */
export async function reviewLanguageLessonFix({
  fixed,
  flaggedScreens,
  ...context
}: ClaimedReview & { fixed: LanguageLessonDraft; flaggedScreens: (number | null)[] }): Promise<
  LessonProblem[]
> {
  const before = listScreens(context.draft);
  const after = listScreens(fixed);
  const { problems, reviewerRunId } = await checkLanguageDraft({ ...context, draft: fixed });

  const remaining = problems.filter(
    ({ screen }) =>
      screen === null ||
      !flaggedScreens.includes(screen) ||
      !isDeepStrictEqual(before[screen], after[screen]),
  );

  await recordLanguageReview({
    blocking: problems,
    claim: context.claim,
    outcome: remaining.length === 0 ? "passed" : "heldBack",
    phase: "recheck",
    reviewerRunId,
    writerRunId: context.draft.provenance.runId,
  });

  return remaining;
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
    evidence: {
      attemptKey: workflowRunId,
      blocking: problems.map((problem) => toEvidenceProblem(problem)),
      phase: "disposition",
      writerRunId: draft.provenance.runId,
    },
    lessonId,
    model: draft.provenance.model,
    problems: problems.map(({ problem, screen }) => ({ problem, screen })),
    workflowRunId,
  });
}
