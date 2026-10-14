import { ChapterLessonRows } from "@/components/public/chapter-lesson-rows";
import { type LibraryChapterRoute } from "@/data/catalog/resolve-catalog-route";
import { getTotalDurationLabel } from "@/lib/public/public-labels";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "@zoonk/learn/page";
import { getExtracted } from "next-intl/server";

/**
 * The chapter's lessons, what a visitor came to learn: where the chapter sits in its course, how
 * many lessons and how long, then the lessons as numbered rows, the first one where it starts, one
 * tap each.
 */
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
    <PageSection aria-labelledby={titleId} className="max-w-column">
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{t("Lessons")}</PageSectionTitle>
        <PageSectionDetail>{facts.join(" · ")}</PageSectionDetail>
      </PageSectionHeader>

      <ChapterLessonRows chapter={chapter} params={params} />
    </PageSection>
  );
}
