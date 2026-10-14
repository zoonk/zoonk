import { type LibraryChapterRoute } from "@/data/catalog/resolve-catalog-route";
import { getLessonHref } from "@/lib/public/public-hrefs";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { NumberedRows } from "./numbered-rows";

/**
 * A chapter's lessons in order, one tap each, with how long each takes: on the chapter's page the
 * first one stands out as where it starts, and on a lesson's page the lesson being read
 * (`currentLessonId`), so the list also says where the reader is.
 */
export async function ChapterLessonRows({
  chapter,
  currentLessonId,
  params,
}: {
  chapter: LibraryChapterRoute["chapter"];
  currentLessonId?: string;
  params: { brandSlug: string; courseSlug: string };
}) {
  const formatMinutes = await getMinutesFormatter();

  const rows = chapter.lessons.map((lesson) => ({
    href: getLessonHref({ ...params, chapterSlug: chapter.slug, lessonSlug: lesson.slug }),
    id: lesson.id,
    title: lesson.title,
    trailing: formatMinutes(lesson.estimatedMinutes),
  }));

  return <NumberedRows currentId={currentLessonId} rows={rows} startId={rows[0]?.id} />;
}
