import {
  type HeldBackDraft,
  MAX_LESSON_DRAFTS,
} from "@zoonk/core/library/generation/held-back-drafts";
import { type LessonCheckPlan } from "@zoonk/core/library/lessons/write-content";
import { type PublishedLessonOutcome } from "@zoonk/core/library/quality/published-checks";
import { getWorkflowMetadata } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import { lessonImagesWorkflow } from "../images/lesson-images-workflow";
import {
  checkPublishedLessonStep,
  citePublishedLessonStep,
  readLessonImageScopeStep,
  redraftPublishedLessonStep,
  setAsidePublishedLessonStep,
} from "./steps/lesson-check-steps";

export type LessonCheckInput = {
  /** The learner and goal the lesson was made for, so the checks' cost adds up with it. */
  analytics?: ContentAnalytics;
  /** Made for an exam goal, which makes it very likely read again (a stronger reviewer). */
  forExam?: boolean;
  lessonId: string;
  plan: LessonCheckPlan;
};

/** How a published version's checks ended (`setAside`: taken out of play, see below). */
export type LessonCheckStatus = PublishedLessonOutcome["status"] | "setAside";

export type LessonCheckResult = { cited: number; status: LessonCheckStatus };

type CheckContext = Omit<LessonCheckInput, "plan"> & { workflowRunId: string };

type Redraft = { drafts: HeldBackDraft[]; outcome: PublishedLessonOutcome };

async function redraft({
  context,
  drafts,
  version,
}: {
  context: CheckContext;
  drafts: HeldBackDraft[];
  version: number;
}): Promise<Redraft> {
  const outcome = await redraftPublishedLessonStep({ ...context, heldBackDrafts: drafts, version });
  return { drafts: outcome.status === "heldBack" ? [...drafts, outcome.draft] : drafts, outcome };
}

/**
 * Fresh drafts in place of a published version no fix put right, while the lesson has drafts left
 * (the fixed version counts as its first): each is told what held the earlier ones back.
 */
function redraftUntilPublished({
  context,
  first,
  version,
}: {
  context: CheckContext;
  first: HeldBackDraft;
  version: number;
}): Promise<Redraft> {
  return repeatUntil<Redraft>({
    done: ({ outcome }) => outcome.status !== "heldBack",
    run: (previous) => redraft({ context, drafts: previous?.drafts ?? [first], version }),
    times: MAX_LESSON_DRAFTS - 1,
  });
}

/**
 * What follows a published version's check. A version no fix put right gets fresh drafts; the
 * first that passes is published as the next version, and the lesson's pictures follow it (the
 * ones the replaced version had for the same screens are kept). When every draft is held back, a
 * version with something wrong in it is taken out of play (learners playing it finish it, and plans
 * move on), while one that only had something to improve stays.
 */
export async function settlePublishedLesson({
  context,
  outcome,
  version,
}: {
  context: CheckContext;
  outcome: PublishedLessonOutcome;
  version: number;
}): Promise<LessonCheckStatus> {
  const redrafted =
    outcome.status === "heldBack"
      ? await redraftUntilPublished({ context, first: outcome.draft, version })
      : null;

  const settled = redrafted?.outcome ?? outcome;

  if (settled.status === "republished") {
    const imageScope = await readLessonImageScopeStep(context.lessonId);

    if (imageScope) {
      const analytics = { ...context.analytics, contentScope: imageScope };
      await start(lessonImagesWorkflow, [{ analytics, lessonId: context.lessonId }]);
    }
  }

  if (settled.status === "heldBack" && outcome.status === "heldBack" && outcome.incorrect) {
    await setAsidePublishedLessonStep({ lessonId: context.lessonId, version });
    return "setAside";
  }

  return settled.status;
}

/**
 * The model checks of a lesson version just published, which learners already play: nobody waits
 * on them, so they run here, at the flex tier. The reasoning check reads the version (when the
 * lesson's policy asks for one) and a problem it finds is fixed in a new version; a lesson written
 * from documents gets its citations meanwhile. Learners playing the version a fix replaces finish
 * it, and the next open gets the fixed one.
 */
export async function lessonCheckWorkflow({
  plan,
  ...input
}: LessonCheckInput): Promise<LessonCheckResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const context: CheckContext = { ...input, workflowRunId };

  const [cited, outcome] = await Promise.all([
    plan.cite ? citePublishedLessonStep({ ...context, plan }) : 0,
    plan.review
      ? checkPublishedLessonStep({ ...context, plan })
      : ({ status: "passed" } satisfies PublishedLessonOutcome),
  ]);

  const status = await settlePublishedLesson({ context, outcome, version: plan.version });

  return { cited, status };
}
