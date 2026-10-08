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

/**
 * What the background check of a version just published needs (`checkPublishedLesson`): the lesson
 * as written, which the reviewer reads and its fix pass rewrites, and what to do.
 */
export type LessonCheckPlan = {
  /** The lesson cites the documents it was written from: citations follow publishing. */
  cite: boolean;
  lesson: WrittenLesson;
  /** The reasoning check reads it (see `getReasoningCheckReason`). */
  review: boolean;
  version: number;
  /** The model that actually wrote it, so the reviewer comes from another family. */
  writerModel: string;
};

type WriteLessonContentResult =
  | { status: "notClaimed" }
  | { status: "missingSpec" }
  | { status: "heldBack"; problems: LessonGateProblem[] }
  | { check: LessonCheckPlan; fixed: boolean; status: "published"; stepCount: number };

/**
 * Writes a lesson's content from its stored spec, for the workflow run that holds the lesson's
 * content claim, and publishes it as soon as the code checks pass: a learner waiting on it never
 * waits on a model check. The writer drafts every screen and the code checks read it (contract,
 * calculations, code in activities, wording, repetition); when they find something, one fix pass
 * repairs it and they run again. A lesson that passes is published with its summary card and math
 * items, each screen carrying the provenance of the run that wrote it; one that still fails is held
 * back: no steps are written, the claim ends as failed and the draft is recorded, so the next
 * draft is told what held it back (`pickDraftWriter` picks its writer).
 *
 * The model checks follow publishing, in the background (the returned `check`): the cross-family
 * reasoning check on advanced, exam, high-stakes and sourced lessons and a sample of the rest, and
 * citations for a lesson written from documents. A problem they find is fixed in a new version
 * (`checkPublishedLesson`).
 *
 * This is an internal workflow bridge: Library content is shared and no learner's data is written.
 */
export async function writeLessonContent({
  analytics,
  forExam = false,
  forceReview = false,
  lessonId,
  model,
  reuse = "bounded",
  serviceTier,
  workflowRunId,
}: {
  analytics?: LessonAnalytics;
  /** The lesson is being made for an exam goal, so the reasoning check always runs. */
  forExam?: boolean;
  /** A rewrite of a lesson that failed a later check: the reasoning check always runs. */
  forceReview?: boolean;
  lessonId: string;
  /** The writer model, when not the task's default: private courses use a cheaper one. */
  model?: string;
  /**
   * How likely the lesson is to be read again (`loadLessonReuse`), which picks its reviewer: the
   * strongest when unset.
   */
  reuse?: CallReuse;
  /**
   * `flex` when the lesson is written well before a learner reaches it (a later study day): the
   * writer and fix pass answer at about half the price.
   */
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

  const writer = pickDraftWriter({ heldBackDrafts: inputs.heldBackDrafts, model });

  const draft = await writeLessonDraft({
    ...context,
    analytics: taskAnalytics,
    heldBackProblems: writer.heldBackProblems,
    model: writer.model,
    serviceTier,
  });

  const writerModel = draft.provenance.model;
  const cite = getLessonDocuments(inputs).length > 0;

  // A lesson built from the learner's material or from sources is always reviewed: it must match them.
  const review =
    forceReview ||
    cite ||
    getReasoningCheckReason({
      categories: inputs.categories,
      forExam,
      lesson: draft.data,
      level: inputs.level,
    }) !== null;

  const checked = await checkVersion({
    draft: {
      lesson: draft.data,
      provenanceByScreen: draft.data.screens.map(() => draft.provenance),
    },
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
