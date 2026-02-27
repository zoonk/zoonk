import {
  CatalogList,
  CatalogListContent,
  CatalogListItem,
  CatalogListItemContent,
  CatalogListItemDescription,
  CatalogListItemIndicator,
  CatalogListItemTitle,
} from "@/components/catalog/catalog-list";
import { getActivityKinds } from "@/lib/activities";
import { getActivityProgress } from "@zoonk/core/progress/activities";
import { type Activity } from "@zoonk/db";
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
  const [activityKinds, completedIds] = await Promise.all([
    getActivityKinds(),
    getActivityProgress({ lessonId }),
  ]);

  const kindMeta = new Map(activityKinds.map((kind) => [kind.key, kind]));

  return (
    <CatalogList>
      <CatalogListContent aria-label={t("Activities")}>
        {activities.map((activity) => {
          const meta = kindMeta.get(activity.kind);

          const title = activity.kind === "custom" && activity.title ? activity.title : meta?.label;

          const description =
            activity.kind === "custom" && activity.description
              ? activity.description
              : meta?.description;

          const completed = completedIds.includes(String(activity.id));

          return (
            <CatalogListItem
              href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}/a/${activity.position}`}
              id={activity.id}
              key={String(activity.id)}
            >
              <CatalogListItemContent>
                <CatalogListItemTitle>{title}</CatalogListItemTitle>
                <CatalogListItemDescription>{description}</CatalogListItemDescription>
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
