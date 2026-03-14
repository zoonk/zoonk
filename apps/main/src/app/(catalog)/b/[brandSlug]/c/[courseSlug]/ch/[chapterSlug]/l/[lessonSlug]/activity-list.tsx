import {
  CatalogList,
  CatalogListContent,
  CatalogListItem,
  CatalogListItemContent,
  CatalogListItemDescription,
  CatalogListItemIndicator,
  CatalogListItemPosition,
  CatalogListItemTitle,
} from "@/components/catalog/catalog-list";
import { getActivityProgress } from "@zoonk/core/progress/activities";
import { type Activity } from "@zoonk/db";
import { formatPosition } from "@zoonk/utils/number";
import { getExtracted } from "next-intl/server";

export async function ActivityList({
  activities,
  brandSlug,
  chapterSlug,
  courseSlug,
  lessonId,
  lessonSlug,
}: {
  activities: Activity[];
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonId: number;
  lessonSlug: string;
}) {
  if (activities.length === 0) {
    return null;
  }

  const t = await getExtracted();
  const completedIds = await getActivityProgress({ lessonId });

  return (
    <CatalogList>
      <CatalogListContent aria-label={t("Activities")}>
        {activities.map((activity) => {
          const completed = completedIds.includes(String(activity.id));

          return (
            <CatalogListItem
              href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}/a/${activity.position}`}
              id={activity.id}
              key={String(activity.id)}
              prefetch={activity.generationStatus === "completed"}
            >
              <CatalogListItemPosition>{formatPosition(activity.position)}</CatalogListItemPosition>

              <CatalogListItemContent>
                <CatalogListItemTitle>{activity.title}</CatalogListItemTitle>
                <CatalogListItemDescription>{activity.description}</CatalogListItemDescription>
              </CatalogListItemContent>

              <CatalogListItemIndicator
                completed={completed}
                completedLabel={t("Completed")}
                notCompletedLabel={t("Not completed")}
              />
            </CatalogListItem>
          );
        })}
      </CatalogListContent>
    </CatalogList>
  );
}
