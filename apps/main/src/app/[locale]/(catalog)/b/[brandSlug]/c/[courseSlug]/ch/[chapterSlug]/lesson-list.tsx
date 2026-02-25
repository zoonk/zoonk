import {
  CatalogList,
  CatalogListContent,
  CatalogListEmpty,
  CatalogListItem,
  CatalogListItemContent,
  CatalogListItemDescription,
  CatalogListItemPosition,
  CatalogListItemTitle,
  CatalogListSearch,
} from "@/components/catalog/catalog-list";
import { LessonCompletion } from "@/components/catalog/lesson-completion";
import { type Lesson } from "@zoonk/db";
import { formatPosition } from "@zoonk/utils/string";
import { getExtracted } from "next-intl/server";

export async function LessonList({
  brandSlug,
  chapterId,
  chapterSlug,
  courseSlug,
  lessons,
}: {
  brandSlug: string;
  chapterId: number;
  chapterSlug: string;
  courseSlug: string;
  lessons: Lesson[];
}) {
  if (lessons.length === 0) {
    return null;
  }

  const t = await getExtracted();

  return (
    <CatalogList>
      <CatalogListSearch items={lessons} placeholder={t("Search lessons...")}>
        <CatalogListEmpty>{t("No lessons found")}</CatalogListEmpty>
        <CatalogListContent>
          {lessons.map((lesson) => (
            <CatalogListItem
              href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lesson.slug}`}
              id={lesson.id}
              key={lesson.id}
              prefetch={lesson.generationStatus === "completed"}
            >
              <CatalogListItemPosition>{formatPosition(lesson.position)}</CatalogListItemPosition>

              <CatalogListItemContent>
                <CatalogListItemTitle>{lesson.title}</CatalogListItemTitle>
                <CatalogListItemDescription>{lesson.description}</CatalogListItemDescription>
              </CatalogListItemContent>

              <LessonCompletion chapterId={chapterId} lessonId={lesson.id} />
            </CatalogListItem>
          ))}
        </CatalogListContent>
      </CatalogListSearch>
    </CatalogList>
  );
}
