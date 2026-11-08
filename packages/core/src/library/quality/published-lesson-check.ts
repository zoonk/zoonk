import "server-only";
import { isDeepStrictEqual } from "node:util";
import { writeLessonDraft } from "@zoonk/ai/tasks/lesson-writer";
import { type HeldBackDraft } from "../generation/held-back-drafts";
import {
  type CheckedVersion,
  type GateResult,
  type LessonGate,
  type WrittenVersion,
  checkFixedLesson,
  citeScreensIfPossible,
  fixVersionDraft,
  readLessonSources,
  toScreensToSave,
} from "../lessons/_utils/checked-version";
import { pickDraftWriter } from "../lessons/_utils/draft-writer";
import {
  type LessonWritingInputs,
  loadPublishedLessonInputs,
  toWritingContext,
} from "../lessons/_utils/lesson-writing-inputs";
import {
  publishStagedLessonVersion,
  stageLessonVersion,
} from "../lessons/_utils/save-lesson-content";
import { loadLessonReuse } from "../lessons/lesson-reuse";
import { readCurrentLessonVersion, readStagedLessonVersion } from "../lessons/lesson-versions";
import { type LessonCheckPlan } from "../lessons/write-lesson-content";
import {
  BACKGROUND_TIER,
  type CheckContext,
  keepPictures,
  loadCheck,
  loadVersionSteps,
  toHeldBackDraft,
  toProvenance,
  toTaskAnalytics,
} from "./_utils/published-versions";
import { runLessonQualityGate } from "./lesson-quality-gate";
import { repairWrittenLesson } from "./lesson-repairs";

export type PublishedLessonOutcome =
  | { status: "passed" | "replaced" }
  | { savedAt: number; status: "republished"; version: number }
  | { draft: HeldBackDraft; status: "heldBack" };

async function stageFixedVersion({
  checked,
  context,
  inputs,
  replaces,
}: {
  checked: Extract<CheckedVersion, { status: "passed" }>;
  context: CheckContext;
  inputs: LessonWritingInputs;
  replaces: number;
}): Promise<PublishedLessonOutcome> {
  const [citations, previous] = await Promise.all([
    citeScreensIfPossible({
      analytics: await toTaskAnalytics(context),
      inputs,
      lesson: checked.version.lesson,
      serviceTier: BACKGROUND_TIER,
    }),
    loadVersionSteps({ lessonId: context.lessonId, version: replaces }),
  ]);

  const screens = toScreensToSave({
    citations,
    inputs,
    screens: checked.screens,
    version: checked.version,
  });

  const version = await stageLessonVersion({
    language: inputs.language,
    lessonId: context.lessonId,
    replaces,
    screens: keepPictures({ previous, screens }),
    summary: checked.version.lesson.summary,
  });

  return version === null
    ? { status: "replaced" }
    : { savedAt: Date.now(), status: "republished", version };
}

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

  if (first.blocking.length === 0) {
    return { status: "passed" };
  }

  const previous = await loadVersionSteps({ lessonId: context.lessonId, version: plan.version });

  return {
    first,
    state: {
      context,
      gate,
      inputs,
      live: true,
      replaces: plan.version,
      version: {
        lesson: plan.lesson,
        provenanceByScreen: previous.map((step) => toProvenance(step)),
      },
    },
    status: "needsFix",
  };
}

export type PublishedDraftState = {
  context: CheckContext;
  inputs: LessonWritingInputs;
  live: boolean;
  gate: LessonGate;
  version: WrittenVersion;
  replaces: number;
};

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
}): Promise<{ status: "passed" } | { status: "fixed"; state: PublishedDraftState }> {
  const version = await fixVersionDraft({ draft: state.version, first, gate: state.gate });
  const before = state.version.lesson;
  const after = version.lesson;

  const declined = first.blocking.every(({ screen }) =>
    screen === null
      ? isDeepStrictEqual(before, after)
      : isDeepStrictEqual(before.screens[screen], after.screens[screen]),
  );

  return state.live && declined
    ? { status: "passed" }
    : { state: { ...state, version }, status: "fixed" };
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

  return checked.blocking.length > 0
    ? { first: checked, state, status: "needsFix" }
    : {
        checked: { screens: checked.screens, status: "passed", version: state.version },
        state,
        status: "checked",
      };
}

export async function recheckPublishedDraft({
  state,
}: {
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
    review: true,
  });

  return checked.blocking.length > 0
    ? {
        draft: toHeldBackDraft({
          model: state.gate.writerModel,
          problems: checked.blocking,
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
