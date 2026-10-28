import "server-only";
import { writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLibraryLessonCacheTag } from "../../cache/tags";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { type HeldBackDraft } from "../generation/held-back-drafts";
import {
  moveOnWithoutLesson,
  readHeldPlanIds,
  refreshPlansWithoutLesson,
} from "../generation/hold-back-lesson";
import {
  type CheckedVersion,
  type GateResult,
  checkVersion,
  citeScreens,
  citeScreensIfPossible,
  fixVersion,
  toScreensToSave,
} from "../lessons/_utils/checked-version";
import { pickDraftWriter } from "../lessons/_utils/draft-writer";
import {
  type LessonWritingInputs,
  loadPublishedLessonInputs,
  toWritingContext,
} from "../lessons/_utils/lesson-writing-inputs";
import { saveLessonVersion } from "../lessons/_utils/save-lesson-content";
import {
  CURRENT_STEPS,
  lockCurrentLessonVersion,
  readCurrentLessonVersion,
} from "../lessons/lesson-versions";
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

export type PublishedLessonOutcome =
  | { status: "passed" | "replaced" }
  | { status: "republished"; version: number }
  | { draft: HeldBackDraft; incorrect: boolean; status: "heldBack" };

async function publishFixedVersion({
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

  const version = await saveLessonVersion({
    language: inputs.language,
    lessonId: context.lessonId,
    replaces,
    screens: keepPictures({ previous, screens }),
    summary: checked.version.lesson.summary.map((idea) => idea.trim()),
  });

  return version === null ? { status: "replaced" } : { status: "republished", version };
}

function toReviewFindings(gate: GateResult): GateResult {
  const fromCode = gate.blocking.filter((problem) => problem.source === "code");

  return {
    ...gate,
    blocking: gate.blocking.filter((problem) => problem.source === "review"),
    minor: [...gate.minor, ...fromCode],
  };
}

/** Internal workflow bridge; not an app authorization boundary. */
export async function checkPublishedLesson({
  plan,
  ...context
}: CheckContext & { plan: LessonCheckPlan }): Promise<PublishedLessonOutcome> {
  const loaded = await loadCheck({ context, version: plan.version, writerModel: plan.writerModel });

  if (!loaded) {
    return { status: "replaced" };
  }

  const { gate, inputs } = loaded;

  const first = toReviewFindings(
    await runLessonQualityGate({ ...gate, lesson: plan.lesson, review: true }),
  );

  if (first.blocking.length === 0) {
    return { status: "passed" };
  }

  const previous = await loadVersionSteps({ lessonId: context.lessonId, version: plan.version });

  const checked = await fixVersion({
    draft: { lesson: plan.lesson, provenanceByScreen: previous.map((step) => toProvenance(step)) },
    first,
    gate,
    review: true,
  });

  if (checked.status === "heldBack") {
    return {
      draft: toHeldBackDraft({
        model: plan.writerModel,
        problems: checked.problems,
        workflowRunId: context.workflowRunId,
      }),
      incorrect: first.incorrect.length > 0,
      status: "heldBack",
    };
  }

  return publishFixedVersion({ checked, context, inputs, replaces: plan.version });
}

/** Internal workflow bridge; not an app authorization boundary. */
export async function redraftPublishedLesson({
  heldBackDrafts,
  version,
  ...context
}: CheckContext & {
  heldBackDrafts: HeldBackDraft[];
  version: number;
}): Promise<PublishedLessonOutcome> {
  const [inputs, current, analytics] = await Promise.all([
    loadPublishedLessonInputs(context.lessonId),
    readCurrentLessonVersion(context.lessonId),
    toTaskAnalytics(context),
  ]);

  if (!inputs || current !== version) {
    return { status: "replaced" };
  }

  const writer = pickDraftWriter({ heldBackDrafts });

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

  const checked = await checkVersion({
    draft: {
      lesson: draft.data,
      provenanceByScreen: draft.data.screens.map(() => draft.provenance),
    },
    gate: loaded.gate,
    review: true,
  });

  if (checked.status === "heldBack") {
    return {
      draft: toHeldBackDraft({
        model: draft.provenance.model,
        problems: checked.problems,
        workflowRunId: context.workflowRunId,
      }),
      incorrect: false,
      status: "heldBack",
    };
  }

  return publishFixedVersion({ checked, context, inputs: loaded.inputs, replaces: version });
}

/** Internal workflow bridge; a failed citation call throws so the workflow step can retry. */
export async function citePublishedLesson({
  plan,
  ...context
}: CheckContext & { plan: Pick<LessonCheckPlan, "lesson" | "version"> }): Promise<number> {
  const inputs = await loadPublishedLessonInputs(context.lessonId);

  if (!inputs) {
    return 0;
  }

  const citations = await citeScreens({
    analytics: await toTaskAnalytics(context),
    inputs,
    lesson: plan.lesson,
    serviceTier: BACKGROUND_TIER,
  });

  const cited = citations.flatMap((citation, position) =>
    citation ? [{ citation, position }] : [],
  );

  const updates = await prisma.$transaction(
    cited.map(({ citation, position }) =>
      prisma.step.updateMany({
        data: { sourceId: citation.sourceId, sourcePage: citation.page },
        where: { lessonId: context.lessonId, position, version: plan.version, ...CURRENT_STEPS },
      }),
    ),
  );

  const count = updates.reduce((total, update) => total + update.count, 0);

  if (count > 0) {
    revalidateCacheTags([getLibraryLessonCacheTag(context.lessonId)]);
  }

  return count;
}

class PublishedLessonReplacedError extends Error {
  override name = "PublishedLessonReplacedError";
}

/** Returns false if `version` was replaced; callers must leave the newer version playable. */
export async function setAsidePublishedLesson({
  lessonId,
  version,
}: {
  lessonId: string;
  version: number;
}): Promise<boolean> {
  const holdKey = `${lessonId}:published:${version}`;

  const { data: heldBack, error } = await safeAsync(() =>
    writePlanInputs(async (tx) => {
      const existing = await tx.step.findFirst({
        select: { lesson: { select: { contentStatus: true, setAsideAt: true } }, version: true },
        where: { lessonId, ...CURRENT_STEPS },
      });

      if (existing?.version !== version) {
        return null;
      }

      if (existing.lesson.contentStatus !== "completed") {
        return existing.lesson.setAsideAt
          ? { changed: false, planIds: await readHeldPlanIds(tx, holdKey) }
          : null;
      }

      await lockPlanSourceWrite(tx, { lessonIds: [lessonId] });

      if ((await lockCurrentLessonVersion(tx, lessonId)) !== version) {
        throw new PublishedLessonReplacedError();
      }

      await tx.lesson.update({
        data: { contentStatus: "failed", setAsideAt: new Date() },
        where: { id: lessonId },
      });

      return { changed: true, planIds: await moveOnWithoutLesson(tx, lessonId, holdKey) };
    }),
  );

  if (error instanceof PublishedLessonReplacedError) {
    return false;
  }

  if (error) {
    throw error;
  }

  if (!heldBack) {
    return false;
  }

  const userIds = await refreshPlansWithoutLesson(heldBack.planIds);

  revalidateCacheTags([
    getLibraryLessonCacheTag(lessonId),
    ...userIds.map((userId) => getGoalsCacheTag(userId)),
  ]);

  return heldBack.changed;
}
