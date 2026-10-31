import { ChapterLessonRows } from "@/components/public/chapter-lesson-rows";
import { type LibraryChapterRoute } from "@/data/catalog/resolve-catalog-route";
import { getTotalDurationLabel } from "@/lib/public/public-labels";
import { PageSection } from "@zoonk/learn/page";
import { getExtracted } from "next-intl/server";

export async function ChapterLessons({
  params,
  route,
}: {
  params: { brandSlug: string; courseSlug: string };
  route: LibraryChapterRoute;
}) {
  const { chapter, number, total } = route;
  const minutes = chapter.lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0);

  const t = await getExtracted();
  const durationLabel = await getTotalDurationLabel(minutes);

  const facts = [
    t("Chapter {number} of {total}", { number: String(number), total: String(total) }),
    t("{count, plural, one {# short lesson} other {# short lessons}}", {
      count: chapter.lessons.length,
    }),
    durationLabel,
  ];

  const titleId = `chapter-lessons-${chapter.id}`;

  return (
    <PageSection aria-labelledby={titleId} className="gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-section" id={titleId}>
          {t("Lessons")}
        </h2>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {facts.join(" · ")}
        </span>
      </div>

      <ChapterLessonRows chapter={chapter} params={params} />
    </PageSection>
  );
}
