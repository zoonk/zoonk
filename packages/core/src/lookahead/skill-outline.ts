import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getRequestPlatform } from "../analytics/request-platform";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import { claimUsage } from "../entitlements/claim-usage";
import { type RefusedUsage } from "../entitlements/contract";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { getBandRank } from "../learner/placement/placement-graph";
import { libraryRowsVisibleTo } from "../library/_utils/library-visibility";
import { refreshGoalPlan } from "../plans/refresh-goal-plan";
import { type PlanOutlineNeed, findSkillOutlineNeed, readSkillCourses } from "./plan-outline-needs";
import { type SkillOutline } from "./skill-outline-contract";

/**
 * A course outline that has held its course this long stopped (a run that writes a band takes a
 * minute or two, ten under a burst of them): its topics can be asked for again.
 */
const WRITING_STALE_AFTER_MS = 900_000;

type OwnedSkillOutline<TResult> = TResult | { status: "notFound" } | { status: "unauthorized" };

/** The Library course the plan takes the skill's lessons from; null when the plan has no such skill. */
async function findSkillCourse({ goalId, skillId }: { goalId: string; skillId: string }) {
  const plan = await prisma.plan.findUnique({
    select: { goal: { select: { primaryCourseId: true } }, graph: true },
    where: { goalId },
  });

  const courseId = plan
    ? readSkillCourses({ graph: plan.graph, primaryCourseId: plan.goal.primaryCourseId }).get(
        skillId,
      )
    : undefined;

  if (!courseId) {
    return null;
  }

  return prisma.course.findUnique({
    select: { id: true, outlineStatus: true, updatedAt: true, userId: true, visibility: true },
    where: { id: courseId },
  });
}

type SkillCourse = NonNullable<Awaited<ReturnType<typeof findSkillCourse>>>;

function getStaleBefore(now: Date): Date {
  return new Date(now.getTime() - WRITING_STALE_AFTER_MS);
}

/**
 * Its outline is being written (`running`), or was asked for and the run started for it hasn't
 * taken the course yet (`pending`), lately: a claim this old stopped.
 */
function isBeingOutlined({ course, now }: { course: SkillCourse; now: Date }): boolean {
  return (
    (course.outlineStatus === "pending" || course.outlineStatus === "running") &&
    course.updatedAt > getStaleBefore(now)
  );
}

/**
 * Marks the course's outline as asked for (`pending`, which the run's claim takes), so the topic
 * reads as being written from the tap on rather than once the run gets to the course, seconds
 * later. A run outlining the course keeps it; one that stopped is replaced.
 */
async function markOutlineAsked({ course, now }: { course: SkillCourse; now: Date }) {
  await prisma.course.updateMany({
    data: { outlineStatus: "pending", updatedAt: now },
    where: {
      OR: [
        { outlineStatus: null },
        { outlineStatus: { not: "running" } },
        { updatedAt: { lt: getStaleBefore(now) } },
      ],
      id: course.id,
    },
  });
}

/**
 * The course's chapters with lessons that teach the skill (tagged with it, or with a lesson that
 * teaches it), in the course's order: as `findUntaughtSkills` counts a skill taught.
 */
async function listSkillChapters({
  course,
  skillId,
}: {
  course: SkillCourse;
  skillId: string;
}): Promise<SkillOutline["chapters"]> {
  const ownerId = course.visibility === "private" ? course.userId : null;

  const chapters = await prisma.chapter.findMany({
    select: {
      courses: { select: { level: true, position: true }, where: { courseId: course.id } },
      id: true,
      title: true,
    },
    where: {
      ...libraryRowsVisibleTo(ownerId),
      OR: [
        { goalSkills: { some: { skillId } } },
        { lessons: { some: { lesson: { skills: { some: { skillId } } } } } },
      ],
      courses: { some: { courseId: course.id } },
      lessons: { some: {} },
    },
  });

  // A course's bands in order, each band's chapters by position.
  const compare = (first: (typeof chapters)[number], second: (typeof chapters)[number]) => {
    const [a] = first.courses;
    const [b] = second.courses;

    if (!a || !b) {
      return 0;
    }

    return getBandRank(a.level) - getBandRank(b.level) || a.position - b.position;
  };

  return chapters
    .toSorted(compare)
    .map((chapter) => ({ chapterId: chapter.id, title: chapter.title }));
}

