import "server-only";
import {
  type LearningRequestSubject,
  resolveLearningRequest as classifyLearningRequest,
} from "@zoonk/ai/tasks/courses/request";
import { type CourseDiscovery, prisma } from "@zoonk/db";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { getSession } from "../../users/get-session";
import { type CourseDiscoveryDecision, discoveryResolutionSchema } from "../discovery-contract";
import { getCourseLearningPath, startCurrentUserCourse } from "../learning-plan";
import { CURRENT_CURRICULUM_VERSION } from "../learning-plan-contract";
import { claimLearningRequestQuota } from "./learning-request-quota";
import { resolveReusableLearningSubject } from "./reusable-learning-request";

const MAX_PUBLIC_SUBJECT_TITLE_LENGTH = 160;

export async function startCourseDiscovery({
  discoveryId,
  expectedRevision,
}: {
  discoveryId: string;
  expectedRevision: number;
}) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const discovery = await prisma.courseDiscovery.findFirst({
    where: { id: discoveryId, userId: session.user.id },
  });

  if (!discovery) {
    return { status: "notFound" as const };
  }

  if (discovery.revision !== expectedRevision) {
    return { status: "conflict" as const };
  }

  if (discovery.courseId) {
    return resumeDiscoveryCourse(discovery, discovery.courseId);
  }

  const parsedResolution = discoveryResolutionSchema.safeParse(discovery.resolution);
  const resolution = parsedResolution.success ? parsedResolution.data : null;

  if (
    !["ready", "generating"].includes(discovery.status) ||
    !resolution?.brief ||
    !resolution.format
  ) {
    return { status: "conflict" as const };
  }

  const quota = await claimLearningRequestQuota();

  if (quota.status !== "ready") {
    return quota;
  }

  const safety = await classifyLearningRequest({
    language: discovery.language,
    prompt: JSON.stringify({
      answers: discovery.answers,
      brief: resolution.brief,
      prompt: discovery.prompt,
    }),
  });

  if (safety.data.intent === "unsafe" || safety.data.intent === "exam") {
    await prisma.courseDiscovery.updateMany({
      data: { status: "blocked" },
      where: { id: discovery.id, revision: discovery.revision },
    });

    return { status: safety.data.intent };
  }

  if (resolution.format !== "personalized") {
    const subject = safety.data.subjects[0];

    if (
      safety.data.subjects.length !== 1 ||
      !subject ||
      !subject.title.trim() ||
      subject.title.length > MAX_PUBLIC_SUBJECT_TITLE_LENGTH
    ) {
      return { status: "conflict" as const };
    }

    return startReusableDiscovery(discovery, resolution, subject);
  }

  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM course_discoveries WHERE id = ${discoveryId}::uuid FOR UPDATE`;

    const current = await transaction.courseDiscovery.findUniqueOrThrow({
      where: { id: discoveryId },
    });

    if (current.courseId) {
      return current.courseId;
    }

    if (current.status !== "ready" || current.revision !== expectedRevision) {
      return null;
    }

    const brief = resolution.brief;

    if (!brief) {
      return null;
    }

    const course = await transaction.course.create({
      data: {
        curriculumVersion: CURRENT_CURRICULUM_VERSION,
        description: brief.description,
        discoveryBrief: brief,
        format: "personalized",
        generationStatus: "pending",
        isPublished: true,
        language: discovery.language,
        normalizedTitle: normalizeString(brief.title),
        slug: `${toSlug(brief.title)}-${discovery.id}`,
        title: brief.title,
        userId: session.user.id,
      },
    });

    await transaction.courseDiscovery.update({
      data: { courseId: course.id, status: "generating" },
      where: { id: discovery.id },
    });

    return course.id;
  });

  return result
    ? {
        courseId: result,
        resource: "curriculum" as const,
        resourceId: result,
        status: "generationRequired" as const,
      }
    : { status: "conflict" as const };
}

async function resumeDiscoveryCourse(discovery: CourseDiscovery, courseId: string) {
  const path = await getCourseLearningPath({ courseId });

  if (path.status !== "ready") {
    return path;
  }

  if (path.chapters.length === 0) {
    return {
      courseId,
      resource: "curriculum" as const,
      resourceId: courseId,
      status: "generationRequired" as const,
    };
  }

  await prisma.courseDiscovery.updateMany({
    data: { status: "completed" },
    where: { id: discovery.id, userId: discovery.userId },
  });

  return startCurrentUserCourse({ courseId });
}

async function startReusableDiscovery(
  discovery: CourseDiscovery,
  resolution: CourseDiscoveryDecision,
  subject: LearningRequestSubject,
) {
  if (
    !resolution.reusableCoursePrompt ||
    !resolution.brief ||
    !resolution.format ||
    resolution.format === "personalized"
  ) {
    return { status: "invalid" as const };
  }

  const target = await resolveReusableLearningSubject({
    language: discovery.language,
    subject: {
      format: subject.format,
      prompt: subject.title,
      requiresDiscovery: false,
      targetLanguage: subject.targetLanguage,
      title: subject.title,
    },
  });

  const claim = await prisma.courseDiscovery.updateMany({
    data: { status: "generating" },
    where: {
      id: discovery.id,
      revision: discovery.revision,
      status: { in: ["ready", "generating"] },
      userId: discovery.userId,
    },
  });

  if (claim.count === 0) {
    return { status: "conflict" as const };
  }

  if (target.kind === "course") {
    const started = await startCurrentUserCourse({
      courseId: target.course.id,
      input: {
        depth: "focused",
        goal: resolution.brief.learningGoal,
        startingKnowledge: resolution.brief.startingKnowledge,
      },
    });

    if (started.status !== "ready" && started.status !== "generationRequired") {
      return started;
    }

    await prisma.courseDiscovery.updateMany({
      data: { courseId: target.course.id, status: "completed" },
      where: { id: discovery.id, revision: discovery.revision, userId: discovery.userId },
    });

    return started;
  }

  await prisma.courseDiscovery.updateMany({
    data: { resolution: { ...resolution, coursePromptId: target.prompt.id }, status: "generating" },
    where: { id: discovery.id, revision: discovery.revision, userId: discovery.userId },
  });

  return {
    discoveryId: discovery.id,
    resource: "coursePrompt" as const,
    resourceId: target.prompt.id,
    status: "generationRequired" as const,
  };
}
