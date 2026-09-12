import "server-only";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { isUuid } from "@zoonk/utils/uuid";
import { stableLearningId } from "../courses/_utils/stable-learning-id";
import { CURRENT_CURRICULUM_VERSION } from "../courses/learning-plan-contract";
import { claimGenerationQuotaIfNeeded } from "../generation-quotas/claim-generation-quota";
import { getSession } from "../users/get-session";

export async function getCourseCurriculumGenerationView({ courseId }: { courseId: string }) {
  if (!isUuid(courseId)) {
    return { status: "notFound" as const };
  }

  const session = await getSession();

  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { isPublished: true, organization: { slug: AI_ORG_SLUG }, userId: null },
        ...(session ? [{ organizationId: null, userId: session.user.id }] : []),
      ],
      id: courseId,
    },
  });

  if (!course) {
    return { status: "notFound" as const };
  }

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const needsGeneration =
    course.curriculumVersion < CURRENT_CURRICULUM_VERSION ||
    (await prisma.chapter.count({ where: { courseId } })) === 0;

  return { course, needsGeneration, status: "ready" as const };
}

/** A retry of the same replacement keeps its quota identity; a future revision is a new intent. */
function curriculumQuotaTarget({
  courseId,
  contentRevision,
}: {
  courseId: string;
  contentRevision: number;
}) {
  return stableLearningId(["curriculum", courseId, contentRevision]);
}

export async function getCourseCurriculumGenerationAccess({ courseId }: { courseId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (!isUuid(courseId)) {
    return { status: "notFound" as const };
  }

  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { organization: { slug: AI_ORG_SLUG }, userId: null },
        { organizationId: null, userId: session.user.id },
      ],
      id: courseId,
    },
  });

  if (!course) {
    return { status: "notFound" as const };
  }

  const needsGeneration =
    course.curriculumVersion < CURRENT_CURRICULUM_VERSION ||
    (await prisma.chapter.count({ where: { courseId } })) === 0;

  const shouldClaim = needsGeneration && course.generationStatus !== "running";

  const quota = await claimGenerationQuotaIfNeeded({
    resource: "course",
    shouldClaimQuota: shouldClaim,
    targetId: curriculumQuotaTarget({ contentRevision: course.contentRevision, courseId }),
  });

  if (quota.status === "limitReached") {
    return quota;
  }

  return { course, needsGeneration, shouldClaimQuota: false as const, status: "ready" as const };
}
