import {
  CatalogList,
  CatalogListContent,
  CatalogListItem,
  CatalogListItemContent,
  CatalogListItemDescription,
  CatalogListItemPosition,
  CatalogListItemTitle,
  CatalogListSearch,
} from "@/components/catalog/catalog-list";
import { type LessonForList } from "@/data/lessons/list-chapter-lessons";
import { getExtracted } from "next-intl/server";

export async function LessonList({
  brandSlug,
  chapterSlug,
  courseSlug,
  lessons,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessons: LessonForList[];
}) {
  if (lessons.length === 0) {
    return null;
  }

  const t = await getExtracted();

  return (
    <CatalogList>
      <CatalogListSearch
        ariaLabel={t("Search lessons")}
        items={lessons}
        placeholder={t("Search lessons...")}
      >
        <CatalogListContent emptyMessage={t("No lessons found")}>
          {lessons.map((lesson) => (
            <CatalogListItem
              href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lesson.slug}`}
              id={lesson.id}
              key={lesson.id}
            >
              <CatalogListItemPosition>
                {String(lesson.position + 1).padStart(2, "0")}
              </CatalogListItemPosition>

              <CatalogListItemContent>
                <CatalogListItemTitle>{lesson.title}</CatalogListItemTitle>
                {lesson.description && (
                  <CatalogListItemDescription>{lesson.description}</CatalogListItemDescription>
                )}
              </CatalogListItemContent>
            </CatalogListItem>
          ))}
        </CatalogListContent>
      </CatalogListSearch>
    </CatalogList>
  );
}
