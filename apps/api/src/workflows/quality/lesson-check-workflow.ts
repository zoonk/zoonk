import {
  type HeldBackDraft,
  MAX_LESSON_DRAFTS,
} from "@zoonk/core/library/generation/held-back-drafts";
import { type LessonCheckPlan } from "@zoonk/core/library/lessons/write-content";
import { type PublishedLessonOutcome } from "@zoonk/core/library/quality/published-checks";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import { markAndDraw } from "../lessons/mark-and-draw";
import {
  checkPublishedLessonStep,
  citePublishedLessonStep,
  publishFixedVersionStep,
  readLessonImageScopeStep,
  redraftPublishedLessonStep,
  setAsidePublishedLessonStep,
} from "./steps/lesson-check-steps";

export type LessonCheckInput = {
  analytics?: ContentAnalytics;
  forExam?: boolean;
  lessonId: string;
  plan: LessonCheckPlan;
};

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
    const { analytics, lessonId } = context;
    const imageScope = await readLessonImageScopeStep(lessonId);

    if (imageScope) {
      await markAndDraw({ analytics, imageScope, lessonId, savedAt: settled.savedAt });
    }

    await publishFixedVersionStep({ lessonId, version: settled.version });
  }

  if (settled.status === "heldBack" && outcome.status === "heldBack" && outcome.incorrect) {
    await setAsidePublishedLessonStep({ lessonId: context.lessonId, version });
    return "setAside";
  }

  return settled.status;
}

async function checkAndSettle({
  context,
  plan,
}: {
  context: CheckContext;
  plan: LessonCheckPlan;
}): Promise<LessonCheckStatus> {
  const outcome: PublishedLessonOutcome = plan.review
    ? await checkPublishedLessonStep({ ...context, plan })
    : { status: "passed" };

  return settlePublishedLesson({ context, outcome, version: plan.version });
}

export async function lessonCheckWorkflow({
  plan,
  ...input
}: LessonCheckInput): Promise<LessonCheckResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const context: CheckContext = { ...input, workflowRunId };

  // Citations are extra: the version goes without them once their step gives up, and a fix
  // doesn't wait for them before its marks and pictures start.
  const [cited, status] = await Promise.all([
    plan.cite ? citePublishedLessonStep({ ...context, plan }).catch(() => 0) : 0,
    checkAndSettle({ context, plan }),
  ]);

  return { cited, status };
}
