import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import { generateCourseOutline } from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import {
  claimCourseOutline,
  findUntaughtSkills,
  finishCourseOutline,
  getCourseBandContext,
  getCourseOutlineOwner,
  releaseStaleCourseOutline,
} from "@zoonk/core/library/curriculum/course-outline-state";
import { placeContinuations } from "@zoonk/core/library/curriculum/place-continuations";
import {
  listGoalsWaitingOnSkills,
  replanWaitingGoal,
} from "@zoonk/core/library/curriculum/replan-waiting-goals";
import {
  type OutlineChapter,
  type SavedOutlineChapter,
  saveOutlineChapter,
} from "@zoonk/core/library/curriculum/save-outline-chapter";
import {
  type CourseBandNeed,
  type CurriculumScope,
  type GoalSkillRef,
  getScopeReuse,
} from "@zoonk/core/library/curriculum/scope";
import { planSkillExtensions } from "@zoonk/core/library/curriculum/skill-extensions";
import { logError } from "@zoonk/utils/logger";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { catchPlanConflict } from "../../_shared/plan-conflict-outcome";
import { type PlanStepOutcome } from "../../_shared/plan-conflict-retry";
import { isRunActive } from "../../_shared/run-activity";
import {
  type BandInput,
  type BandPlan,
  type OutlineProvenance,
  pickChapters,
  toOutlineParams,
} from "./band-outline";
import { type BandOutline, writeWaitedBand } from "./waited-band-outline";

type OutlineContext = {
  analytics?: ContentAnalytics;
  courseId: string;
  scope: CurriculumScope;
  workflowRunId: string;
};

export async function planOutlineBandStep({
  band,
  courseId,
  scope,
}: {
  band: CourseBandNeed;
  courseId: string;
  scope: CurriculumScope;
}): Promise<BandPlan | null> {
  "use step";

  const [untaught, context, extensions] = await Promise.all([
    findUntaughtSkills({
      courseId,
      ownerId: scope.ownerId,
      skillIds: band.skills.map((skill) => skill.id),
      withToolChapters: band.withToolChapters,
    }),
    getCourseBandContext({ courseId, level: band.level }),
    planSkillExtensions({ courseId, extensions: band.extend ?? [], ownerId: scope.ownerId }),
  ]);

  const extended = extensions.filter((extension) => extension.level === band.level);

  const wantsWholeBand =
    band.skills.length === 0 && !band.extend?.length && context.nextPosition === 0;

  if (untaught.length === 0 && !wantsWholeBand && extended.length === 0) {
    return null;
  }

  return {
    courseTitle: context.title,
    extensions: extended,
    isNewBand: context.nextPosition === 0,
    level: band.level,
    material: context.material,
    nextPosition: context.nextPosition,
    otherChapterTitles: context.chapterTitles,
    skills: band.skills.filter((skill) => untaught.includes(skill.id)),
    taughtElsewhere: band.skills
      .filter((skill) => !untaught.includes(skill.id))
      .map((skill) => skill.name),
    withoutTools: band.withToolChapters === false,
  };
}

export async function claimCourseOutlineStep(input: { courseId: string; workflowRunId: string }) {
  "use step";

  const claim = await claimCourseOutline(input);
  const ownerId = claim === "running" ? await getCourseOutlineOwner(input.courseId) : null;

  if (!ownerId || (await isRunActive(ownerId))) {
    return claim;
  }

  await releaseStaleCourseOutline({ courseId: input.courseId, staleRunId: ownerId });

  return claimCourseOutline(input);
}

export async function finishCourseOutlineStep(input: {
  courseId: string;
  status: "completed" | "failed";
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await finishCourseOutline(input);
}

function getBandWait({ background, waited }: { background?: boolean; waited: boolean }): CallWait {
  if (waited) {
    return "learner";
  }

  return background ? "later" : "soon";
}

export async function writeOutlineBandStep({
  background,
  waitedSkillId,
  ...input
}: BandInput & { background?: boolean; waitedSkillId?: string }): Promise<BandOutline> {
  "use step";

  const { plan } = input;
  const waitedKey = plan.skills.find((skill) => skill.id === waitedSkillId)?.key;

  const serviceTier = chooseServiceTier({
    reuse: getScopeReuse(input.scope),
    wait: getBandWait({ background, waited: Boolean(waitedKey) }),
  });

  if (waitedKey && plan.extensions.length === 0) {
    return withAiRetry(() => writeWaitedBand({ input, serviceTier, waitedKey }));
  }

  const { data, provenance } = await withAiRetry(() =>
    generateCourseOutline({ ...toOutlineParams(input), serviceTier }),
  );

  return { chapters: pickChapters({ outline: data, plan }), early: null, provenance };
}

/** One chapter per step, so a chapter that fails retries alone. */
export async function saveOutlineChapterStep({
  analytics,
  chapter,
  courseId,
  goalSkills,
  level,
  position,
  provenance,
  scope,
  workflowRunId,
}: OutlineContext & {
  chapter: OutlineChapter;
  goalSkills: GoalSkillRef[];
  level: CourseBandNeed["level"];
  position: number;
  provenance: OutlineProvenance;
}): Promise<SavedOutlineChapter> {
  "use step";

  return withAiRetry(() =>
    saveOutlineChapter({
      analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
      chapter,
      courseId,
      goalSkills,
      level,
      position,
      provenance,
      scope,
      workflowRunId,
    }),
  );
}

export async function placeContinuationsStep({
  chapterIds,
  chapters,
  courseId,
  plan,
}: {
  chapterIds: string[];
  chapters: OutlineChapter[];
  courseId: string;
  plan: BandPlan;
}): Promise<void> {
  "use step";

  const moves = chapters.flatMap((chapter, index) => {
    const extension = plan.extensions.find((item) => chapter.skillKeys.includes(item.skill.key));
    const chapterId = chapterIds[index];

    return extension && chapterId ? [{ afterChapterId: extension.afterChapterId, chapterId }] : [];
  });

  await placeContinuations({ courseId, level: plan.level, moves });
}

export async function listWaitingGoalsStep(input: {
  goalIds: string[];
  skillIds: string[];
}): Promise<string[]> {
  "use step";

  return listGoalsWaitingOnSkills(input);
}

export async function replanWaitingGoalStep(goalId: string): Promise<PlanStepOutcome<null>> {
  "use step";

  return catchPlanConflict(async () => {
    await replanWaitingGoal(goalId);
    return null;
  });
}

export async function logReplanFailureStep(failure: {
  courseId: string;
  error: string;
  goalIds: string[];
  skillIds: string[];
}): Promise<void> {
  "use step";

  logError("[courseOutlineWorkflow] Goals waiting on a band couldn't take its lessons:", failure);
}
