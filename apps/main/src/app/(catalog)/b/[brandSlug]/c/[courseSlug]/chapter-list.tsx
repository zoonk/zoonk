import {
  CatalogListEmpty,
  CatalogListItem,
  CatalogListSearch,
} from "@/components/catalog/catalog-list";
import { type CourseChapter } from "@/data/chapters/list-course-chapters";
import { getChapterProgress } from "@zoonk/core/progress/chapters";
import {
  ListContent,
  ListGroup,
  ListItemContent,
  ListItemDescription,
  ListItemHeader,
  ListItemImage,
  ListItemStatusCompleted,
  ListItemStatusProgress,
  ListItemTitle,
} from "@zoonk/ui/components/list";
import { getExtracted } from "next-intl/server";
import Image from "next/image";

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
  totalLessons,
}: {
  completedLabel: string;
  completedLessons: number;
  inProgressLabel: string;
  totalLessons: number;
}) {
  const status = getProgressStatus({ completed: completedLessons, total: totalLessons });

  if (status === "completed") {
    return <ListItemStatusCompleted aria-label={completedLabel} />;
  }

  if (status === "inProgress") {
    return <ListItemStatusProgress aria-label={inProgressLabel} />;
  }

  return null;
}

/**
 * A chapter row owns the thumbnail, text, and status composition so the page map
 * can stay focused on progress lookup and translated labels.
 */
function ChapterRow({
  brandSlug,
  chapter,
  completedLabel,
  completedLessons,
  courseSlug,
  defaultChapterImage,
  inProgressLabel,
  totalLessons,
}: {
  brandSlug: string;
  chapter: CourseChapter;
  completedLabel: string;
  completedLessons: number;
  courseSlug: string;
  defaultChapterImage: string;
  inProgressLabel: string;
  totalLessons: number;
}) {
  const chapterNumber = chapter.position + 1;

  return (
    <CatalogListItem
      href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapter.slug}`}
      id={chapter.id}
      prefetch={chapter.generationStatus === "completed"}
    >
      <ListItemImage>
        <Image alt="" height={64} src={chapter.imageUrl ?? defaultChapterImage} width={64} />
      </ListItemImage>

      <ListItemContent>
        <ListItemHeader>
          <ListItemTitle>
            <span className="text-muted-foreground">{chapterNumber}.</span> {chapter.title}
          </ListItemTitle>
          <ChapterListItemStatus
            completedLabel={completedLabel}
            completedLessons={completedLessons}
            inProgressLabel={inProgressLabel}
            totalLessons={totalLessons}
          />
        </ListItemHeader>
        {chapter.description && <ListItemDescription>{chapter.description}</ListItemDescription>}
      </ListItemContent>
    </CatalogListItem>
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
  const completionData = await getChapterProgress({ courseId });
  const completionMap = new Map(completionData.map((row) => [row.chapterId, row]));

  return (
    <ListContent>
      <CatalogListSearch items={chapters} placeholder={t("Search chapters...")}>
        <CatalogListEmpty>{t("No chapters found")}</CatalogListEmpty>
        <ListGroup>
          {chapters.map((chapter) => {
            const completion = completionMap.get(chapter.id);
            const completedLessons = completion?.completedLessons ?? 0;
            const totalLessons = chapter._count.lessons;

            return (
              <ChapterRow
                brandSlug={brandSlug}
                chapter={chapter}
                completedLabel={t("Completed")}
                completedLessons={completedLessons}
                courseSlug={courseSlug}
                defaultChapterImage={defaultChapterImage}
                inProgressLabel={t("{completed} of {total} completed", {
                  completed: String(completedLessons),
                  total: String(totalLessons),
                })}
                key={chapter.id}
                totalLessons={totalLessons}
              />
            );
          })}
        </ListGroup>
      </CatalogListSearch>
    </ListContent>
  );
}
