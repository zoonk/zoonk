import "server-only";
import { writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLibraryLessonCacheTag } from "../../cache/tags";
import { type HeldBackDraft } from "../generation/held-back-drafts";
import { moveOnWithoutLesson } from "../generation/hold-back-lesson";
import {
  type CheckedVersion,
  type GateResult,
  checkVersion,
  citeScreens,
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
  loadLessonScope,
  loadVersionSteps,
  toHeldBackDraft,
  toProvenance,
  toTaskAnalytics,
} from "./_utils/published-versions";
import { runLessonQualityGate } from "./lesson-quality-gate";

/**
 * `passed`: the version is fine. `replaced`: another version took its place meanwhile (a rewrite,
 * another check's fix), so there's nothing to do. `republished`: a fixed version is published.
 * `heldBack`: no fix passed; `draft` says what held it back and `incorrect` whether the version
 * learners open has something wrong (rather than something to improve).
 */
export type PublishedLessonOutcome =
  | { status: "passed" | "replaced" }
  | { status: "republished"; version: number }
  | { draft: HeldBackDraft; incorrect: boolean; status: "heldBack" };

/** Publishes a version that passed its checks in place of `replaces`, with its citations. */
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
    citeScreens({
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

/**
 * The reviewer's reading of a version that already passed its code checks: only what the reviewer
 * finds blocks it now, and the code checks' notes (read as before the fix pass, so stricter than
 * when it was published) go to a fix pass as suggestions.
 */
function toReviewFindings(gate: GateResult): GateResult {
  const fromCode = gate.blocking.filter((problem) => problem.source === "code");

  return {
    ...gate,
    blocking: gate.blocking.filter((problem) => problem.source === "review"),
    minor: [...gate.minor, ...fromCode],
  };
}

/**
 * The background check of a version just published (learners already play it): the cross-family
 * reasoning check, at flex, from a reviewer as strong as the lesson is likely to be read again.
 * When it finds something that blocks the lesson (as it would have held the lesson back before
 * publishing), one fix pass repairs the version and the gate runs again (the reviewer reads the
 * fix again only when it strayed from what was flagged); a fixed version that passes is published
 * as the lesson's next version. Learners playing the version it replaces finish it, and the next
 * open gets the fixed one. Nothing changes when another version took its place meanwhile.
 *
 * This is an internal workflow bridge: Library content is shared and no learner's data is written.
 */
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

/**
 * A fresh draft of a published lesson whose check found problems no fix put right, written by the
 * writer `pickDraftWriter` picks after the drafts held back so far (told what held them back) and
 * checked in full at flex (code checks, the reviewer, one fix pass), then published as the lesson's
 * next version in place of `version`. Learners keep playing `version` meanwhile.
 *
 * This is an internal workflow bridge: Library content is shared and no learner's data is written.
 */
export async function redraftPublishedLesson({
  heldBackDrafts,
  version,
  ...context
}: CheckContext & {
  heldBackDrafts: HeldBackDraft[];
  version: number;
}): Promise<PublishedLessonOutcome> {
  const [inputs, current, scope] = await Promise.all([
    loadPublishedLessonInputs(context.lessonId),
    readCurrentLessonVersion(context.lessonId),
    loadLessonScope(context),
  ]);

  if (!inputs || current !== version) {
    return { status: "replaced" };
  }

  // A private course's lesson starts from its cheaper writer, like its first draft.
  const writer = pickDraftWriter({ heldBackDrafts, model: scope.model });

  const draft = await writeLessonDraft({
    ...toWritingContext(inputs),
    analytics: scope.analytics,
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

/**
 * Writes the citations of a version just published from documents (the learner's material or a
 * law's text): each screen gets the page it teaches from. Citing waits for nothing on the way to
 * the learner, so it follows publishing, at flex; only the version it read is updated, and only
 * while it's still the current one.
 *
 * This is an internal workflow bridge: Library content is shared and no learner's data is written.
 */
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

/**
 * Takes a published lesson out of play after its background check found something wrong that no
 * fix and no fresh draft could put right: it's set aside like a lesson whose last draft was held
 * back, so new opens and every plan move on without it, while learners playing it finish the
 * version they opened. Only while `version` is still the lesson's current one; false otherwise.
 */
export async function setAsidePublishedLesson({
  lessonId,
  version,
}: {
  lessonId: string;
  version: number;
}): Promise<boolean> {
  const userIds = await prisma.$transaction(async (tx) => {
    if ((await lockCurrentLessonVersion(tx, lessonId)) !== version) {
      return null;
    }

    await tx.lesson.update({
      data: { contentStatus: "failed", setAsideAt: new Date() },
      where: { id: lessonId },
    });

    return moveOnWithoutLesson(tx, lessonId);
  });

  if (!userIds) {
    return false;
  }

  revalidateCacheTags([
    getLibraryLessonCacheTag(lessonId),
    ...userIds.map((userId) => getGoalsCacheTag(userId)),
  ]);

  return true;
}
