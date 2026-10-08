import {
  type CourseBandNeed,
  type CurriculumScope,
  joinLevelBands,
} from "@zoonk/core/library/curriculum/scope";
import { getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { claimRunToken, joinRun } from "../_shared/run-token";
import { claimCourseWhenFree } from "./claim-course-when-free";
import { courseDetailsWorkflow } from "./course-details-workflow";
import { type BandPlan } from "./steps/band-outline";
import { createCourseIconStep } from "./steps/course-details-steps";
import {
  finishCourseOutlineStep,
  placeContinuationsStep,
  planOutlineBandStep,
  replanWaitingGoalsStep,
  saveOutlineChapterStep,
  writeOutlineBandStep,
} from "./steps/course-outline-steps";

export type CourseOutlineInput = {
  courseId: string;
  /** The level bands the goal needs, in the order the learner reaches them. */
  bands: CourseBandNeed[];
  scope: CurriculumScope;
  analytics?: ContentAnalytics;
  /**
   * The skill of the plan's first lesson a learner is waiting on: the chapter that teaches it is
   * saved as soon as the model finishes it, before the rest of its band.
   */
  waitedSkillId?: string;
  /** The plan gets to these bands in days, not minutes: they're written at the flex tier. */
  background?: boolean;
  /** How many times this request already waited for another run of the same course. */
  attempt?: number;
  /**
   * A guest's goal asked for these bands: the course's background work (its page details) waits
   * for a learner with an account, so a guest's goal stays within its share of the guests' daily
   * budget.
   */
  forGuest?: boolean;
};

export type CourseOutlineResult =
  | { status: "busy" | "joined" }
  | { bandsWritten: number; chapterIds: string[]; status: "written" };

/** One wait for another run of the same course, then this run's own bands. */
const MAX_JOIN_ATTEMPTS = 1;
/** A run saving the course's other bands holds it for a minute or two; this run waits for it. */
const BUSY_WAIT = "15s";
const MAX_CLAIM_TRIES = 20;

type RunContext = Omit<CourseOutlineInput, "attempt" | "bands"> & { workflowRunId: string };

/** Where the band's other chapters go: in order, around the waited chapter saved early. */
function toPosition({
  early,
  index,
  plan,
}: {
  early: { position: number } | null;
  index: number;
  plan: BandPlan;
}): number {
  const position = plan.nextPosition + index;
  return early && position >= early.position ? position + 1 : position;
}

/**
 * Writes one band: the outline, then every chapter in parallel steps, then re-plans waiting goals.
 * The skills the band continues are the new chapters' skills too, so their stand-ins shrink. In a
 * band a learner waits on, the chapter teaching their first lesson's skill was saved while the rest
 * was written, and the goals re-planned from it then re-plan with the whole band.
 */
async function writeBand({ context, plan }: { context: RunContext; plan: BandPlan }) {
  const { chapters, early, provenance } = await writeOutlineBandStep({ ...context, plan });
  const skills = [...plan.skills, ...plan.extensions.map((extension) => extension.skill)];

  const saved = await Promise.all(
    chapters.map((chapter, index) =>
      saveOutlineChapterStep({
        ...context,
        chapter,
        goalSkills: skills,
        level: plan.level,
        position: toPosition({ early, index, plan }),
        provenance,
      }),
    ),
  );

  const chapterIds = saved.map((chapter) => chapter.chapterId);

  if (plan.extensions.length > 0) {
    await placeContinuationsStep({ chapterIds, chapters, courseId: context.courseId, plan });
  }

  await replanWaitingGoalsStep({
    goalIds: early?.goalIds ?? [],
    skillIds: skills.map((skill) => skill.id),
  });

  return early
    ? chapterIds.toSpliced(early.position - plan.nextPosition, 0, early.chapterId)
    : chapterIds;
}

/**
 * Every band at once: each was planned up front from what the course had (`planBands`), with its
 * own level's positions, so none reads another's chapters, and the band the learner reaches first
 * no longer waits for the ones before it to land. Chapter ids come back in band order.
 */
async function writeBands({
  bands,
  context,
}: {
  bands: readonly BandPlan[];
  context: RunContext;
}): Promise<string[]> {
  const written = await Promise.all(bands.map((plan) => writeBand({ context, plan })));
  return written.flat();
}

/** Writes the bands under the course's claim, which ends completed or, when a band fails, failed. */
async function writeClaimedBands({
  bands,
  context,
}: {
  bands: readonly BandPlan[];
  context: RunContext;
}): Promise<string[]> {
  const { analytics, courseId, workflowRunId } = context;

  try {
    const chapterIds = await writeBands({ bands, context });
    await finishCourseOutlineStep({ courseId, status: "completed", workflowRunId });

    return chapterIds;
  } catch (error) {
    await Promise.all([
      finishCourseOutlineStep({ courseId, status: "failed", workflowRunId }),
      trackGenerationFailedStep({ analytics, contentKind: "course", task: "course-outline" }),
    ]);

    throw error;
  }
}

/**
 * What a shared course gets in the background once a run ends: its page details. Level bands no
 * goal needs are never written ahead: a band is outlined when a learner's plan gets close to it. A
 * run for a guest's goal leaves the details to the next run for a learner with an account.
 */
async function startSharedCourseWork(input: CourseOutlineInput): Promise<void> {
  if (input.scope.ownerId || input.forGuest) {
    return;
  }

  await start(courseDetailsWorkflow, [{ analytics: input.analytics, courseId: input.courseId }]);
}

/** Each level's band, planned from what the course has; one per level (see `joinLevelBands`). */
async function planBands({
  context,
  needs,
}: {
  context: RunContext;
  needs: readonly CourseBandNeed[];
}) {
  const plans = await Promise.all(
    joinLevelBands(needs).map((band) =>
      planOutlineBandStep({ band, courseId: context.courseId, scope: context.scope }),
    ),
  );

  return plans.filter((plan) => plan !== null);
}

/**
 * Writes what a goal needs of one Library course's outline: for each level band, all at once, the
 * chapters with their objectives and every lesson's title, description,
 * can-do line and skills. Outlines come before lessons, which wait until a learner gets close;
 * bands the plan gets to in days (`background`) are written at the flex tier. A band another
 * course already teaches is skipped, and a band that exists but misses some of the goal's skills
 * gains only the chapters that teach them, or the next chapter of a skill it teaches in part
 * (`extend`), while a plan still stands in for the rest of it. As each band lands, every goal
 * waiting on its skills re-plans with the real lessons. One run per course at a time: a second
 * request waits for the first, then writes whatever is still missing. A shared course then gets
 * its page details in the background; level bands no goal needs are never written ahead.
 */
export async function courseOutlineWorkflow(
  input: CourseOutlineInput,
): Promise<CourseOutlineResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const { conflict } = await claimRunToken(`course-outline:${input.courseId}`);
  const attempt = input.attempt ?? 0;

  if (conflict) {
    // However the run writing this course ends (one that stalled is stopped), the next check reads
    // the database.
    await joinRun(conflict);

    if (attempt < MAX_JOIN_ATTEMPTS) {
      await start(courseOutlineWorkflow, [{ ...input, attempt: attempt + 1 }]);
    }

    return { status: "joined" };
  }

  const context: RunContext = { ...input, workflowRunId };

  const [, outlined] = await Promise.allSettled([
    drawIconEarly(context),
    writeOutline({ context, input, workflowRunId }),
  ]);

  if (outlined.status === "rejected") {
    throw outlined.reason;
  }

  return outlined.value;
}

