import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { COURSE_LIST_CACHE_TAG, getUserProgressCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { enrollUserInCourse } from "../workflows/internal/enroll-user-in-course";
import { startTrack } from "./_utils/start-track";
import { toTrackResource, trackInclude, trackRequestSchema } from "./_utils/track-resources";
import { getReadableCourseWhere } from "./course-access";
import { getCourseLearningPaths } from "./learning-plan";
import {
  type TrackInput,
  type TrackUpdateInput,
  trackInputSchema,
  trackUpdateSchema,
} from "./track-contract";

export type { TrackResource } from "./_utils/track-resources";

export async function listCurrentUserTracks({ limit, cursor }: { limit: number; cursor?: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (cursor && !z.uuid().safeParse(cursor).success) {
    return { status: "invalid" as const };
  }

  const pageSize = Math.max(1, Math.min(Math.trunc(limit), 100));

  const tracks = await prisma.track.findMany({
    include: trackInclude,
    orderBy: { id: "desc" },
    take: pageSize + 1,
    where: { userId: session.user.id, ...(cursor ? { id: { lt: cursor } } : {}) },
  });

  const visible = tracks.slice(0, pageSize);

  const courseIds = [
    ...new Set(visible.flatMap((track) => track.courses.map(({ course }) => course.id))),
  ];

  const paths = await getCourseLearningPaths({ courseIds });

  const byCourse = new Map(
    courseIds.map((id, index) => [id, paths[index] ?? { status: "notFound" as const }]),
  );

  return {
    nextCursor: tracks.length > pageSize ? (visible.at(-1)?.id ?? null) : null,
    status: "ready" as const,
    tracks: await Promise.all(
      visible.map((track) =>
        toTrackResource(
          track,
          track.courses.map(
            ({ course }) => byCourse.get(course.id) ?? { status: "notFound" as const },
          ),
        ),
      ),
    ),
  };
}

export async function getCurrentUserTrack({ trackId }: { trackId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const track = await prisma.track.findFirst({
    include: trackInclude,
    where: { id: trackId, userId: session.user.id },
  });

  return track
    ? { status: "ready" as const, track: await toTrackResource(track) }
    : { status: "notFound" as const };
}

async function visibleCourseIds({ courseIds, userId }: { courseIds: string[]; userId: string }) {
  const courses = await prisma.course.findMany({
    where: { AND: [getReadableCourseWhere(userId) ?? {}, { id: { in: courseIds } }] },
  });

  return courses.length === courseIds.length;
}

function invalidateTracks(userId: string) {
  revalidateTag(COURSE_LIST_CACHE_TAG, { expire: 0 });
  revalidateTag(getUserProgressCacheTag(userId), { expire: 0 });
}

export async function createCurrentUserTrack(input: TrackInput) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const parsed = trackInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "invalid" as const };
  }

  if (!(await visibleCourseIds({ courseIds: parsed.data.courseIds, userId: session.user.id }))) {
    return { status: "notFound" as const };
  }

  const track = await prisma.track.create({
    data: {
      courses: {
        create: parsed.data.courseIds.map((courseId, position) => ({ courseId, position })),
      },
      title: parsed.data.title,
      userId: session.user.id,
    },
    include: trackInclude,
  });

  await Promise.all(
    parsed.data.courseIds.map((courseId) =>
      enrollUserInCourse({ courseId, userId: session.user.id }),
    ),
  );

  invalidateTracks(session.user.id);
  return { status: "ready" as const, track: await toTrackResource(track) };
}

function getTrackTitle(value: { title: string } | undefined) {
  if (!value) {
    throw new Error("The selected Track member is unavailable");
  }

  return value.title;
}

export async function updateCurrentUserTrack({
  trackId,
  input,
}: {
  trackId: string;
  input: TrackUpdateInput;
}) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const parsed = trackUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "invalid" as const };
  }

  const existing = await prisma.track.findFirst({
    where: { id: trackId, userId: session.user.id },
  });

  if (!existing) {
    return { status: "notFound" as const };
  }

  const members = parsed.data.members ?? parsed.data.courseIds?.map((courseId) => ({ courseId }));

  const courseIds =
    members?.flatMap((member) => ("courseId" in member ? [member.courseId] : [])) ?? [];

  const selectedCourses = await prisma.course.findMany({
    where: { ...getReadableCourseWhere(session.user.id), id: { in: courseIds } },
  });

  if (selectedCourses.length !== courseIds.length) {
    return { status: "notFound" as const };
  }

  const previousRequest = trackRequestSchema.safeParse(existing.request);
  const previousSubjects = previousRequest.success ? previousRequest.data.subjects : [];

  if (
    members?.some(
      (member) =>
        "coursePromptId" in member &&
        !previousSubjects.some((subject) => subject.coursePromptId === member.coursePromptId),
    )
  ) {
    return { status: "notFound" as const };
  }

  const subjects = members?.map((member) =>
    "courseId" in member
      ? {
          courseId: member.courseId,
          title: getTrackTitle(selectedCourses.find((course) => course.id === member.courseId)),
        }
      : {
          coursePromptId: member.coursePromptId,
          title:
            previousSubjects.find((subject) => subject.coursePromptId === member.coursePromptId)
              ?.title ?? "",
        },
  );

  const prompts = await prisma.coursePrompt.findMany({
    where: {
      id: {
        in:
          members?.flatMap((member) =>
            "coursePromptId" in member ? [member.coursePromptId] : [],
          ) ?? [],
      },
    },
  });

  const resolvedCourseIds = [
    ...courseIds,
    ...prompts.flatMap((prompt) => (prompt.courseId ? [prompt.courseId] : [])),
  ];

  if (new Set(resolvedCourseIds).size !== resolvedCourseIds.length) {
    return { status: "invalid" as const };
  }

  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM tracks WHERE id = ${trackId}::uuid FOR UPDATE`;

    const current = await transaction.track.findFirst({
      where: { id: trackId, userId: session.user.id },
    });

    if (!current) {
      return { status: "notFound" as const };
    }

    if (current.updatedAt.getTime() !== existing.updatedAt.getTime()) {
      return { status: "conflict" as const };
    }

    if (members) {
      await transaction.trackCourse.deleteMany({ where: { trackId } });
    }

    const track = await transaction.track.update({
      data: {
        updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
        ...(parsed.data.title ? { title: parsed.data.title } : {}),
        ...(members && subjects
          ? {
              courses: {
                create: members.flatMap((member, position) =>
                  "courseId" in member ? [{ courseId: member.courseId, position }] : [],
                ),
              },
              request: {
                ...(previousRequest.success
                  ? previousRequest.data
                  : { language: selectedCourses[0]?.language ?? "en" }),
                subjects,
              },
            }
          : {}),
      },
      include: trackInclude,
      where: { id: trackId, userId: session.user.id },
    });

    return { status: "ready" as const, track };
  });

  if (result.status !== "ready") {
    return result;
  }

  await Promise.all(
    courseIds.map((courseId) => enrollUserInCourse({ courseId, userId: session.user.id })),
  );

  invalidateTracks(session.user.id);
  return { status: "ready" as const, track: await toTrackResource(result.track) };
}

export async function removeCurrentUserTrack({ trackId }: { trackId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const result = await prisma.track.deleteMany({ where: { id: trackId, userId: session.user.id } });

  if (result.count === 0) {
    return { status: "notFound" as const };
  }

  invalidateTracks(session.user.id);
  return { status: "removed" as const };
}

export function startCurrentUserTrack(input: { trackId: string }) {
  return startTrack(input);
}
