import "server-only";
import { type Lesson, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateTag } from "next/cache";
import { getChapterCacheTag, getCourseCurriculumCacheTag } from "../cache/tags";
import { getChapterById } from "../chapters/get-chapter-by-id";
import { getCourseBrandSlug } from "../courses/course-access";
import { getSession } from "../users/get-session";
import { listChapterLessons } from "./list-chapter-lessons";
import { getReadableLessonWhere } from "./read-access";

const ACTIVITY_KINDS = ["quiz", "practice"] as const;
export type OptionalActivityKind = (typeof ACTIVITY_KINDS)[number];

function linkedActivity(lessons: Lesson[], source: Lesson, kind: OptionalActivityKind) {
  const linked = lessons.find(
    (lesson) => lesson.sourceLessonId === source.id && lesson.kind === kind,
  );

  if (linked) {
    return linked;
  }

  const nextTeaching = lessons.find(
    (lesson) =>
      lesson.position > source.position &&
      ["explanation", "tutorial", "custom"].includes(lesson.kind),
  );

  return (
    lessons.find(
      (lesson) =>
        !lesson.sourceLessonId &&
        lesson.kind === kind &&
        lesson.position > source.position &&
        lesson.position < (nextTeaching?.position ?? Infinity),
    ) ?? null
  );
}

async function getActivitySource(lessonId: string) {
  if (!isUuid(lessonId)) {
    return null;
  }

  const session = await getSession();

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: { include: { course: { include: { organization: true } } } } },
    where: getReadableLessonWhere({ lessonId, userId: session?.user.id ?? null }),
  });

  if (
    !lesson ||
    !["explanation", "tutorial", "custom"].includes(lesson.kind) ||
    lesson.chapter.course.format === "language"
  ) {
    return null;
  }

  return lesson;
}

function buildOptionalActivities({
  lessons,
  source,
  brandSlug,
  chapterSlug,
  courseSlug,
  courseId,
}: {
  lessons: Lesson[];
  source: Lesson;
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  courseId: string;
}) {
  return {
    activities: ACTIVITY_KINDS.map((kind) => ({
      kind,
      lesson: linkedActivity(lessons, source, kind),
    })),
    source: {
      brandSlug,
      chapterId: source.chapterId,
      chapterSlug,
      courseId,
      courseSlug,
      lessonId: source.id,
    },
    status: "ready" as const,
  };
}

/** Optional activities are discoverable beside their teaching source and never enter required progress. */
export async function getLessonOptionalActivities({ lessonId }: { lessonId: string }) {
  const source = await getActivitySource(lessonId);

  if (!source) {
    return { status: "notFound" as const };
  }

  const lessons = await listChapterLessons({ chapterId: source.chapterId });

  return buildOptionalActivities({
    brandSlug: getCourseBrandSlug(source.chapter.course),
    chapterSlug: source.chapter.slug,
    courseId: source.chapter.courseId,
    courseSlug: source.chapter.course.slug,
    lessons,
    source,
  });
}

/** Reads source groups in one chapter without creating missing activities or generating content. */
export async function listChapterOptionalActivities({
  chapterId,
  view = "teaching",
}: {
  chapterId: string;
  view?: "teaching" | "curriculum";
}) {
  const chapter = await getChapterById({ chapterId });

  if (!chapter) {
    return { status: "notFound" as const };
  }

  const [lessons, teachingLessons] = await Promise.all([
    listChapterLessons({ chapterId }),
    listChapterLessons({ chapterId, view }),
  ]);

  const reviews = lessons.filter((lesson) => lesson.kind === "review");

  if (chapter.course.format === "language") {
    return { courseId: chapter.courseId, groups: [], reviews, status: "ready" as const };
  }

  const course = await prisma.course.findUniqueOrThrow({
    include: { organization: true },
    where: { id: chapter.courseId },
  });

  return {
    courseId: chapter.courseId,
    groups: teachingLessons
      .filter(
        (lesson) =>
          lesson.generationStatus === "completed" &&
          ["explanation", "tutorial", "custom"].includes(lesson.kind),
      )
      .map((source) => ({
        ...buildOptionalActivities({
          brandSlug: getCourseBrandSlug(course),
          chapterSlug: chapter.slug,
          courseId: course.id,
          courseSlug: course.slug,
          lessons,
          source,
        }),
        title: source.title,
      })),
    reviews,
    status: "ready" as const,
  };
}

/** Creates a missing optional shell only on an authenticated learner's explicit request. */
export async function startLessonOptionalActivity({
  lessonId,
  kind,
}: {
  lessonId: string;
  kind: OptionalActivityKind;
}) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (!ACTIVITY_KINDS.some((candidate) => candidate === kind)) {
    return { status: "invalid" as const };
  }

  const source = await getActivitySource(lessonId);

  if (!source || source.generationStatus !== "completed") {
    return { status: "notFound" as const };
  }

  const lesson = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM courses WHERE id = ${source.chapter.courseId}::uuid FOR UPDATE`;

    const current = await transaction.lesson.findFirst({
      where: {
        ...getReadableLessonWhere({ lessonId, userId: session.user.id }),
        generationStatus: "completed",
      },
    });

    if (!current) {
      return null;
    }

    const lessons = await transaction.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: current.chapterId },
    });

    const existing = linkedActivity(lessons, current, kind);

    if (existing) {
      return existing.sourceLessonId
        ? existing
        : transaction.lesson.update({
            data: { sourceLessonId: current.id },
            where: { id: existing.id },
          });
    }

    return transaction.lesson.create({
      data: {
        chapterId: current.chapterId,
        description: current.description,
        isPublished: true,
        kind,
        language: current.language,
        normalizedTitle: current.normalizedTitle,
        organizationId: current.organizationId,
        position: (lessons.at(-1)?.position ?? -1) + 1,
        slug: `${current.slug}-${kind}`,
        sourceLessonId: current.id,
        title: current.title,
      },
    });
  });

  if (!lesson) {
    return { status: "notFound" as const };
  }

  revalidateTag(getChapterCacheTag(source.chapterId), { expire: 0 });
  revalidateTag(getCourseCurriculumCacheTag(source.chapter.courseId), { expire: 0 });

  return lesson.generationStatus === "completed"
    ? { lesson, status: "ready" as const }
    : {
        lesson,
        resource: "lesson" as const,
        resourceId: lesson.id,
        status: "generationRequired" as const,
      };
}
