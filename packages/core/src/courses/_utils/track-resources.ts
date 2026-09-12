import { type CourseFormat, type CourseGetPayload, type Track } from "@zoonk/db";
import { z } from "zod";
import { getCourseBrandSlug } from "../course-access";
import { type CourseLearningTarget, getCourseLearningPaths } from "../learning-plan";

type TrackProgress = {
  completedLessons: number;
  totalLessons: number;
  completedChapters: number;
  totalChapters: number;
  pendingChapters: number;
};

type TrackCourseSummary = {
  position: number;
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  format: CourseFormat;
  brandSlug: string;
  progress: TrackProgress;
};
export type TrackResource = Pick<Track, "id" | "title" | "createdAt" | "updatedAt"> & {
  courses: TrackCourseSummary[];
  progress: {
    completedCourses: number;
    totalCourses: number;
    completedLessons: number;
    totalLessons: number;
    pendingChapters: number;
  };
  nextTarget: CourseLearningTarget | null;
  pendingCourses: { title: string; coursePromptId: string; position: number }[];
};

export type TrackWithCourses = Track & {
  courses: { position: number; course: CourseGetPayload<{ include: { organization: true } }> }[];
};

export const trackRequestSchema = z.object({
  language: z.string(),
  prompt: z.string().optional(),
  subjects: z.array(
    z.object({
      courseId: z.uuid().optional(),
      coursePromptId: z.uuid().optional(),
      title: z.string(),
    }),
  ),
});

export function pendingTrackCourses(track: TrackWithCourses) {
  const request = trackRequestSchema.safeParse(track.request);

  if (!request.success) {
    return [];
  }

  const positions = new Set(track.courses.map((row) => row.position));

  return request.data.subjects.flatMap((subject, position) =>
    subject.coursePromptId && !positions.has(position)
      ? [{ coursePromptId: subject.coursePromptId, position, title: subject.title }]
      : [],
  );
}

export function isTrackCourseIncomplete(
  path: Awaited<ReturnType<typeof getCourseLearningPaths>>[number],
) {
  return (
    path.status === "ready" &&
    (path.progress.totalChapters === 0 ||
      path.progress.completedChapters < path.progress.totalChapters ||
      (path.plan !== null && path.needsPlan))
  );
}

export async function toTrackResource(
  track: TrackWithCourses,
  preloadedPaths?: Awaited<ReturnType<typeof getCourseLearningPaths>>,
): Promise<TrackResource> {
  const pendingCourses = pendingTrackCourses(track);

  const paths =
    preloadedPaths ??
    (await getCourseLearningPaths({ courseIds: track.courses.map(({ course }) => course.id) }));

  const courses = track.courses.flatMap(({ course, position }, index) => {
    const path = paths[index];

    if (path?.status !== "ready") {
      return [];
    }

    return [
      {
        brandSlug: getCourseBrandSlug(course),
        format: course.format,
        id: course.id,
        imageUrl: course.imageUrl,
        position,
        progress: {
          ...path.progress,
          pendingChapters: path.chapters.filter((chapter) => chapter.totalLessons === 0).length,
        },
        slug: course.slug,
        title: course.title,
      },
    ];
  });

  const nextPath = paths.find(
    (path, index) =>
      isTrackCourseIncomplete(path) &&
      (pendingCourses[0]?.position ?? Infinity) > (track.courses[index]?.position ?? Infinity),
  );

  return {
    courses,
    createdAt: track.createdAt,
    id: track.id,
    nextTarget: nextPath?.status === "ready" ? nextPath.nextTarget : null,
    pendingCourses,
    progress: {
      completedCourses: paths.filter(
        (path) => path.status === "ready" && !isTrackCourseIncomplete(path),
      ).length,
      completedLessons: courses.reduce(
        (total, course) => total + course.progress.completedLessons,
        0,
      ),
      pendingChapters: courses.reduce(
        (total, course) => total + course.progress.pendingChapters,
        0,
      ),
      totalCourses: courses.length + pendingCourses.length,
      totalLessons: courses.reduce((total, course) => total + course.progress.totalLessons, 0),
    },
    title: track.title,
    updatedAt: track.updatedAt,
  };
}

export const trackInclude = {
  courses: {
    include: { course: { include: { organization: true } } },
    orderBy: { position: "asc" as const },
  },
};
