import {
  CatalogGridContent,
  CatalogGridEmpty,
  CatalogGridItem,
  CatalogGridSearch,
} from "@/components/catalog/catalog-grid";
import { CatalogGridImage } from "@/components/catalog/catalog-grid-image";
import { getCatalogActiveItemKey } from "@/components/catalog/catalog-item-target";
import { getCatalogChapterProgress } from "@/data/progress/catalog-progress";
import { getActiveCatalogTarget } from "@/data/progress/get-catalog-target";
import { type CourseChapter } from "@zoonk/core/chapters/list-by-course";
import { type LessonKind } from "@zoonk/db";
import {
  GridGroup,
  GridItemContent,
  GridItemDescription,
  GridItemFooter,
  GridItemMedia,
  GridItemPosition,
  GridItemStatusCompleted,
  GridItemStatusIdle,
  GridItemStatusProgress,
  GridItemTitle,
} from "@zoonk/ui/components/grid";
import { getExtracted } from "next-intl/server";

/**
 * Chapter progress has one visual status, but the rules depend on both the
 * completed count and the total published lesson count.
 */
function getProgressStatus({
  completed,
  total,
}: {
  completed: number;
  total: number;
}): "completed" | "inProgress" | "notStarted" {
  if (total > 0 && completed >= total) {
    return "completed";
  }

  if (completed > 0) {
    return "inProgress";
  }

  return "notStarted";
}

/**
 * Chapter rows need three quiet states: empty for untouched, blue for partial
 * progress, and green for complete.
 */
function ChapterListItemStatus({
  completedLabel,
  completedLessons,
  inProgressLabel,
  notStartedLabel,
  totalLessons,
}: {
  completedLabel: string;
  completedLessons: number;
  inProgressLabel: string;
  notStartedLabel: string;
  totalLessons: number;
}) {
  const status = getProgressStatus({ completed: completedLessons, total: totalLessons });

  if (status === "completed") {
    return <GridItemStatusCompleted>{completedLabel}</GridItemStatusCompleted>;
  }

  if (status === "inProgress") {
    return <GridItemStatusProgress>{inProgressLabel}</GridItemStatusProgress>;
  }

  return <GridItemStatusIdle>{notStartedLabel}</GridItemStatusIdle>;
}

/**
 * A chapter tile gives the image more room than the old row, making the course
 * path easier to scan on wide screens without dropping the compact mobile flow.
 */
function ChapterTile({
  brandSlug,
  chapter,
  chapterNumber,
  completedLabel,
  completedLessons,
  courseSlug,
  defaultChapterImage,
  inProgressLabel,
  notStartedLabel,
  totalLessons,
  view,
}: {
  brandSlug: string;
  chapter: CourseChapter;
  chapterNumber: number;
  completedLabel: string;
  completedLessons: number;
  courseSlug: string;
  defaultChapterImage: string;
  inProgressLabel: string;
  notStartedLabel: string;
  totalLessons: number;
  view: "path" | "curriculum";
}) {
  return (
    <CatalogGridItem
      className="min-h-64"
      href={
        view === "curriculum"
          ? `/b/${brandSlug}/c/${courseSlug}/ch/${chapter.slug}?view=curriculum`
          : `/b/${brandSlug}/c/${courseSlug}/ch/${chapter.slug}`
      }
      id={chapter.id}
      prefetch={chapter.generationStatus === "completed"}
    >
      <GridItemMedia>
        <CatalogGridImage alt={chapter.title} src={chapter.imageUrl ?? defaultChapterImage} />
      </GridItemMedia>

      <GridItemContent>
        <GridItemPosition tone="white">{chapterNumber}</GridItemPosition>
        <GridItemTitle>{chapter.title}</GridItemTitle>
        {chapter.description && <GridItemDescription>{chapter.description}</GridItemDescription>}
      </GridItemContent>
      <GridItemFooter>
        <ChapterListItemStatus
          completedLabel={completedLabel}
          completedLessons={completedLessons}
          inProgressLabel={inProgressLabel}
          notStartedLabel={notStartedLabel}
          totalLessons={totalLessons}
        />
      </GridItemFooter>
    </CatalogGridItem>
  );
}

export async function ChapterList({
  brandSlug,
  chapters,
  courseId,
  courseSlug,
  defaultChapterImage,
  hiddenLessonKinds,
  view,
}: {
  brandSlug: string;
  chapters: CourseChapter[];
  courseId: string;
  courseSlug: string;
  defaultChapterImage: string;
  hiddenLessonKinds: LessonKind[];
  view: "path" | "curriculum";
}) {
  if (chapters.length === 0) {
    return null;
  }

  const t = await getExtracted();

  const [activeTarget, completionData] = await Promise.all([
    getActiveCatalogTarget({ excludedLessonKinds: hiddenLessonKinds, scope: { courseId } }),
    getCatalogChapterProgress({ courseId, excludedLessonKinds: hiddenLessonKinds, view }),
  ]);

  const completionMap = new Map(completionData.map((row) => [row.chapterId, row]));

  const activeChapterKey = getCatalogActiveItemKey({
    activeSlug: activeTarget?.chapterSlug,
    items: chapters,
  });

  return (
    <CatalogGridContent activeItemKey={activeChapterKey} activeLabel={t("Current chapter")}>
      <CatalogGridSearch items={chapters} placeholder={t("Search chapters...")}>
        <CatalogGridEmpty>{t("No chapters found")}</CatalogGridEmpty>
        <GridGroup variant="pane">
          {chapters.map((chapter, index) => {
            const completion = completionMap.get(chapter.id);
            const completedLessons = completion?.completedLessons ?? 0;
            const totalLessons = completion?.totalLessons ?? chapter._count.lessons;

            return (
              <ChapterTile
                brandSlug={brandSlug}
                chapter={chapter}
                chapterNumber={index + 1}
                completedLabel={t("Completed")}
                completedLessons={completedLessons}
                courseSlug={courseSlug}
                defaultChapterImage={defaultChapterImage}
                inProgressLabel={t("{completed, number}/{total, number} done", {
                  completed: completedLessons,
                  total: totalLessons,
                })}
                key={chapter.id}
                notStartedLabel={t("Not started")}
                totalLessons={totalLessons}
                view={view}
              />
            );
          })}
        </GridGroup>
      </CatalogGridSearch>
    </CatalogGridContent>
  );
}
