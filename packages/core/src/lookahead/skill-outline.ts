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
import { type CourseOutlineNeed } from "../library/curriculum/curriculum-scope";
import { refreshGoalPlan } from "../plans/refresh-goal-plan";
import { findSkillOutlineNeed, readSkillCourses } from "./plan-outline-needs";
import {
  type SkillOutlineAskRef,
  hasFreshSkillOutlineAsk,
  takeSkillOutlineAsk,
} from "./skill-outline-ask";
import { type SkillOutline } from "./skill-outline-contract";

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
    select: { id: true, userId: true, visibility: true },
    where: { id: courseId },
  });
}

type SkillCourse = NonNullable<Awaited<ReturnType<typeof findSkillCourse>>>;

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

/** Returns notFound for a skill outside the learner's plan; writing means the learner's own ask is still being written. */
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

  const status = (await hasFreshSkillOutlineAsk({ goalId, skillId })) ? "writing" : "available";
  return { outline: { chapters, status }, status: "ready" };
}

/** On start, generate need's band with skillId's chapter first, and end `ask` when that run ends; usage and the ask are already saved. */
export type SkillOutlineRequest =
  | { status: "ready" }
  | { status: "unavailable" }
  | { status: "writing" }
  | {
      analytics: { distinctId: string; goalId: string; platform: AnalyticsPlatform | null };
      ask: SkillOutlineAskRef;
      forGuest: boolean;
      need: CourseOutlineNeed;
      status: "start";
    }
  | { decision: RefusedUsage; status: "refused" };

/**
 * Learner action only. A topic no chapter teaches yet is claimed once across retries, even while
 * another run writes its course: that run may not cover it, and the outline workflow waits its turn.
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
    await refreshGoalPlan({ goalId });
    return { status: "ready" };
  }

  const decision = await claimUsage({ generated: true, kind: "outline", targetId: skillId });

  if (decision.status === "unauthorized") {
    return decision;
  }

  if (decision.status !== "allowed") {
    return { decision, status: "refused" };
  }

  const ask = await takeSkillOutlineAsk({ goalId, now: new Date(), skillId });

  if (!ask) {
    return { status: "writing" };
  }

  const user = await prisma.user.findUnique({
    select: { isAnonymous: true },
    where: { id: owned.userId },
  });

  return {
    analytics: { distinctId: owned.userId, goalId, platform: await getRequestPlatform() },
    ask,
    forGuest: user?.isAnonymous ?? false,
    need: found.need,
    status: "start",
  };
}
