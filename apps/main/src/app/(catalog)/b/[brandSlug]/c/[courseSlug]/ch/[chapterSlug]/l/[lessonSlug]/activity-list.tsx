import { ActivityCompletionIndicator } from "@/components/catalog/activity-completion-indicator";
import {
  CatalogList,
  CatalogListContent,
  CatalogListItem,
  CatalogListItemContent,
  CatalogListItemDescription,
  CatalogListItemTitle,
} from "@/components/catalog/catalog-list";
import { type ActivityKindInfo } from "@/lib/activities";
import { type Activity } from "@zoonk/db";
import { getExtracted } from "next-intl/server";

export async function ActivityList({
  activities,
  brandSlug,
  chapterSlug,
  courseSlug,
  kindMeta,
  lessonId,
  lessonSlug,
}: {
  activities: Activity[];
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  kindMeta: Map<string, ActivityKindInfo>;
  lessonId: number;
  lessonSlug: string;
}) {
  if (activities.length === 0) {
    return null;
  }

  const t = await getExtracted();

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

              <ActivityCompletionIndicator activityId={String(activity.id)} lessonId={lessonId} />
            </CatalogListItem>
          );
        })}
      </CatalogListContent>
    </CatalogList>
  );
}
