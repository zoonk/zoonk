import "server-only";
import { type CallReuse, type ServiceTier } from "@zoonk/ai/provider-options";
import { writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { logError } from "@zoonk/utils/logger";
import { holdBackLessonDraft } from "../generation/hold-back-lesson";
import { type LessonGateProblem } from "../quality/lesson-quality-gate";
import { getReasoningCheckReason } from "../quality/reasoning-check-policy";
import {
  type LessonAnalytics,
  checkVersion,
  getLessonDocuments,
  toScreensToSave,
} from "./_utils/checked-version";
import { pickDraftWriter } from "./_utils/draft-writer";
import { loadLessonWritingInputs, toWritingContext } from "./_utils/lesson-writing-inputs";
import { saveLessonContent } from "./_utils/save-lesson-content";

export type LessonCheckPlan = {
  cite: boolean;
  lesson: WrittenLesson;
  review: boolean;
  version: number;
  writerModel: string;
};

type WriteLessonContentResult =
  | { status: "notClaimed" }
  | { status: "missingSpec" }
  | { status: "heldBack"; problems: LessonGateProblem[] }
  | { check: LessonCheckPlan; fixed: boolean; status: "published"; stepCount: number };

const PRIVATE_FIX_PASSES = 2;

/** Internal workflow bridge: the caller must hold the lesson's content claim and dispatch returned background checks. */
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
}): Promise<WriteLessonContentResult> {
  const state = await loadLessonWritingInputs({ lessonId, workflowRunId });

  if (state.status !== "ready") {
    return state;
  }

  const { inputs } = state;
  const context = toWritingContext(inputs);
  const taskAnalytics = { contentScope: "shared" as const, traceId: workflowRunId, ...analytics };

  const writer = pickDraftWriter({ heldBackDrafts: inputs.heldBackDrafts });

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

  const checked = await checkVersion({
    draft: {
      lesson: draft.data,
      provenanceByScreen: draft.data.screens.map(() => draft.provenance),
    },
    fixPasses: reusable ? 1 : PRIVATE_FIX_PASSES,
    gate: { analytics: taskAnalytics, context, reuse, serviceTier, writerModel },
    review: false,
  });

  if (checked.status === "heldBack") {
    logError(`[lessons] Lesson ${lessonId} held back after its fix pass:`, checked.problems);

    await holdBackLessonDraft({
      lessonId,
      model: writerModel,
      problems: checked.problems.map(({ problem, screen }) => ({ problem, screen })),
      workflowRunId,
    });

    return { problems: checked.problems, status: "heldBack" };
  }

  const screens = toScreensToSave({
    citations: [],
    inputs,
    screens: checked.screens,
    version: checked.version,
  });

  const version = await saveLessonContent({
    language: inputs.language,
    lessonId,
    screens,
    summary: checked.version.lesson.summary.map((idea) => idea.trim()),
    workflowRunId,
  });

  if (version === null) {
    return { status: "notClaimed" };
  }

  return {
    check: { cite, lesson: checked.version.lesson, review, version, writerModel },
    fixed: checked.fixed,
    status: "published",
    stepCount: screens.length,
  };
}
