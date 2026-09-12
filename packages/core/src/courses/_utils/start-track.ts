import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "../../users/get-session";
import { getCourseBrandSlug, isGeneratedCourse } from "../course-access";
import { getCourseLearningPaths, startCurrentUserCourse } from "../learning-plan";
import {
  isTrackCourseIncomplete,
  pendingTrackCourses,
  toTrackResource,
  trackInclude,
  trackRequestSchema,
} from "./track-resources";

/** Explicit starts bind newly generated public courses to the private ordered request. */
export async function startTrack({ trackId }: { trackId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const existing = await prisma.track.findFirst({
    include: trackInclude,
    where: { id: trackId, userId: session.user.id },
  });

  if (!existing) {
    return { status: "notFound" as const };
  }

  const pending = pendingTrackCourses(existing);

  const prompts = await prisma.coursePrompt.findMany({
    include: { course: true },
    where: { id: { in: pending.map((row) => row.coursePromptId) } },
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM tracks WHERE id = ${trackId}::uuid FOR UPDATE`;

    const current = await transaction.track.findFirst({
      include: trackInclude,
      where: { id: trackId, userId: session.user.id },
    });

    if (!current) {
      return;
    }

    const request = trackRequestSchema.safeParse(current.request);

    if (!request.success) {
      return;
    }

    const subjects = request.data.subjects.map((subject) => {
      const course = prompts.find((prompt) => prompt.id === subject.coursePromptId)?.course;

      return course?.isPublished &&
        course.userId === null &&
        course.generationStatus === "completed"
        ? { courseId: course.id, title: subject.title }
        : subject;
    });

    const unique = subjects.filter(
      (subject, index) =>
        subjects.findIndex(
          (candidate) =>
            (candidate.courseId ?? candidate.coursePromptId) ===
            (subject.courseId ?? subject.coursePromptId),
        ) === index,
    );

    if (JSON.stringify(unique) === JSON.stringify(request.data.subjects)) {
      return;
    }

    await transaction.trackCourse.deleteMany({ where: { trackId } });

    await transaction.trackCourse.createMany({
      data: unique.flatMap((subject, position) =>
        subject.courseId ? [{ courseId: subject.courseId, position, trackId }] : [],
      ),
    });

    await transaction.track.update({
      data: { request: { ...request.data, subjects: unique } },
      where: { id: trackId },
    });
  });

  const track = await prisma.track.findFirst({
    include: trackInclude,
    where: { id: trackId, userId: session.user.id },
  });

  if (!track) {
    return { status: "notFound" as const };
  }

  const unresolved = pendingTrackCourses(track);

  const paths = await getCourseLearningPaths({
    courseIds: track.courses.map((member) => member.course.id),
  });

  for (const [index, member] of track.courses.entries()) {
    if (unresolved[0] && unresolved[0].position < member.position) {
      return {
        resource: "coursePrompt" as const,
        resourceId: unresolved[0].coursePromptId,
        status: "generationRequired" as const,
        trackId,
      };
    }

    const path = paths[index];

    if (path?.status === "ready" && isTrackCourseIncomplete(path)) {
      if (
        path.supportsLearningPlan &&
        !path.plan &&
        !["question", "personalized"].includes(member.course.format)
      ) {
        return {
          brandSlug: getCourseBrandSlug(member.course),
          courseId: member.course.id,
          courseSlug: member.course.slug,
          status: "needsPlan" as const,
        };
      }

      if (!path.nextTarget && !isGeneratedCourse(member.course)) {
        return { status: "unavailable" as const };
      }

      return startCurrentUserCourse({ courseId: member.course.id });
    }
  }

  if (unresolved[0]) {
    return {
      resource: "coursePrompt" as const,
      resourceId: unresolved[0].coursePromptId,
      status: "generationRequired" as const,
      trackId,
    };
  }

  return { status: "completed" as const, track: await toTrackResource(track) };
}
