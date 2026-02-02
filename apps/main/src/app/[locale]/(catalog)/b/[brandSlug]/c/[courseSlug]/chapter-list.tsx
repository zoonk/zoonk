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
import { type ChapterWithLessons } from "@/data/chapters/list-course-chapters";
import { getExtracted } from "next-intl/server";

export async function ChapterList({
  brandSlug,
  chapters,
  courseSlug,
}: {
  brandSlug: string;
  chapters: ChapterWithLessons[];
  courseSlug: string;
}) {
  if (chapters.length === 0) {
    return null;
  }

  const t = await getExtracted();

  return (
    <CatalogList>
      <CatalogListSearch
        ariaLabel={t("Search chapters")}
        items={chapters}
        placeholder={t("Search chapters...")}
      >
        <CatalogListContent emptyMessage={t("No chapters found")}>
          {chapters.map((chapter) => (
            <CatalogListItem
              href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapter.slug}`}
              id={chapter.id}
              key={chapter.id}
            >
              <CatalogListItemPosition>
                {String(chapter.position + 1).padStart(2, "0")}
              </CatalogListItemPosition>

              <CatalogListItemContent>
                <CatalogListItemTitle>{chapter.title}</CatalogListItemTitle>
                {chapter.description && (
                  <CatalogListItemDescription>{chapter.description}</CatalogListItemDescription>
                )}
              </CatalogListItemContent>
            </CatalogListItem>
          ))}
        </CatalogListContent>
      </CatalogListSearch>
    </CatalogList>
  );
}
