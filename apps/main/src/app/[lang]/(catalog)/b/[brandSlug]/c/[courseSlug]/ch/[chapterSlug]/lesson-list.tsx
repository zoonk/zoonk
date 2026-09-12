import {
  CatalogGridContent,
  CatalogGridEmpty,
  CatalogGridItem,
  CatalogGridSearch,
} from "@/components/catalog/catalog-grid";
import { CatalogGridImage } from "@/components/catalog/catalog-grid-image";
import { getCatalogActiveItemKey } from "@/components/catalog/catalog-item-target";
import { getCatalogLessonProgress } from "@/data/progress/catalog-progress";
import { getActiveCatalogTarget } from "@/data/progress/get-catalog-target";
import { getDefaultLessonImage } from "@/lib/catalog/default-images";
import { type LessonDisplayMeta, getLessonDisplayMeta } from "@/lib/lessons";
import { type Lesson } from "@zoonk/db";
import {
  GridGroup,
  GridItemContent,
  GridItemDescription,
  GridItemFooter,
  GridItemMedia,
  GridItemStatusCompleted,
  GridItemStatusIdle,
  GridItemTitle,
} from "@zoonk/ui/components/grid";
import { getExtracted } from "next-intl/server";
import { getLessonKindTone } from "./_utils/lesson-kind-tones";
import { LessonListPosition } from "./lesson-list-position";

type LessonRow = { display: LessonDisplayMeta; lesson: Lesson };

/**
 * Lesson rows only need a binary completion state, so the visual stays quieter
 * than chapter progress while preserving the same dot scale.
 */
function LessonListItemStatus({
  completedLabel,
  isCompleted,
  notStartedLabel,
}: {
  completedLabel: string;
  isCompleted: boolean;
  notStartedLabel: string;
}) {
  if (isCompleted) {
    return <GridItemStatusCompleted>{completedLabel}</GridItemStatusCompleted>;
  }

  return <GridItemStatusIdle>{notStartedLabel}</GridItemStatusIdle>;
}

/**
 * A lesson tile lets chapter pages read like a visual study board while keeping
 * each lesson's title, description, and completion state in the link target.
 */
function LessonTile({
  brandSlug,
  chapterSlug,
  completedLabel,
  courseSlug,
  display,
  isCompleted,
  lesson,
  notStartedLabel,
  position,
  view,
}: {
  brandSlug: string;
  chapterSlug: string;
  completedLabel: string;
  courseSlug: string;
  display: LessonRow["display"];
  isCompleted: boolean;
  lesson: Lesson;
  notStartedLabel: string;
  position: number;
  view: "teaching" | "curriculum";
}) {
  return (
    <CatalogGridItem
      href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lesson.slug}${view === "curriculum" ? "?view=curriculum" : ""}`}
      id={lesson.id}
      prefetch={lesson.generationStatus === "completed"}
    >
      <GridItemMedia>
        <CatalogGridImage
          alt={display.title}
          src={lesson.imageUrl ?? getDefaultLessonImage(lesson.kind)}
        />
      </GridItemMedia>

      <GridItemContent>
        <LessonListPosition
          lessonId={lesson.id}
          position={position}
          tone={getLessonKindTone({ kind: lesson.kind })}
        />
        <GridItemTitle>{display.title}</GridItemTitle>
        <GridItemDescription>{display.description}</GridItemDescription>
      </GridItemContent>
      <GridItemFooter>
        <LessonListItemStatus
          completedLabel={completedLabel}
          isCompleted={isCompleted}
          notStartedLabel={notStartedLabel}
        />
      </GridItemFooter>
    </CatalogGridItem>
  );
}

/**
 * Lesson display copy can come from translations when generated companion
 * lessons have no stored title. Resolving rows sequentially keeps next-intl
 * calls outside Promise.all while still giving search a plain string title.
 */
async function getLessonRows([lesson, ...rest]: Lesson[]): Promise<LessonRow[]> {
  if (!lesson) {
    return [];
  }

  return [{ display: await getLessonDisplayMeta(lesson), lesson }, ...(await getLessonRows(rest))];
}

export async function LessonList({
  brandSlug,
  chapterId,
  chapterSlug,
  courseSlug,
  lessons,
  view,
}: {
  brandSlug: string;
  chapterId: string;
  chapterSlug: string;
  courseSlug: string;
  lessons: Lesson[];
  view: "teaching" | "curriculum";
}) {
  if (lessons.length === 0) {
    return null;
  }

  const t = await getExtracted();

  const [activeTarget, completionData] = await Promise.all([
    getActiveCatalogTarget({ scope: { chapterId } }),
    getCatalogLessonProgress({ chapterId }),
  ]);

  const completionMap = new Map(completionData.map((row) => [row.lessonId, row]));
  const lessonRows = await getLessonRows(lessons);

  const activeLessonKey = getCatalogActiveItemKey({
    activeSlug: activeTarget?.lessonSlug,
    items: lessons,
  });

  const searchItems = lessonRows.map(({ display, lesson }) => ({
    description: display.description,
    id: lesson.id,
    kind: lesson.kind,
    title: display.title,
  }));

  return (
    <CatalogGridContent activeItemKey={activeLessonKey} activeLabel={t("Current lesson")}>
      <CatalogGridSearch items={searchItems} placeholder={t("Search lessons...")}>
        <CatalogGridEmpty>{t("No lessons found")}</CatalogGridEmpty>
        <GridGroup variant="pane">
          {lessonRows.map(({ display, lesson }, index) => {
            const completion = completionMap.get(lesson.id);
            const isCompleted = completion?.isCompleted ?? false;

            return (
              <LessonTile
                brandSlug={brandSlug}
                chapterSlug={chapterSlug}
                completedLabel={t("Completed")}
                courseSlug={courseSlug}
                display={display}
                isCompleted={isCompleted}
                key={lesson.id}
                lesson={lesson}
                notStartedLabel={t("Not started")}
                position={index + 1}
                view={view}
              />
            );
          })}
        </GridGroup>
      </CatalogGridSearch>
    </CatalogGridContent>
  );
}
