import {
  CatalogList,
  CatalogListContent,
  CatalogListEmpty,
  CatalogListItem,
  CatalogListItemContent,
  CatalogListItemDescription,
  CatalogListItemPosition,
  CatalogListItemProgress,
  CatalogListItemTitle,
  CatalogListSearch,
} from "@/components/catalog/catalog-list";
import { getChapterProgress } from "@zoonk/core/progress/chapters";
import { type Chapter } from "@zoonk/db";
import { formatPosition } from "@zoonk/utils/string";
import { getExtracted } from "next-intl/server";

export async function ChapterList({
  brandSlug,
  chapters,
  courseId,
  courseSlug,
}: {
  brandSlug: string;
  chapters: Chapter[];
  courseId: number;
  courseSlug: string;
}) {
  if (chapters.length === 0) {
    return null;
  }

  const t = await getExtracted();
  const completionData = await getChapterProgress({ courseId });
  const completionMap = new Map(completionData.map((row) => [row.chapterId, row]));

  return (
    <CatalogList>
      <CatalogListSearch items={chapters} placeholder={t("Search chapters...")}>
        <CatalogListEmpty>{t("No chapters found")}</CatalogListEmpty>
        <CatalogListContent>
          {chapters.map((chapter) => {
            const completion = completionMap.get(chapter.id);

            return (
              <CatalogListItem
                href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapter.slug}`}
                id={chapter.id}
                key={chapter.id}
                prefetch={chapter.generationStatus === "completed"}
              >
                <CatalogListItemPosition>
                  {formatPosition(chapter.position)}
                </CatalogListItemPosition>

                <CatalogListItemContent>
                  <CatalogListItemTitle>{chapter.title}</CatalogListItemTitle>
                  {chapter.description && (
                    <CatalogListItemDescription>{chapter.description}</CatalogListItemDescription>
                  )}
                </CatalogListItemContent>

                {completion && (
                  <CatalogListItemProgress
                    completed={completion.completedLessons}
                    completedLabel={t("Completed")}
                    total={completion.totalLessons}
                  />
                )}
              </CatalogListItem>
            );
          })}
        </CatalogListContent>
      </CatalogListSearch>
    </CatalogList>
  );
}
