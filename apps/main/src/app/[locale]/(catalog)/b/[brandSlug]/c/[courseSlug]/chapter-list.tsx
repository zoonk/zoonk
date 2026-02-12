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
import { type ChapterForList } from "@/data/chapters/list-course-chapters";
import { formatPosition } from "@zoonk/utils/string";
import { getExtracted } from "next-intl/server";

export async function ChapterList({
  brandSlug,
  chapters,
  courseSlug,
}: {
  brandSlug: string;
  chapters: ChapterForList[];
  courseSlug: string;
}) {
  if (chapters.length === 0) {
    return null;
  }

  const t = await getExtracted();

  return (
    <CatalogList>
      <CatalogListSearch items={chapters} placeholder={t("Search chapters...")}>
        <CatalogListEmpty>{t("No chapters found")}</CatalogListEmpty>
        <CatalogListContent>
          {chapters.map((chapter) => (
            <CatalogListItem
              href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapter.slug}`}
              id={chapter.id}
              key={chapter.id}
              prefetch={chapter.generationStatus === "completed"}
            >
              <CatalogListItemPosition>{formatPosition(chapter.position)}</CatalogListItemPosition>

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
