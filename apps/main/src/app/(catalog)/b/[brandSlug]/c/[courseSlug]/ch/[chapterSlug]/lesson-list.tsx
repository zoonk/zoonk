import {
  CatalogList,
  CatalogListEmpty,
  CatalogListItem,
  CatalogListSearch,
} from "@/components/catalog/catalog-list";
import { getDefaultLessonImage } from "@/lib/catalog/default-images";
import { getLessonDisplayMeta } from "@/lib/lessons";
import { getLessonProgress } from "@zoonk/core/progress/lessons";
import { type Lesson } from "@zoonk/db";
import {
  CatalogListGroup,
  CatalogListItemContent,
  CatalogListItemDescription,
  CatalogListItemHeader,
  CatalogListItemImage,
  CatalogListItemStatusCompleted,
  CatalogListItemTitle,
} from "@zoonk/ui/components/catalog-list";
import { getExtracted } from "next-intl/server";
import Image from "next/image";

type LessonRow = { display: Awaited<ReturnType<typeof getLessonDisplayMeta>>; lesson: Lesson };

/**
 * Lesson rows only need a binary completion state, so the visual stays quieter
 * than chapter progress while preserving the same dot scale.
 */
function LessonListItemStatus({
  completedLabel,
  isCompleted,
}: {
  completedLabel: string;
  isCompleted: boolean;
}) {
  if (isCompleted) {
    return <CatalogListItemStatusCompleted aria-label={completedLabel} />;
  }

  return null;
}

/**
 * A lesson row keeps the thumbnail, display copy, and completion dot together
 * while the page-level loop only resolves lesson display data.
 */
function LessonRowItem({
  brandSlug,
  chapterSlug,
  completedLabel,
  courseSlug,
  display,
  isCompleted,
  lesson,
}: {
  brandSlug: string;
  chapterSlug: string;
  completedLabel: string;
  courseSlug: string;
  display: LessonRow["display"];
  isCompleted: boolean;
  lesson: Lesson;
}) {
  return (
    <CatalogListItem
      href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lesson.slug}`}
      id={lesson.id}
      prefetch={lesson.generationStatus === "completed"}
    >
      <CatalogListItemImage>
        <Image
          alt={display.title}
          height={64}
          src={lesson.imageUrl ?? getDefaultLessonImage(lesson.kind)}
          width={64}
        />
      </CatalogListItemImage>

      <CatalogListItemContent>
        <CatalogListItemHeader>
          <CatalogListItemTitle>{display.title}</CatalogListItemTitle>
          <LessonListItemStatus completedLabel={completedLabel} isCompleted={isCompleted} />
        </CatalogListItemHeader>
        <CatalogListItemDescription>{display.description}</CatalogListItemDescription>
      </CatalogListItemContent>
    </CatalogListItem>
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
    id: lesson.id,
    title: display.title,
  }));

  return (
    <CatalogList>
      <CatalogListSearch items={searchItems} placeholder={t("Search lessons...")}>
        <CatalogListEmpty>{t("No lessons found")}</CatalogListEmpty>
        <CatalogListGroup>
          {lessonRows.map(({ display, lesson }) => {
            const completion = completionMap.get(lesson.id);
            const isCompleted = completion?.isCompleted ?? false;

            return (
              <LessonRowItem
                brandSlug={brandSlug}
                chapterSlug={chapterSlug}
                completedLabel={t("Completed")}
                courseSlug={courseSlug}
                display={display}
                isCompleted={isCompleted}
                key={lesson.id}
                lesson={lesson}
              />
            );
          })}
        </CatalogListGroup>
      </CatalogListSearch>
    </CatalogList>
  );
}
