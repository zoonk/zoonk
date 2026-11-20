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
} from "./_utils/published-versions";
import { stageFixedVersion } from "./_utils/stage-fixed-version";
import { recordLessonQualityDecision } from "./lesson-quality-decision";
import { runLessonQualityGate } from "./lesson-quality-gate";
import { repairWrittenLesson } from "./lesson-repairs";

type PublishedHeldBackDraft = HeldBackDraft & { repairBase?: string };

export type PublishedLessonOutcome =
  | { status: "passed" | "replaced" }
  | { savedAt: number; status: "republished"; version: number }
  | { draft: PublishedHeldBackDraft; status: "heldBack" };

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

  if (!loaded || (typeof plan.repairBase === "string" && loaded.repairBase !== plan.repairBase)) {
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

  await recordLessonQualityDecision({
    blocking: first.blocking,
    lessonId: context.lessonId,
    phase: "firstReview",
    reviewerRunId: checked.reviewerRunId,
    writerRunId,
  });

  if (first.blocking.length === 0) {
    return { status: "passed" };
  }

  return {
    first,
    state: {
      context,
      gate,
      inputs,
      live: true,
      repairBase: loaded.repairBase,
      replaces: plan.version,
      version: {
        lesson: plan.lesson,
        provenanceByScreen: previous.map((step) => toProvenance(step)),
      },
    },
    status: "needsFix",
  };
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

  return state.live && isDeepStrictEqual(before, after)
    ? { status: "passed" }
    : { before, flaggedScreens, state: { ...state, version }, status: "fixed" };
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

  const writerRunId = state.writerRunId ?? state.version.provenanceByScreen[0]?.runId;
  const { lessonId } = state.context;

  await Promise.all([
    recordLessonQualityDecision({
      blocking: checked.blocking.filter((problem) => problem.source === "code"),
      lessonId,
      minor: checked.minor,
      phase: "codeCheck",
      writerRunId,
    }),
    recordLessonQualityDecision({
      blocking: checked.blocking.filter((problem) => problem.source === "review"),
      lessonId,
      phase: "firstReview",
      reviewerRunId: checked.reviewerRunId,
      writerRunId,
    }),
  ]);

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

  return blocking.length > 0
    ? {
        draft: {
          ...toHeldBackDraft({
            model: state.gate.writerModel,
            problems: blocking,
            workflowRunId: state.context.workflowRunId,
          }),
          repairBase: state.repairBase,
        },
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

  if (staged) {
    return staged;
  }

  return state.repairBase ? stageFixedVersion({ checked, state }) : { status: "replaced" };
}

/** Internal workflow bridge; not an app authorization boundary. */
export async function redraftPublishedLesson({
  heldBackDrafts,
  version,
  ...context
}: CheckContext & {
  heldBackDrafts: PublishedHeldBackDraft[];
  version: number;
}): Promise<PublishedDraftOutcome> {
  const [staged, reuse] = await Promise.all([
    readStagedFix(context.lessonId),
    loadLessonReuse({ forExam: context.forExam, lessonId: context.lessonId }),
  ]);

  if (staged) {
    return staged;
  }

  const writer = pickDraftWriter({ heldBackDrafts, reuse });
  const loaded = await loadCheck({ context, version, writerModel: writer.model });

  const first = heldBackDrafts.find((draft) => draft.repairBase !== undefined);

  if (!loaded || (first && loaded.repairBase !== first.repairBase)) {
    return { status: "replaced" };
  }

  const { gate, inputs, repairBase } = loaded;

  const draft = await writeLessonDraft({
    ...gate.context,
    analytics: gate.analytics,
    heldBackProblems: writer.heldBackProblems,
    model: writer.model,
    serviceTier: BACKGROUND_TIER,
  });

  return {
    state: {
      context,
      gate: { ...gate, writerModel: draft.provenance.model },
      inputs,
      live: false,
      repairBase,
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
