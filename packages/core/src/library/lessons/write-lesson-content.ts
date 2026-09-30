import "server-only";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer/fix";
import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { citeMaterial } from "@zoonk/ai/tasks/v2/material/cite";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type LibraryProvenance } from "../_utils/library-rows";
import { holdBackLessonDraft } from "../generation/hold-back-lesson";
import { type LessonGateProblem, runLessonQualityGate } from "../quality/lesson-quality-gate";
import { getReasoningCheckReason } from "../quality/reasoning-check-policy";
import { formatMaterialPages } from "../sources/material-pages";
import { type ConvertedScreen } from "../steps/written-screens";
import { pickDraftWriter } from "./_utils/draft-writer";
import {
  type LessonWritingInputs,
  loadLessonWritingInputs,
  toWritingContext,
} from "./_utils/lesson-writing-inputs";
import { type LessonScreenToSave, saveLessonContent } from "./_utils/save-lesson-content";
import {
  type ScreenCitation,
  describeWrittenScreen,
  toScreenCitations,
} from "./_utils/screen-citations";

type Analytics = Parameters<typeof writeLessonDraft>[0]["analytics"];

type WriteLessonContentResult =
  | { status: "notClaimed" }
  | { status: "missingSpec" }
  | { status: "heldBack"; problems: LessonGateProblem[] }
  | { status: "published"; fixed: boolean; reviewed: boolean; stepCount: number };

type WrittenVersion = {
  lesson: WrittenLesson;
  /** The run that wrote each screen: the draft's, or the fix pass's for screens it changed. */
  provenanceByScreen: LibraryProvenance[];
};

function toScreensToSave({
  citations,
  inputs,
  screens,
  version,
}: {
  citations: readonly (ScreenCitation | null)[];
  inputs: LessonWritingInputs;
  screens: readonly ConvertedScreen[];
  version: WrittenVersion;
}): LessonScreenToSave[] {
  return screens.flatMap((screen, index) => {
    const provenance = version.provenanceByScreen[index];
    const skillIndex = inputs.spec.screens[index]?.skills[0];

    if (!screen.ok || !provenance) {
      return [];
    }

    return [
      {
        citation: citations[index] ?? null,
        content: screen.content,
        kind: screen.kind,
        mathItem: screen.mathItem,
        provenance,
        skillId: skillIndex === undefined ? null : (inputs.skillIds[skillIndex] ?? null),
      },
    ];
  });
}

/** The pages a lesson was written from: the learner's material, or public sources' passages. */
function getLessonDocuments(inputs: LessonWritingInputs) {
  return inputs.material.length > 0 ? inputs.material : inputs.sources;
}

/**
 * A lesson built from the learner's material, or from public sources (a law, an exam notice),
 * cites a page on every screen it can. Citing is a nicety: when the model call fails, the lesson
 * is published without citations.
 */
async function citeScreens({
  analytics,
  inputs,
  lesson,
}: {
  analytics: Analytics;
  inputs: LessonWritingInputs;
  lesson: WrittenLesson;
}): Promise<(ScreenCitation | null)[]> {
  const pages = getLessonDocuments(inputs);

  if (pages.length === 0) {
    return [];
  }

  const { data } = await safeAsync(() =>
    citeMaterial({
      analytics,
      material: formatMaterialPages(pages),
      screens: lesson.screens.map((screen) => describeWrittenScreen(screen)),
    }),
  );

  return toScreenCitations({
    citations: data?.data.citations ?? [],
    pages,
    screenCount: lesson.screens.length,
  });
}

async function publish({
  analytics,
  inputs,
  lessonId,
  screens,
  version,
  workflowRunId,
}: {
  analytics: Analytics;
  inputs: LessonWritingInputs;
  lessonId: string;
  screens: readonly ConvertedScreen[];
  version: WrittenVersion;
  workflowRunId: string;
}): Promise<{ saved: boolean; stepCount: number }> {
  const citations = await citeScreens({ analytics, inputs, lesson: version.lesson });
  const toSave = toScreensToSave({ citations, inputs, screens, version });

  const saved = await saveLessonContent({
    language: inputs.language,
    lessonId,
    screens: toSave,
    summary: version.lesson.summary.map((idea) => idea.trim()),
    workflowRunId,
  });

  return { saved, stepCount: toSave.length };
}

