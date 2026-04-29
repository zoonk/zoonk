import {
  CatalogList,
  CatalogListContent,
  CatalogListEmpty,
  CatalogListItem,
  CatalogListItemContent,
  CatalogListItemDescription,
  CatalogListItemIndicator,
  CatalogListItemPosition,
  CatalogListItemTitle,
  CatalogListSearch,
} from "@/components/catalog/catalog-list";
import { getLessonDisplayMeta } from "@/lib/lessons";
import { getLessonProgress } from "@zoonk/core/progress/lessons";
import { type Lesson } from "@zoonk/db";
import { formatPosition } from "@zoonk/utils/number";
import { getExtracted } from "next-intl/server";

type LessonRow = {
  display: { title: string; description: string };
  lesson: Lesson;
};

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
    id: lesson.id,
    title: display.title,
  }));

  return (
    <CatalogList>
      <CatalogListSearch items={searchItems} placeholder={t("Search lessons...")}>
        <CatalogListEmpty>{t("No lessons found")}</CatalogListEmpty>
        <CatalogListContent>
          {lessonRows.map(({ display, lesson }) => {
            const completion = completionMap.get(lesson.id);
            const isCompleted = completion?.isCompleted ?? false;

            return (
              <CatalogListItem
                href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lesson.slug}`}
                id={lesson.id}
                key={lesson.id}
                prefetch={lesson.generationStatus === "completed"}
              >
                <CatalogListItemPosition>{formatPosition(lesson.position)}</CatalogListItemPosition>

                <CatalogListItemContent>
                  <CatalogListItemTitle completed={isCompleted}>
                    {display.title}
                  </CatalogListItemTitle>
                  <CatalogListItemDescription>{display.description}</CatalogListItemDescription>
                </CatalogListItemContent>

                <CatalogListItemIndicator
                  completed={isCompleted}
                  completedLabel={t("Completed")}
                  notCompletedLabel={t("Not completed")}
                />
              </CatalogListItem>
            );
          })}
        </CatalogListContent>
      </CatalogListSearch>
    </CatalogList>
  );
}
