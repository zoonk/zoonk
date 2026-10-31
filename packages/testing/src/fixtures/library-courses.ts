import { type Chapter, type Course, type Lesson } from "@zoonk/db";
import { courseFixture } from "./courses";
import { courseChapterFixture, libraryChapterFixture } from "./library-chapters";
import { chapterLessonFixture, libraryLessonFixture } from "./library-lessons";
import { organizationFixture } from "./orgs";

type CourseAttrs = NonNullable<Parameters<typeof courseFixture>[0]>;

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
