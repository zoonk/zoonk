import {
  CatalogGridEmpty,
  CatalogGridItem,
  CatalogGridSearch,
} from "@/components/catalog/catalog-grid";
import { CatalogGridImage } from "@/components/catalog/catalog-grid-image";
import { getDefaultLessonImage } from "@/lib/catalog/default-images";
import { getLessonDisplayMeta } from "@/lib/lessons";
import { getLessonProgress } from "@zoonk/core/progress/lessons";
import { type Lesson, type LessonKind } from "@zoonk/db";
import {
  GridContent,
  GridGroup,
  GridItemContent,
  GridItemDescription,
  GridItemFooter,
  GridItemMedia,
  GridItemPosition,
  GridItemStatusCompleted,
  GridItemStatusIdle,
  GridItemTitle,
  type GridItemTone,
} from "@zoonk/ui/components/grid";
import { getExtracted } from "next-intl/server";

type LessonRow = { display: Awaited<ReturnType<typeof getLessonDisplayMeta>>; lesson: Lesson };

const LESSON_KIND_TONES: Record<LessonKind, GridItemTone> = {
  alphabet: "blue",
  custom: "gray",
  explanation: "blue",
  grammar: "purple",
  listening: "purple",
  practice: "green",
  quiz: "yellow",
  reading: "green",
  review: "purple",
  translation: "orange",
  tutorial: "blue",
  vocabulary: "blue",
};

/**
 * Lesson kind is a stronger visual grouping than position because repeated
 * companion lessons should be recognizable across the chapter.
 */
function getLessonKindTone({ kind }: { kind: LessonKind }) {
  return LESSON_KIND_TONES[kind];
}

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
}: {
  brandSlug: string;
  chapterSlug: string;
  completedLabel: string;
  courseSlug: string;
  display: LessonRow["display"];
  isCompleted: boolean;
  lesson: Lesson;
  notStartedLabel: string;
}) {
  const lessonNumber = lesson.position + 1;

  return (
    <CatalogGridItem
      href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lesson.slug}`}
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
        <GridItemPosition tone={getLessonKindTone({ kind: lesson.kind })}>
          {lessonNumber}
        </GridItemPosition>
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
}: {
  brandSlug: string;
  chapterId: string;
  chapterSlug: string;
  courseSlug: string;
  lessons: Lesson[];
}) {
  if (lessons.length === 0) {
    return null;
  }

  const t = await getExtracted();
  const completionData = await getLessonProgress({ chapterId });
  const completionMap = new Map(completionData.map((row) => [row.lessonId, row]));
  const lessonRows = await getLessonRows(lessons);

  const searchItems = lessonRows.map(({ display, lesson }) => ({
    description: display.description,
    id: lesson.id,
    title: display.title,
  }));

  return (
    <GridContent>
      <CatalogGridSearch items={searchItems} placeholder={t("Search lessons...")}>
        <CatalogGridEmpty>{t("No lessons found")}</CatalogGridEmpty>
        <GridGroup>
          {lessonRows.map(({ display, lesson }) => {
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
              />
            );
          })}
        </GridGroup>
      </CatalogGridSearch>
    </GridContent>
  );
}
