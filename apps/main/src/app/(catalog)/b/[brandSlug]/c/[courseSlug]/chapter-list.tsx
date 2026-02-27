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
import { getCourseChapterCompletion } from "@zoonk/core/progress/course-chapter-completion";
import { type Chapter } from "@zoonk/db";
import { Skeleton } from "@zoonk/ui/components/skeleton";
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
  const completionData = await getCourseChapterCompletion({ courseId });
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

function CatalogListItemSkeleton() {
  return (
    <li className="-mx-3 flex items-start gap-3 px-3 py-3.5">
      <Skeleton className="h-4 w-6 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3.5 w-full" />
      </div>
    </li>
  );
}

export function ChapterListSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full rounded-md" />
      <ul className="flex flex-col">
        {Array.from({ length: count }).map((_, i) => (
          // oxlint-disable-next-line eslint/no-array-index-key -- static skeleton
          <CatalogListItemSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}