/**
 * A topic of the learner's plan as its lesson plan stands: its chapters once its course outlined
 * them (`ready`), its course's outline being written (`writing`), or nothing written yet
 * (`available`), which the learner can ask for now or the plan writes as it gets close. A skill
 * outside the goal's plan isn't found.
 */
export async function getSkillOutline({
  goalId,
  skillId,
}: {
  goalId: string;
  skillId: string;
}): Promise<OwnedSkillOutline<{ outline: SkillOutline; status: "ready" }>> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const course = isUuid(skillId) ? await findSkillCourse({ goalId, skillId }) : null;

  if (!course) {
    return { status: "notFound" };
  }

  const chapters = await listSkillChapters({ course, skillId });

  if (chapters.length > 0) {
    return { outline: { chapters, status: "ready" }, status: "ready" };
  }

  const status = isBeingOutlined({ course, now: new Date() }) ? "writing" : "available";
  return { outline: { chapters, status }, status: "ready" };
}

/**
 * `ready`: the topic's chapters exist (the plan takes them now). `writing`: its course's outline
 * is being written, by this learner's earlier tap or anyone else's. `start`: the caller starts the
 * outline of the topic's band (`need`), the chapter teaching `skillId` first; the use is counted
 * and the course marked as asked for, so it reads as being written until the run ends.
 * `refused`: the learner's lesson plans for now are used up. `unavailable`: the plan has nothing
 * left to write for the skill (it was studied, settled or left out).
 */
export type SkillOutlineRequest =
  | { status: "ready" }
  | { status: "unavailable" }
  | { status: "writing" }
  | {
      analytics: { distinctId: string; goalId: string; platform: AnalyticsPlatform | null };
      forGuest: boolean;
      need: PlanOutlineNeed;
      status: "start";
    }
  | { decision: RefusedUsage; status: "refused" };

/**
 * What tapping "See the lessons" on a far topic does, never a screen view: lessons that exist or
 * are being written cost nothing and start nothing; otherwise the topic's lesson plan counts
 * toward the learner's lesson plans (once per topic, so asking again after a failed run is free)
 * and the caller starts the outline of its band, which every later learner of the course shares.
 */
export async function requestSkillOutline({
  goalId,
  skillId,
}: {
  goalId: string;
  skillId: string;
}): Promise<OwnedSkillOutline<SkillOutlineRequest>> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  if (!isUuid(skillId)) {
    return { status: "notFound" };
  }

  const [found, course] = await Promise.all([
    findSkillOutlineNeed({ goalId, skillId }),
    findSkillCourse({ goalId, skillId }),
  ]);

  if (!course) {
    return { status: "notFound" };
  }

  if (!found) {
    const chapters = await listSkillChapters({ course, skillId });
    return { status: chapters.length > 0 ? "ready" : "unavailable" };
  }

  if (found.status === "taught") {
    // Its course teaches it already, in whole or in part (another learner's outline): its chapters
    // show now, the plan takes their lessons, and writes the rest as it gets close.
    await refreshGoalPlan({ goalId });
    return { status: "ready" };
  }

  const now = new Date();

  if (isBeingOutlined({ course, now })) {
    return { status: "writing" };
  }

  const decision = await claimUsage({ generated: true, kind: "outline", targetId: skillId });

  if (decision.status === "unauthorized") {
    return decision;
  }

  if (decision.status !== "allowed") {
    return { decision, status: "refused" };
  }

  const [user] = await Promise.all([
    prisma.user.findUnique({ select: { isAnonymous: true }, where: { id: owned.userId } }),
    markOutlineAsked({ course, now }),
  ]);

  return {
    analytics: { distinctId: owned.userId, goalId, platform: await getRequestPlatform() },
    forGuest: user?.isAnonymous ?? false,
    need: found.need,
    status: "start",
  };
}
