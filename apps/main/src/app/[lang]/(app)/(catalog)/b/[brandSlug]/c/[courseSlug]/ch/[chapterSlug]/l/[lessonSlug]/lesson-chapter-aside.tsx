import { CatalogAsideBlock } from "@/components/catalog/catalog-aside";
import { ChapterLessonRows } from "@/components/public/chapter-lesson-rows";
import { type LibraryLessonRoute } from "@/data/catalog/resolve-catalog-route";
import { Link } from "@/i18n/navigation";
import { getChapterHref } from "@/lib/public/public-hrefs";
import { getTotalDurationLabel } from "@/lib/public/public-labels";
import { getExtracted } from "next-intl/server";

/**
 * Beside the lesson from 72rem, the chapter it belongs to, as the chapter's page lists it: where it
 * sits in the course, its name (opening the chapter), how many lessons and how long, and its
 * lessons as numbered rows with this one marked. Narrower screens fold the same rows under the
 * question instead (`LessonMore`).
 */
export async function LessonChapterAside({
  params,
  route,
}: {
  params: { brandSlug: string; courseSlug: string };
  route: LibraryLessonRoute;
}) {
  const { chapter, lesson, number, total } = route;
  const minutes = chapter.lessons.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  const t = await getExtracted();
  const durationLabel = await getTotalDurationLabel(minutes);

  const facts = [
    t("{count, plural, one {# lesson} other {# lessons}}", { count: chapter.lessons.length }),
    durationLabel,
  ];

  return (
    <CatalogAsideBlock
      facts={facts.join(" · ")}
      id={`lesson-chapter-${lesson.id}`}
      title={t("Chapter {number} of {total}", { number: String(number), total: String(total) })}
    >
      <Link
        className="focus-visible:ring-ring/50 hit-area relative -mt-1 rounded-md text-[0.9375rem] font-semibold text-pretty outline-none hover:underline hover:underline-offset-4 focus-visible:ring-[3px]"
        href={getChapterHref({ ...params, chapterSlug: chapter.slug })}
        prefetch
      >
        {chapter.title}
      </Link>

      <ChapterLessonRows chapter={chapter} currentLessonId={lesson.id} params={params} />
    </CatalogAsideBlock>
  );
}
