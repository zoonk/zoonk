import { type CourseBandNeed, type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { safeAsync } from "@zoonk/utils/error";
import { createHook, getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { claimCourseWhenFree } from "./claim-course-when-free";
import { courseDetailsWorkflow } from "./course-details-workflow";
import { courseRemainingBandsWorkflow } from "./course-remaining-bands-workflow";
import { type BandPlan } from "./steps/band-outline";
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
   * The skill of the plan's first lesson a learner is waiting on: its band is written at the
   * priority tier (about twice as fast at twice the price), and the chapter that teaches it is
   * saved as soon as the model finishes it.
   */
  waitedSkillId?: string;
  /** How many times this request already waited for another run of the same course. */
  attempt?: number;
  /**
   * A guest's goal asked for these bands: the course's background work (page details and its
   * other bands) waits for a learner with an account, so a guest's goal stays within its share
   * of the guests' daily budget.
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

/** Bands in order, one after another: the band the learner reaches first is ready first. */
function writeBands({
  bands,
  context,
}: {
  bands: readonly BandPlan[];
  context: RunContext;
}): Promise<string[]> {
  return bands.reduce<Promise<string[]>>(
    async (written, plan) => [...(await written), ...(await writeBand({ context, plan }))],
    Promise.resolve([]),
  );
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
 * What a shared course gets in the background once a run ends: its page details and, at the flex
 * tier, the outline of every level band no goal needed, so every public course ends up whole. A
 * run for a guest's goal leaves it to the next run for a learner with an account.
 */
async function startSharedCourseWork(input: CourseOutlineInput): Promise<void> {
  if (input.scope.ownerId || input.forGuest) {
    return;
  }

  const { analytics, courseId } = input;

  await Promise.all([
    start(courseDetailsWorkflow, [{ analytics, courseId }]),
    start(courseRemainingBandsWorkflow, [{ analytics, courseId }]),
  ]);
}

async function planBands({
  context,
  needs,
}: {
  context: RunContext;
  needs: readonly CourseBandNeed[];
}) {
  const plans = await Promise.all(
    needs.map((band) =>
      planOutlineBandStep({ band, courseId: context.courseId, scope: context.scope }),
    ),
  );

  return plans.filter((plan) => plan !== null);
}

/**
 * Writes what a goal needs of one Library course's outline: for each level band, in the order the
 * learner reaches it, the chapters with their objectives and every lesson's title, description,
 * can-do line and skills. Outlines are cheap and come first; lesson content waits until a learner
 * gets close. A band another course already teaches is skipped, and a band that exists but misses
 * some of the goal's skills gains only the chapters that teach them, or the next chapter of a
 * skill it teaches in part (`extend`), while a plan still stands in for the rest of it. As each band lands, every
 * goal waiting on its skills re-plans with the real lessons. One run per course at a time: a
 * second request waits for the first, then writes whatever is still missing, and a run that finds
 * a run saving the course's other bands waits for it and plans against what it saved. A shared
 * course then gets its page details and every other band's outline in the background; private courses have no levels and go without.
 */
export async function courseOutlineWorkflow(
  input: CourseOutlineInput,
): Promise<CourseOutlineResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const hook = createHook({ token: `course-outline:${input.courseId}` });
  const conflict = await hook.getConflict();
  const attempt = input.attempt ?? 0;

  if (conflict) {
    // However the run writing this course ends, the next check reads the database.
    await safeAsync(() => conflict.returnValue);

    if (attempt < MAX_JOIN_ATTEMPTS) {
      await start(courseOutlineWorkflow, [{ ...input, attempt: attempt + 1 }]);
    }

    return { status: "joined" };
  }

  const context: RunContext = { ...input, workflowRunId };
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
