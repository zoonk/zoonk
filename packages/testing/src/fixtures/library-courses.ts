import { type Chapter, type Course, type Lesson } from "@zoonk/db";
import { courseFixture } from "./courses";
import { courseChapterFixture, libraryChapterFixture } from "./library-chapters";
import { chapterLessonFixture, libraryLessonFixture } from "./library-lessons";
import { organizationFixture } from "./orgs";

type CourseAttrs = NonNullable<Parameters<typeof courseFixture>[0]>;

/** Who the outline's chapters and lessons belong to: shared by default, or one learner's. */
type ContentOwner = { ownerId?: string; visibility?: "private" };

async function placeLessons({
  chapter,
  chapterNumber,
  count,
  owner,
}: {
  chapter: Chapter;
  chapterNumber: number;
  count: number;
  owner: ContentOwner;
}): Promise<Lesson[]> {
  const lessons = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      libraryLessonFixture({
        contentStatus: "completed",
        homeChapterId: chapter.id,
        title: `Lesson ${chapterNumber}.${index + 1}`,
        ...owner,
      }),
    ),
  );

  await Promise.all(
    lessons.map((lesson, position) =>
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
    ),
  );

  return lessons;
}

/**
 * Places one beginner chapter per entry of `lessonCounts` in the course, in order, each written
 * for this course and holding that many written lessons.
 */
async function placeOutline({
  course,
  lessonCounts,
  owner,
}: {
  course: Course;
  lessonCounts: number[];
  owner: ContentOwner;
}) {
  const chapters = await Promise.all(
    lessonCounts.map((_, index) =>
      libraryChapterFixture({
        homeCourseId: course.id,
        outlineStatus: "completed",
        title: `Chapter ${index + 1}`,
        ...owner,
      }),
    ),
  );

  const [lessons] = await Promise.all([
    Promise.all(
      chapters.map((chapter, index) =>
        placeLessons({ chapter, chapterNumber: index + 1, count: lessonCounts[index] ?? 0, owner }),
      ),
    ),
    Promise.all(
      chapters.map((chapter, position) =>
        courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position }),
      ),
    ),
  ]);

  return { chapters, lessons };
}

/**
 * A published brand course whose outline places one beginner chapter per entry of `lessonCounts`,
 * in order, each written for this course and holding that many written lessons.
 */
export async function catalogCourseFixture({
  lessonCounts = [1],
  ...attrs
}: CourseAttrs & { lessonCounts?: number[] } = {}) {
  const organization = await organizationFixture({ kind: "brand" });

  const course = await courseFixture({
    isPublished: true,
    organizationId: organization.id,
    outlineStatus: "completed",
    ...attrs,
  });

  const outline = await placeOutline({ course, lessonCounts, owner: {} });
  return { ...outline, course, organization };
}

/**
 * A learner's private course, as a goal too specific for shared content creates it: no
 * organization, never published, with an outline like `catalogCourseFixture`'s whose chapters and
 * lessons are private to the same learner.
 */
export async function privateCourseFixture({
  lessonCounts = [1],
  ownerId,
  ...attrs
}: CourseAttrs & { lessonCounts?: number[]; ownerId: string }) {
  const course = await courseFixture({
    outlineStatus: "completed",
    userId: ownerId,
    visibility: "private",
    ...attrs,
  });

  const outline = await placeOutline({
    course,
    lessonCounts,
    owner: { ownerId, visibility: "private" },
  });

  return { ...outline, course };
}
