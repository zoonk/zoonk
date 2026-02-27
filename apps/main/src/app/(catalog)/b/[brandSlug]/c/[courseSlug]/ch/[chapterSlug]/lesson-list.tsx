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
import { getChapterLessonCompletion } from "@zoonk/core/progress/chapter-lesson-completion";
import { type Lesson } from "@zoonk/db";
import { Skeleton } from "@zoonk/ui/components/skeleton";
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
  const completionData = await getChapterLessonCompletion({ chapterId });
  const completionMap = new Map(completionData.map((row) => [row.lessonId, row]));

  return (
    <CatalogList>
      <CatalogListSearch items={lessons} placeholder={t("Search lessons...")}>
        <CatalogListEmpty>{t("No lessons found")}</CatalogListEmpty>
        <CatalogListContent>
          {lessons.map((lesson) => {
            const completion = completionMap.get(lesson.id);

            return (
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

                {completion && (
                  <CatalogListItemProgress
                    completed={completion.completedActivities}
                    completedLabel={t("Completed")}
                    total={completion.totalActivities}
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

export function LessonListSkeleton({ count }: { count: number }) {
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