/**
 * Writes a lesson's content from its stored spec, for the workflow run that
 * holds the lesson's content claim: the writer drafts every screen, the
 * quality gate checks it (code checks always; the cross-family reasoning check
 * on advanced, exam and high-stakes lessons and a sample of the rest), one fix
 * pass repairs what failed and the gate runs again. A lesson that passes is
 * published with its summary card and math items, each screen carrying the
 * provenance of the run that wrote it; one that still fails is held back: no
 * steps are written, the claim ends as failed and the draft is recorded, so the
 * next draft is told what held it back (`pickDraftWriter` picks its writer).
 *
 * This is an internal workflow bridge: Library content is shared and no
 * learner's data is written.
 */
export async function writeLessonContent({
  analytics,
  forExam = false,
  forceReview = false,
  lessonId,
  model,
  priority = false,
  workflowRunId,
}: {
  analytics?: Analytics;
  /** The lesson is being made for an exam goal, so the reasoning check always runs. */
  forExam?: boolean;
  /** A rewrite of a lesson that failed a later check: the reasoning check always runs. */
  forceReview?: boolean;
  lessonId: string;
  /** The writer model, when not the task's default: private courses use a cheaper one. */
  model?: string;
  /**
   * A learner is waiting on this lesson (a new goal's first lesson, or one opened before it was
   * written): the writer, reviewer and fix pass answer at the priority tier.
   */
  priority?: boolean;
  workflowRunId: string;
}): Promise<WriteLessonContentResult> {
  const state = await loadLessonWritingInputs({ lessonId, workflowRunId });

  if (state.status !== "ready") {
    return state;
  }

  const { inputs } = state;
  const context = toWritingContext(inputs);
  const taskAnalytics = { contentScope: "shared" as const, traceId: workflowRunId, ...analytics };
  const serviceTier: ServiceTier | undefined = priority ? "priority" : undefined;

  const writer = pickDraftWriter({ heldBackDrafts: inputs.heldBackDrafts, model });

  const draft = await writeLessonDraft({
    ...context,
    analytics: taskAnalytics,
    heldBackProblems: writer.heldBackProblems,
    model: writer.model,
    serviceTier,
  });

  const writerModel = draft.provenance.model;

  // A lesson built from the learner's material or from sources is always reviewed: it must match them.
  const review =
    forceReview ||
    getLessonDocuments(inputs).length > 0 ||
    getReasoningCheckReason({
      categories: inputs.categories,
      forExam,
      lesson: draft.data,
      level: inputs.level,
    }) !== null;

  const gate = { analytics: taskAnalytics, context, review, serviceTier, writerModel };
  const first = await runLessonQualityGate({ ...gate, lesson: draft.data });

  const draftVersion: WrittenVersion = {
    lesson: draft.data,
    provenanceByScreen: draft.data.screens.map(() => draft.provenance),
  };

  if (first.blocking.length === 0) {
    const published = await publish({
      analytics: taskAnalytics,
      inputs,
      lessonId,
      screens: first.screens,
      version: draftVersion,
      workflowRunId,
    });

    return published.saved
      ? { fixed: false, reviewed: review, status: "published", stepCount: published.stepCount }
      : { status: "notClaimed" };
  }

  const fix = await fixLessonDraft({
    ...context,
    analytics: taskAnalytics,
    lesson: draft.data,
    problems: [...first.blocking, ...first.minor],
    serviceTier,
  });

  const changed = new Set(fix.data.changedScreens);

  const fixedVersion: WrittenVersion = {
    lesson: fix.data.lesson,
    provenanceByScreen: fix.data.lesson.screens.map((_, index) =>
      changed.has(index) ? fix.provenance : draft.provenance,
    ),
  };

  const second = await runLessonQualityGate({
    ...gate,
    afterFix: true,
    allowActivityFallback: true,
    lesson: fix.data.lesson,
  });

  if (second.blocking.length > 0) {
    logError(`[lessons] Lesson ${lessonId} held back after its fix pass:`, second.blocking);

    await holdBackLessonDraft({
      lessonId,
      model: writerModel,
      problems: second.blocking.map(({ problem, screen }) => ({ problem, screen })),
      workflowRunId,
    });

    return { problems: second.blocking, status: "heldBack" };
  }

  const published = await publish({
    analytics: taskAnalytics,
    inputs,
    lessonId,
    screens: second.screens,
    version: fixedVersion,
    workflowRunId,
  });

  return published.saved
    ? { fixed: true, reviewed: review, status: "published", stepCount: published.stepCount }
    : { status: "notClaimed" };
}
