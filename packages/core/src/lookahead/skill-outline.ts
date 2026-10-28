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

const WRITING_STALE_AFTER_MS = 900_000;

type OwnedSkillOutline<TResult> = TResult | { status: "notFound" } | { status: "unauthorized" };

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

function isBeingOutlined({ course, now }: { course: SkillCourse; now: Date }): boolean {
  return (
    (course.outlineStatus === "pending" || course.outlineStatus === "running") &&
    course.updatedAt > getStaleBefore(now)
  );
}

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

/** Returns notFound for a skill outside the learner's plan; writing may be another learner's shared outline run. */
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

/** On start, generate need's band with skillId's chapter first; usage and the pending course mark are already saved. */
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

/** Learner action only; existing/running outlines are free and each new topic is claimed once across retries. */
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
