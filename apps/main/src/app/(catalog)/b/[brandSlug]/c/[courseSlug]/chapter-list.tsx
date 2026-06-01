import {
  CatalogGridContent,
  CatalogGridEmpty,
  CatalogGridItem,
  CatalogGridSearch,
} from "@/components/catalog/catalog-grid";
import { CatalogGridImage } from "@/components/catalog/catalog-grid-image";
import { getCatalogActiveItemKey } from "@/components/catalog/catalog-item-target";
import { type CourseChapter } from "@/data/chapters/list-course-chapters";
import { getCatalogChapterProgress } from "@/data/progress/catalog-progress";
import { getActiveCatalogTarget } from "@zoonk/core/progress/active-catalog-target";
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
  type GridItemTone,
} from "@zoonk/ui/components/grid";
import { getExtracted } from "next-intl/server";

const CHAPTERS_PER_DIFFICULTY_BAND = 10;

const CHAPTER_DIFFICULTY_TONES = [
  "white",
  "yellow",
  "orange",
  "green",
  "blue",
  "purple",
  "brown",
  "red",
  "gray",
  "black",
] as const;

/**
 * Chapter order is the closest signal we have for difficulty, so we map every
 * ten chapters onto the belt progression from easy to hard.
 */
function getChapterPositionTone({ position }: { position: number }): GridItemTone {
  const bandIndex = Math.floor(position / CHAPTERS_PER_DIFFICULTY_BAND);

  return (
    CHAPTER_DIFFICULTY_TONES[Math.min(bandIndex, CHAPTER_DIFFICULTY_TONES.length - 1)] ?? "black"
  );
}

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
  completedLabel,
  completedLessons,
  courseSlug,
  defaultChapterImage,
  inProgressLabel,
  notStartedLabel,
  totalLessons,
}: {
  brandSlug: string;
  chapter: CourseChapter;
  completedLabel: string;
  completedLessons: number;
  courseSlug: string;
  defaultChapterImage: string;
  inProgressLabel: string;
  notStartedLabel: string;
  totalLessons: number;
}) {
  const chapterNumber = chapter.position + 1;

  return (
    <CatalogGridItem
      className="min-h-64"
      href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapter.slug}`}
      id={chapter.id}
      prefetch={chapter.generationStatus === "completed"}
    >
      <GridItemMedia>
        <CatalogGridImage alt={chapter.title} src={chapter.imageUrl ?? defaultChapterImage} />
      </GridItemMedia>

      <GridItemContent>
        <GridItemPosition tone={getChapterPositionTone({ position: chapter.position })}>
          {chapterNumber}
        </GridItemPosition>
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
}: {
  brandSlug: string;
  chapters: CourseChapter[];
  courseId: string;
  courseSlug: string;
  defaultChapterImage: string;
}) {
  if (chapters.length === 0) {
    return null;
  }

  const t = await getExtracted();

  const [completionData, activeTarget] = await Promise.all([
    getCatalogChapterProgress(courseId),
    getActiveCatalogTarget({ scope: { courseId } }),
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
          {chapters.map((chapter) => {
            const completion = completionMap.get(chapter.id);
            const completedLessons = completion?.completedLessons ?? 0;
            const totalLessons = chapter._count.lessons;

            return (
              <ChapterTile
                brandSlug={brandSlug}
                chapter={chapter}
                completedLabel={t("Completed")}
                completedLessons={completedLessons}
                courseSlug={courseSlug}
                defaultChapterImage={defaultChapterImage}
                inProgressLabel={t("{completed}/{total} done", {
                  completed: String(completedLessons),
                  total: String(totalLessons),
                })}
                key={chapter.id}
                notStartedLabel={t("Not started")}
                totalLessons={totalLessons}
              />
            );
          })}
        </GridGroup>
      </CatalogGridSearch>
    </CatalogGridContent>
  );
}
