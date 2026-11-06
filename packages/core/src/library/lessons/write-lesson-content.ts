import "server-only";
import { type CallReuse, type ServiceTier } from "@zoonk/ai/provider-options";
import { writeLessonDraft } from "@zoonk/ai/tasks/lesson-writer";
import { type WrittenLesson } from "@zoonk/ai/tasks/lesson-writer/schema";
import { logError } from "@zoonk/utils/logger";
import { holdBackLessonDraft } from "../generation/hold-back-lesson";
import { type LessonGateProblem, runLessonQualityGate } from "../quality/lesson-quality-gate";
import { repairWrittenLesson } from "../quality/lesson-repairs";
import { getReasoningCheckReason } from "../quality/reasoning-check-policy";
import {
  type GateResult,
  type LessonAnalytics,
  type LessonGate,
  type WrittenVersion,
  checkFixedLesson,
  fixVersionDraft,
  getLessonDocuments,
  toScreensToSave,
} from "./_utils/checked-version";
import { pickDraftWriter } from "./_utils/draft-writer";
import {
  type LessonWritingInputs,
  loadLessonWritingInputs,
  toWritingContext,
} from "./_utils/lesson-writing-inputs";
import { saveLessonContent } from "./_utils/save-lesson-content";

export type LessonCheckPlan = {
  cite: boolean;
  lesson: WrittenLesson;
  review: boolean;
  version: number;
  writerModel: string;
};

type LessonContentOutcome =
  | { status: "notClaimed" }
  | { status: "missingSpec" }
  | { status: "heldBack"; problems: LessonGateProblem[] }
  | { check: LessonCheckPlan; fixed: boolean; status: "published"; stepCount: number };

export type LessonDraftState = {
  cite: boolean;
  gate: LessonGate;
  inputs: LessonWritingInputs;
  previous: { first: GateResult; lesson: WrittenLesson } | null;
  remainingFixes: number;
  review: boolean;
  version: WrittenVersion;
};

export type LessonDraftToFix = { draft: LessonDraftState; first: GateResult; status: "needsFix" };

/**
 * A private lesson serves one learner, so it gets no model review: a second fix pass on what the
 * code checks flag stands in for it.
 */
const PRIVATE_FIX_PASSES = 2;

/**
 * Internal workflow bridge: the caller must hold the lesson's content claim, report the lesson
 * ready once it's saved (`completeLessonContent`) and dispatch returned background checks.
 */
export async function writeLessonContent({
  analytics,
  forExam = false,
  forceReview = false,
  lessonId,
  reuse = "bounded",
  serviceTier,
  workflowRunId,
}: {
  analytics?: LessonAnalytics;
  forExam?: boolean;
  forceReview?: boolean;
  lessonId: string;
  reuse?: CallReuse;
  serviceTier?: ServiceTier;
  workflowRunId: string;
}): Promise<
  | Extract<LessonContentOutcome, { status: "missingSpec" | "notClaimed" }>
  | { draft: LessonDraftState; status: "drafted" }
> {
  const state = await loadLessonWritingInputs({ lessonId, workflowRunId });

  if (state.status !== "ready") {
    return state;
  }

  const { inputs } = state;
  const context = toWritingContext(inputs);
  const taskAnalytics = { contentScope: "shared" as const, traceId: workflowRunId, ...analytics };

  const writer = pickDraftWriter({ heldBackDrafts: inputs.heldBackDrafts, reuse });

  const draft = await writeLessonDraft({
    ...context,
    analytics: taskAnalytics,
    heldBackProblems: writer.heldBackProblems,
    model: writer.model,
    serviceTier,
  });

  const writerModel = draft.provenance.model;
  const cite = getLessonDocuments(inputs).length > 0;
  const reusable = inputs.ownerId === null;

  const review =
    reusable &&
    (forceReview ||
      cite ||
      getReasoningCheckReason({
        categories: inputs.categories,
        forExam,
        lesson: draft.data,
        level: inputs.level,
      }) !== null);

  return {
    draft: {
      cite,
      gate: { analytics: taskAnalytics, context, reuse, serviceTier, writerModel },
      inputs,
      previous: null,
      remainingFixes: reusable ? 1 : PRIVATE_FIX_PASSES,
      review,
      version: {
        lesson: repairWrittenLesson({
          language: inputs.language,
          lesson: draft.data,
          spec: inputs.spec,
        }),
        provenanceByScreen: draft.data.screens.map(() => draft.provenance),
      },
    },
    status: "drafted",
  };
}

/** Internal workflow bridge; one fix call, with the previous draft carried by its step result. */
export async function fixLessonContent({
  draft,
  first,
}: LessonDraftToFix): Promise<LessonDraftState> {
  const version = await fixVersionDraft({ draft: draft.version, first, gate: draft.gate });

  return {
    ...draft,
    previous: { first, lesson: draft.version.lesson },
    remainingFixes: draft.remainingFixes - 1,
    version,
  };
}

/** Internal workflow bridge; checks and persistence are separate from the paid model calls. */
export async function checkLessonContent({
  draft,
  lessonId,
  workflowRunId,
}: {
  draft: LessonDraftState;
  lessonId: string;
  workflowRunId: string;
}): Promise<LessonContentOutcome | LessonDraftToFix> {
  const { cite, gate, inputs, previous, review, version: written } = draft;

  const checked = previous
    ? await checkFixedLesson({
        draft: previous.lesson,
        first: previous.first,
        fixed: written.lesson,
        gate,
        review: false,
      })
    : await runLessonQualityGate({ ...gate, lesson: written.lesson, review: false });

  if (checked.blocking.length > 0) {
    if (draft.remainingFixes > 0) {
      return { draft, first: checked, status: "needsFix" };
    }

    logError(`[lessons] Lesson ${lessonId} held back after its fix pass:`, checked.blocking);

    await holdBackLessonDraft({
      lessonId,
      model: gate.writerModel,
      problems: checked.blocking.map(({ problem, screen }) => ({ problem, screen })),
      workflowRunId,
    });

    return { problems: checked.blocking, status: "heldBack" };
  }

  const screens = toScreensToSave({
    citations: [],
    inputs,
    screens: checked.screens,
    version: written,
  });

  const version = await saveLessonContent({
    language: inputs.language,
    lessonId,
    screens,
    summary: written.lesson.summary,
    workflowRunId,
  });

  return version === null
    ? { status: "notClaimed" }
    : {
        check: { cite, lesson: written.lesson, review, version, writerModel: gate.writerModel },
        fixed: previous !== null,
        status: "published",
        stepCount: screens.length,
      };
}
