import "server-only";
import { isDeepStrictEqual } from "node:util";
import { writeLessonDraft } from "@zoonk/ai/tasks/lesson-writer";
import { type WrittenLesson } from "@zoonk/ai/tasks/lesson-writer/schema";
import { type HeldBackDraft } from "../generation/held-back-drafts";
import {
  type CheckedVersion,
  type GateResult,
  checkFixedLesson,
  fixVersionDraft,
  readLessonSources,
} from "../lessons/_utils/checked-version";
import { pickDraftWriter } from "../lessons/_utils/draft-writer";
import {
  loadPublishedLessonInputs,
  toWritingContext,
} from "../lessons/_utils/lesson-writing-inputs";
import { publishStagedLessonVersion } from "../lessons/_utils/save-lesson-content";
import { loadLessonReuse } from "../lessons/lesson-reuse";
import { readCurrentLessonVersion, readStagedLessonVersion } from "../lessons/lesson-versions";
import { type LessonCheckPlan } from "../lessons/write-lesson-content";
import {
  BACKGROUND_TIER,
  type CheckContext,
  type PublishedDraftState,
  type PublishedFix,
  loadCheck,
  loadVersionSteps,
  readVersionWriterRunId,
  toHeldBackDraft,
  toProvenance,
  toTaskAnalytics,
} from "./_utils/published-versions";
import {
  recordPublishedReview,
  stageFixedVersion,
  writerRunIdOf,
} from "./_utils/save-published-review";
import { runLessonQualityGate } from "./lesson-quality-gate";
import { repairWrittenLesson } from "./lesson-repairs";

export type PublishedLessonOutcome =
  | { status: "passed" | "replaced" }
  | { savedAt: number; status: "republished"; version: number }
  | { draft: HeldBackDraft; status: "heldBack" };

/** A step run again after staging its fix answers with that fix instead of writing another. */
async function readStagedFix(lessonId: string): Promise<PublishedLessonOutcome | null> {
  const staged = await readStagedLessonVersion(lessonId);
  return staged && { ...staged, status: "republished" };
}

/** Internal workflow bridge; not an app authorization boundary. */
export async function checkPublishedLesson({
  plan,
  ...context
}: CheckContext & { plan: LessonCheckPlan }): Promise<PublishedDraftOutcome> {
  const staged = await readStagedFix(context.lessonId);

  if (staged) {
    return staged;
  }

  const loaded = await loadCheck({ context, version: plan.version, writerModel: plan.writerModel });

  if (!loaded) {
    return { status: "replaced" };
  }

  const { gate, inputs } = loaded;

  const checked = await runLessonQualityGate({ ...gate, lesson: plan.lesson, review: true });

  const first = {
    ...checked,
    blocking: checked.blocking.filter((problem) => problem.source === "review"),
  };

  const versionKey = { lessonId: context.lessonId, version: plan.version };
  const previous = first.blocking.length > 0 ? await loadVersionSteps(versionKey) : [];

  const writerRunId =
    plan.writerRunId ?? previous[0]?.runId ?? (await readVersionWriterRunId(versionKey));

  const state: PublishedDraftState = {
    context,
    gate,
    inputs,
    live: true,
    replaces: plan.version,
    version: {
      lesson: plan.lesson,
      provenanceByScreen: previous.map((step) => toProvenance(step)),
    },
    writerRunId,
  };

  await recordPublishedReview({
    checked,
    needsFix: first.blocking.length > 0,
    phase: "firstReview",
    state,
  });

  return first.blocking.length === 0 ? { status: "passed" } : { first, state, status: "needsFix" };
}

export type PublishedDraftOutcome =
  | PublishedLessonOutcome
  | { first: GateResult; status: "needsFix"; state: PublishedDraftState }
  | { status: "drafted"; state: PublishedDraftState }
  | {
      status: "checked";
      state: PublishedDraftState;
      checked: Extract<CheckedVersion, { status: "passed" }>;
    };

export async function fixPublishedDraft({
  first,
  state,
}: {
  first: GateResult;
  state: PublishedDraftState;
}): Promise<PublishedFix> {
  const version = await fixVersionDraft({ draft: state.version, first, gate: state.gate });
  const before = state.version.lesson;
  const after = version.lesson;

  const flaggedScreens = first.blocking
    .filter((problem) => problem.source === "review")
    .map((problem) => problem.screen);

  if (state.live && isDeepStrictEqual(before, after)) {
    await recordPublishedReview({
      checked: { blocking: [], minor: [], reviewerRunId: null },
      needsFix: false,
      phase: "recheck",
      state,
    });

    return { status: "passed" };
  }

  return { before, flaggedScreens, state: { ...state, version }, status: "fixed" };
}

