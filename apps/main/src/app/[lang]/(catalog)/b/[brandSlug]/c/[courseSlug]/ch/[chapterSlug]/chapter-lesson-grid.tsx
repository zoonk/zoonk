import { getChapter } from "@/data/chapters/get-chapter";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import { getUserHiddenLessonKinds } from "@/data/users/lesson-filter-settings";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { notFound } from "next/navigation";
import { ChapterNotGenerated } from "./chapter-not-generated";
import { LessonList } from "./lesson-list";

/**
 * Loads the public lesson collection in its own stream. The app-level chapter
 * and lesson caches deduplicate the reads shared with the sidebar.
 */
export async function ChapterLessonGrid({
  params,
}: Pick<PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">, "params">) {
  const { brandSlug, chapterSlug, courseSlug } = await params;

  const [chapter, hiddenLessonKinds] = await Promise.all([
    getChapter({ brandSlug, chapterSlug, courseSlug }),
    getUserHiddenLessonKinds(),
  ]);

  if (!chapter) {
    notFound();
  }

  const lessons = await listChapterLessons({ chapterId: chapter.id });

  if (brandSlug === AI_ORG_SLUG && lessons.length === 0) {
    return (
      <ChapterNotGenerated chapterId={chapter.id} courseHref={`/b/${brandSlug}/c/${courseSlug}`} />
    );
  }

  return (
    <LessonList
      brandSlug={brandSlug}
      chapterId={chapter.id}
      chapterSlug={chapterSlug}
      courseSlug={courseSlug}
      hiddenLessonKinds={hiddenLessonKinds}
      isLanguageCourse={Boolean(chapter.course.targetLanguage)}
      lessons={lessons}
    />
  );
}
