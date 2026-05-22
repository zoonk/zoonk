import "server-only";
import { getPublishedLessonWhere, prisma } from "@zoonk/db";
import { cache } from "react";
import { decodeRouteParam } from "../_utils/route-params";

const cachedGetLesson = cache(
  async (brandSlug: string, courseSlug: string, chapterSlug: string, lessonSlug: string) =>
    prisma.lesson.findFirst({
      include: { chapter: { include: { course: true } } },
      where: getPublishedLessonWhere({
        chapterWhere: { slug: chapterSlug },
        courseWhere: { organization: { kind: "brand", slug: brandSlug }, slug: courseSlug },
        lessonWhere: { slug: lessonSlug },
      }),
    }),
);

export function getLesson(params: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
}) {
  return cachedGetLesson(
    decodeRouteParam(params.brandSlug),
    decodeRouteParam(params.courseSlug),
    decodeRouteParam(params.chapterSlug),
    decodeRouteParam(params.lessonSlug),
  );
}
