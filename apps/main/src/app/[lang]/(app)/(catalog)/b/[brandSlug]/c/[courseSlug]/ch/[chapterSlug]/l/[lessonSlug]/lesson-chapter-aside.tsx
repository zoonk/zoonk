import { ChapterLessonRows } from "@/components/public/chapter-lesson-rows";
import { type LibraryLessonRoute } from "@/data/catalog/resolve-catalog-route";
import { Link } from "@/i18n/navigation";
import { getChapterHref } from "@/lib/public/public-hrefs";
import { getTotalDurationLabel } from "@/lib/public/public-labels";
import { getSubject } from "@zoonk/learn/subject-label";
import { getExtracted } from "next-intl/server";

/**
 * Beside the lesson from 72rem, the chapter it belongs to, as the chapter's page lists it: where it
 * sits in the course, how many lessons and how long, in one quiet line, its name (opening the
 * chapter), then its lessons as a stretch of the course's route with this one on an ink ring, in
 * the course's subject color (the aside sits outside the page's column, so it names it again).
 * Narrower screens fold the same rows under the question instead (`LessonMore`).
 */
export async function LessonChapterAside({
  params,
  route,
}: {
  params: { brandSlug: string; courseSlug: string };
  route: LibraryLessonRoute;
}) {
  const { chapter, course, lesson, number, total } = route;
  const minutes = chapter.lessons.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  const t = await getExtracted();
  const durationLabel = await getTotalDurationLabel(minutes);
  const titleId = `lesson-chapter-${lesson.id}`;

  const facts = [
    t("Chapter {number} of {total}", { number: String(number), total: String(total) }),
    t("{count, plural, one {# lesson} other {# lessons}}", { count: chapter.lessons.length }),
    durationLabel,
  ];

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3"
      data-subject={getSubject(course.categories)}
    >
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground font-mono text-xs tabular-nums">{facts.join(" · ")}</p>

        <h2 className="text-[0.9375rem] leading-snug font-semibold text-pretty" id={titleId}>
          <Link
            className="focus-visible:ring-ring/50 hit-area relative rounded-md outline-none hover:underline hover:underline-offset-4 focus-visible:ring-[3px]"
            href={getChapterHref({ ...params, chapterSlug: chapter.slug })}
            prefetch
          >
            {chapter.title}
          </Link>
        </h2>
      </div>

      <ChapterLessonRows chapter={chapter} currentLessonId={lesson.id} params={params} />
    </section>
  );
}