export async function checkPublishedDraft({
  state,
}: {
  state: PublishedDraftState;
}): Promise<
  Extract<PublishedDraftOutcome, { status: "checked" | "needsFix" }> | { status: "replaced" }
> {
  if ((await readCurrentLessonVersion(state.context.lessonId)) !== state.replaces) {
    return { status: "replaced" };
  }

  const checked = await runLessonQualityGate({
    ...state.gate,
    lesson: state.version.lesson,
    review: true,
  });

  await recordPublishedReview({
    checked,
    needsFix: checked.blocking.length > 0,
    phase: "firstReview",
    state,
  });

  return checked.blocking.length > 0
    ? { first: checked, state, status: "needsFix" }
    : {
        checked: { screens: checked.screens, status: "passed", version: state.version },
        state,
        status: "checked",
      };
}

export async function recheckPublishedDraft({
  before,
  flaggedScreens,
  state,
}: {
  before: WrittenLesson;
  flaggedScreens: (number | null)[];
  state: PublishedDraftState;
}): Promise<
  Extract<PublishedDraftOutcome, { status: "checked" | "heldBack" }> | { status: "replaced" }
> {
  if ((await readCurrentLessonVersion(state.context.lessonId)) !== state.replaces) {
    return { status: "replaced" };
  }

  const checked = await checkFixedLesson({
    fixed: state.version.lesson,
    gate: state.gate,
    review: !isDeepStrictEqual(before, state.version.lesson),
  });

  // A finding the writer saw on a screen it left unchanged is final, matched by screen, not wording.
  // A lesson-wide finding always blocks: nothing ties it to what the writer kept.
  const blocking = checked.blocking.filter(
    (problem) =>
      problem.source === "code" ||
      problem.screen === null ||
      !flaggedScreens.includes(problem.screen) ||
      !isDeepStrictEqual(
        before.screens[problem.screen],
        state.version.lesson.screens[problem.screen],
      ),
  );

  await recordPublishedReview({ checked, needsFix: blocking.length > 0, phase: "recheck", state });

  return blocking.length > 0
    ? {
        draft: toHeldBackDraft({
          model: state.gate.writerModel,
          problems: blocking,
          workflowRunId: state.context.workflowRunId,
        }),
        status: "heldBack",
      }
    : {
        checked: { screens: checked.screens, status: "passed", version: state.version },
        state,
        status: "checked",
      };
}

export async function stagePublishedDraft({
  state,
  checked,
}: Extract<PublishedDraftOutcome, { status: "checked" }>): Promise<PublishedLessonOutcome> {
  const staged = await readStagedFix(state.context.lessonId);

  return (
    staged ??
    stageFixedVersion({
      checked,
      context: state.context,
      inputs: state.inputs,
      replaces: state.replaces,
      writerRunId: writerRunIdOf(state),
    })
  );
}

/** Internal workflow bridge; not an app authorization boundary. */
export async function redraftPublishedLesson({
  heldBackDrafts,
  version,
  ...context
}: CheckContext & {
  heldBackDrafts: HeldBackDraft[];
  version: number;
}): Promise<PublishedDraftOutcome> {
  const [inputs, current, staged, analytics, reuse] = await Promise.all([
    loadPublishedLessonInputs(context.lessonId),
    readCurrentLessonVersion(context.lessonId),
    readStagedFix(context.lessonId),
    toTaskAnalytics(context),
    loadLessonReuse({ forExam: context.forExam, lessonId: context.lessonId }),
  ]);

  if (staged) {
    return staged;
  }

  if (!inputs || current !== version) {
    return { status: "replaced" };
  }

  const writer = pickDraftWriter({ heldBackDrafts, reuse });

  const draft = await writeLessonDraft({
    ...toWritingContext(inputs),
    analytics,
    heldBackProblems: writer.heldBackProblems,
    model: writer.model,
    serviceTier: BACKGROUND_TIER,
  });

  const loaded = await loadCheck({ context, version, writerModel: draft.provenance.model });

  if (!loaded) {
    return { status: "replaced" };
  }

  return {
    state: {
      context,
      gate: loaded.gate,
      inputs: loaded.inputs,
      live: false,
      replaces: version,
      version: {
        lesson: repairWrittenLesson({
          language: inputs.language,
          lesson: draft.data,
          spec: inputs.spec,
        }),
        provenanceByScreen: draft.data.screens.map(() => ({
          ...draft.provenance,
          sources: readLessonSources(inputs),
        })),
      },
      writerRunId: draft.provenance.runId,
    },
    status: "drafted",
  };
}

/** Internal workflow bridge: makes a staged fix the version learners get. */
export async function publishFixedVersion({
  lessonId,
  version,
}: {
  lessonId: string;
  version: number;
}): Promise<boolean> {
  return (await publishStagedLessonVersion({ lessonId, version })) !== null;
}