/**
 * A shared course's icon needs only its title, not its outline: it's drawn while the outline is
 * written, so the plan shows the subject's icon from the learner's first look instead of minutes
 * later, once the whole run ends and the page details are written. A guest's run leaves it to the
 * next learner with an account, like the rest of the course's background work; a failure leaves it
 * to the details that run after the outline.
 */
async function drawIconEarly(context: RunContext): Promise<string | null> {
  if (context.scope.ownerId || context.forGuest) {
    return null;
  }

  return createCourseIconStep({
    analytics: context.analytics,
    courseId: context.courseId,
    workflowRunId: context.workflowRunId,
  });
}

async function writeOutline({
  context,
  input,
  workflowRunId,
}: {
  context: RunContext;
  input: CourseOutlineInput;
  workflowRunId: string;
}): Promise<CourseOutlineResult> {
  const plans = await planBands({ context, needs: input.bands });

  if (plans.length === 0) {
    await startSharedCourseWork(input);
    return { bandsWritten: 0, chapterIds: [], status: "written" };
  }

  const claim = await claimCourseWhenFree({
    courseId: input.courseId,
    tries: MAX_CLAIM_TRIES,
    wait: () => sleep(BUSY_WAIT),
    workflowRunId,
  });

  if (!claim.claimed) {
    return { status: "busy" };
  }

  // Another run may have saved some of these bands while this run waited for the course.
  const bands = claim.waited ? await planBands({ context, needs: input.bands }) : plans;
  const chapterIds = await writeClaimedBands({ bands, context });
  await startSharedCourseWork(input);

  return { bandsWritten: bands.length, chapterIds, status: "written" };
}
