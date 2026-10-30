import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import { generateCourseOutline } from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import { findTeachingChapters } from "@zoonk/ai/tasks/v2/curriculum/teaching-chapters";
import {
  type CourseContentWrite,
  collectCourseContentTags,
} from "@zoonk/core/cache/course-content";
import {
  claimCourseOutline,
  findUntaughtSkills,
  finishCourseOutline,
  getCourseBandContext,
  getCourseOutlineOwner,
  releaseStaleCourseOutline,
} from "@zoonk/core/library/curriculum/course-outline-state";
import { placeChaptersAfter } from "@zoonk/core/library/curriculum/place-chapters-after";
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
import {
  loadBandChapters,
  tagTeachingChapters,
} from "@zoonk/core/library/curriculum/teaching-chapters";
import { logError } from "@zoonk/utils/logger";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { catchPlanConflict } from "../../_shared/plan-conflict-outcome";
import { type PlanStepOutcome } from "../../_shared/plan-conflict-retry";
import { isRunActive } from "../../_shared/run-activity";
import {
  type BandAnchors,
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

  return collectCourseContentTags(() => claimCourseOutlineWhenFree(input));
}

async function claimCourseOutlineWhenFree(input: { courseId: string; workflowRunId: string }) {
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
}): Promise<CourseContentWrite<void>> {
  "use step";

  return collectCourseContentTags(() => finishCourseOutline(input));
}

function getBandWait({ background, waited }: { background?: boolean; waited: boolean }): CallWait {
  if (waited) {
    return "learner";
  }

  return background ? "later" : "soon";
}

type BandWait = { background?: boolean; waitedSkillId?: string };

function getBandTier({ background, plan, scope, waitedSkillId }: BandWait & BandInput) {
  return chooseServiceTier({
    reuse: getScopeReuse(scope),
    wait: getBandWait({
      background,
      waited: plan.skills.some((skill) => skill.id === waitedSkillId),
    }),
  });
}

type BandCoverage = { anchors: BandAnchors; plan: BandPlan; taughtSkillIds: string[] };

/**
 * A shared band's chapters already teach most of what a new goal's skills ask in other words, so
 * they're tagged with those skills, and only the rest get chapters of their own. An exam's band
 * keeps each chapter to one of its subjects, which this doesn't weigh, so it writes as before.
 */
export async function coverBandSkillsStep(
  input: BandInput & BandWait,
): Promise<CourseContentWrite<BandCoverage>> {
  "use step";

  return collectCourseContentTags(() => coverBandSkills(input));
}

async function coverBandSkills({
  background,
  waitedSkillId,
  ...input
}: BandInput & BandWait): Promise<BandCoverage> {
  const { analytics, courseId, plan, scope, workflowRunId } = input;

  if (plan.isNewBand || scope.ownerId || scope.exams?.length || plan.skills.length === 0) {
    return { anchors: {}, plan, taughtSkillIds: [] };
  }

  const chapters = await loadBandChapters({ courseId, level: plan.level, ownerId: null });

  const { data } = await withAiRetry(() =>
    findTeachingChapters({
      analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
      chapters: chapters.map(({ lessons, title }) => ({ lessons, title })),
      courseTitle: plan.courseTitle,
      language: scope.language,
      level: plan.level,
      serviceTier: getBandTier({ ...input, background, waitedSkillId }),
      skills: plan.skills.map(({ description, key, name }) => ({ description, key, name })),
    }),
  );

  const chapterAt = (number: number | null) =>
    number === null ? null : (chapters[number - 1]?.chapterId ?? null);

  const answers = new Map(data.map((answer) => [answer.key, answer]));

  const teaching = plan.skills.flatMap((skill) => {
    const chapterId = chapterAt(answers.get(skill.key)?.chapter ?? null);
    return chapterId ? [{ chapterId, skill }] : [];
  });

  await tagTeachingChapters({
    courseId,
    tags: [...Map.groupBy(teaching, (entry) => entry.chapterId)].map(([chapterId, entries]) => ({
      chapterId,
      skillIds: entries.map((entry) => entry.skill.id),
    })),
  });

  const taught = new Set(teaching.map((entry) => entry.skill.id));
  const untaught = plan.skills.filter((skill) => !taught.has(skill.id));

  return {
    anchors: Object.fromEntries(
      untaught.map((skill) => [skill.key, chapterAt(answers.get(skill.key)?.after ?? null)]),
    ),
    plan: {
      ...plan,
      skills: untaught,
      taughtElsewhere: [...plan.taughtElsewhere, ...teaching.map((entry) => entry.skill.name)],
    },
    taughtSkillIds: [...taught],
  };
}

export async function writeOutlineBandStep({
  background,
  waitedSkillId,
  ...input
}: BandInput & BandWait): Promise<BandOutline> {
  "use step";

  const { plan } = input;
  const waitedKey = plan.skills.find((skill) => skill.id === waitedSkillId)?.key;
  const serviceTier = getBandTier({ ...input, background, waitedSkillId });

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
}): Promise<CourseContentWrite<SavedOutlineChapter>> {
  "use step";

  return collectCourseContentTags(() =>
    withAiRetry(() =>
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
    ),
  );
}

export async function placeChaptersAfterStep(
  input: Parameters<typeof placeChaptersAfter>[0],
): Promise<CourseContentWrite<void>> {
  "use step";

  return collectCourseContentTags(() => placeChaptersAfter(input));
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
